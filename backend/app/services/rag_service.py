"""
RAG Service — high-level orchestration.

Responsibilities:
  - Manage index freshness (lazy re-index on dirty flag)
  - Build RagContext from retrieved chunks
  - Provide mark_dirty helpers for rule/pattern changes
  - Provide warmup_rag() for startup background task
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from app.core.config import settings
from app.db.collections import RAG_INDEX_STATE_COLLECTION

# One asyncio lock prevents concurrent re-index races
_reindex_lock = asyncio.Lock()


# ---------------------------------------------------------------------------
# RagContext dataclass — returned to qc_service.py
# ---------------------------------------------------------------------------

@dataclass
class RagContext:
    report_spec_text: str = ""       # formatted report type spec (always exact)
    rules_text: str = ""             # top-N relevant rules, formatted
    patterns_text: str = ""          # top-M relevant patterns, formatted
    rules_retrieved: int = 0         # how many rule chunks were found
    patterns_retrieved: int = 0
    fallback_used: bool = False      # True → caller should use old full-dump path


# ---------------------------------------------------------------------------
# Dirty flag helpers  (called from quality.py after rule/training changes)
# ---------------------------------------------------------------------------

async def mark_rules_dirty(db) -> None:
    """Set rules_dirty=True so next evaluation triggers rule re-indexing."""
    try:
        await db[RAG_INDEX_STATE_COLLECTION].update_one(
            {"_id": "state"},
            {"$set": {"rules_dirty": True, "updated_at": datetime.utcnow()}},
            upsert=True,
        )
    except Exception as exc:
        print(f"[RAG] mark_rules_dirty failed: {exc}")


async def mark_patterns_dirty(db) -> None:
    """Set patterns_dirty=True so next evaluation triggers pattern re-indexing."""
    try:
        await db[RAG_INDEX_STATE_COLLECTION].update_one(
            {"_id": "state"},
            {"$set": {"patterns_dirty": True, "updated_at": datetime.utcnow()}},
            upsert=True,
        )
    except Exception as exc:
        print(f"[RAG] mark_patterns_dirty failed: {exc}")


async def _mark_indexed(db, rules_count: int, model_version: int) -> None:
    try:
        await db[RAG_INDEX_STATE_COLLECTION].update_one(
            {"_id": "state"},
            {"$set": {
                "rules_dirty": False,
                "patterns_dirty": False,
                "last_indexed_at": datetime.utcnow(),
                "rules_count": rules_count,
                "model_version": model_version,
            }},
            upsert=True,
        )
    except Exception as exc:
        print(f"[RAG] _mark_indexed failed: {exc}")


async def _needs_reindex(db) -> dict:
    """Return which corpora need re-indexing."""
    try:
        state = await db[RAG_INDEX_STATE_COLLECTION].find_one({"_id": "state"})
        if not state:
            return {"specs": True, "rules": True, "patterns": True}
        return {
            "specs": False,            # report-type specs are static, index once
            "rules": bool(state.get("rules_dirty", False)),
            "patterns": bool(state.get("patterns_dirty", False)),
            "never_indexed": state.get("last_indexed_at") is None,
        }
    except Exception:
        return {"specs": True, "rules": True, "patterns": True}


# ---------------------------------------------------------------------------
# Index freshness management
# ---------------------------------------------------------------------------

async def ensure_index_fresh(db) -> bool:
    """
    Check dirty flags and re-index stale corpora.
    Returns True if index is usable, False if RAG is unavailable.
    """
    if not settings.RAG_ENABLED:
        return False

    from app.services import rag_store
    if not rag_store.CHROMA_AVAILABLE:
        return False

    async with _reindex_lock:
        dirty = await _needs_reindex(db)
        never_indexed = dirty.get("never_indexed", False)

        # Verify Gemini API key is available
        if not settings.GEMINI_API_KEY:
            print("[RAG] No GEMINI_API_KEY — skipping index")
            return False

        rules_count = 0
        model_version = 0

        # Index report specs once (or if collection was wiped)
        if never_indexed or dirty.get("specs", False):
            await rag_store.index_report_type_specs(None)

        # Re-index rules if dirty
        if dirty.get("rules", False) or never_indexed:
            rules_count = await rag_store.index_quality_rules(db, None)

        # Re-index patterns if dirty
        if dirty.get("patterns", False) or never_indexed:
            await rag_store.index_learned_patterns(db, None)

        # Record index state
        try:
            from app.db.collections import AI_MODEL_STATE_COLLECTION
            state = await db[AI_MODEL_STATE_COLLECTION].find_one(
                {}, sort=[("created_at", -1)]
            )
            model_version = state.get("version", 0) if state else 0
        except Exception:
            pass

        await _mark_indexed(db, rules_count, model_version)

    return True


# ---------------------------------------------------------------------------
# Build RagContext for a task evaluation
# ---------------------------------------------------------------------------

async def build_rag_context(
    task_title: str,
    task_description: str,
    report_type: Optional[str],
    db,
) -> RagContext:
    """
    Main entry point called by qc_service.py.

    1. Ensure index is fresh (lazy re-index if needed)
    2. Embed the task query
    3. Retrieve relevant chunks from ChromaDB
    4. Format chunks into compact context strings
    5. Return RagContext

    Falls back gracefully: if anything fails, RagContext.fallback_used=True
    signals qc_service to use the old full-dump path.
    """
    if not settings.RAG_ENABLED:
        return RagContext(fallback_used=True)

    try:
        index_ok = await ensure_index_fresh(db)
        if not index_ok:
            return RagContext(fallback_used=True)
    except Exception as exc:
        print(f"[RAG] ensure_index_fresh error: {exc}")
        return RagContext(fallback_used=True)

    try:
        from app.services import rag_store

        query_text = f"{task_title}\n{task_description or ''}"

        chunks = await rag_store.retrieve_relevant_chunks(
            query_text=query_text,
            report_type_key=report_type,
            openai_client=None,   # unused — Gemini embedding is used internally
            n_rules=settings.RAG_RULES_TOP_K,
            n_patterns=settings.RAG_PATTERNS_TOP_K,
        )

        if chunks["fallback_used"]:
            return RagContext(fallback_used=True)

        return RagContext(
            report_spec_text=_format_report_spec(chunks["report_spec"], report_type),
            rules_text=_format_rules(chunks["rules"]),
            patterns_text=_format_patterns(chunks["patterns"]),
            rules_retrieved=len(chunks["rules"]),
            patterns_retrieved=len(chunks["patterns"]),
            fallback_used=False,
        )

    except Exception as exc:
        print(f"[RAG] build_rag_context error: {exc}")
        return RagContext(fallback_used=True)


# ---------------------------------------------------------------------------
# Chunk formatters
# ---------------------------------------------------------------------------

def _format_report_spec(chunks: list[dict], report_type_key: Optional[str]) -> str:
    if not chunks:
        return ""
    # Sort: description first, elements second
    ordered = sorted(chunks, key=lambda c: c["metadata"].get("sub_type", "") == "elements")
    lines = [c["text"] for c in ordered]
    header = f"\n\n=== REPORT TYPE SPECIFICATION ({report_type_key}) ===\n"
    return header + "\n\n".join(lines) + "\n=== END REPORT TYPE SPEC ==="


def _format_rules(chunks: list[dict]) -> str:
    if not chunks:
        return "No specific rules defined. Evaluate general quality."
    lines = []
    for chunk in chunks:
        meta = chunk["metadata"]
        category = meta.get("rule_category", "general").upper()
        rule_text = meta.get("rule_text") or chunk["text"]
        lines.append(f"- [{category}] {rule_text}")
    return "\n".join(lines)


def _format_patterns(chunks: list[dict]) -> str:
    if not chunks:
        return ""
    version = chunks[0]["metadata"].get("model_version", "?")
    lines = [c["text"] for c in chunks]
    header = f"\n\n=== TRAINED QUALITY MODEL (v{version}) — TOP RELEVANT PATTERNS ===\n"
    return header + "\n".join(f"- {l}" for l in lines) + "\n==="


# ---------------------------------------------------------------------------
# Rules-from-RAG helper (converts retrieved chunks back to dict format)
# ---------------------------------------------------------------------------

def rules_from_rag_chunks(chunks: list[dict]) -> list[dict]:
    """
    Convert RAG rule chunks back to the standard rules list format
    expected by _online_analyze_task().
    """
    result = []
    for chunk in chunks:
        meta = chunk["metadata"]
        result.append({
            "rule": meta.get("rule_text") or chunk["text"],
            "category": meta.get("rule_category", "general"),
            "is_active": True,
        })
    return result


# ---------------------------------------------------------------------------
# Startup warmup (called as background task from main.py)
# ---------------------------------------------------------------------------

async def warmup_rag(db) -> None:
    """
    Background warmup at server startup.
    Silently skips if OpenAI is not configured or ChromaDB unavailable.
    """
    if not settings.RAG_ENABLED:
        print("[RAG] RAG disabled via settings, skipping warmup")
        return
    if not settings.GEMINI_API_KEY:
        print("[RAG] No GEMINI_API_KEY — skipping RAG warmup (will use fallback)")
        return
    try:
        print("[RAG] Starting background index warmup…")
        ok = await ensure_index_fresh(db)
        if ok:
            print("[RAG] Index warmup complete ✓")
        else:
            print("[RAG] Index warmup skipped (ChromaDB unavailable)")
    except Exception as exc:
        print(f"[RAG] Warmup failed (non-fatal): {exc}")
