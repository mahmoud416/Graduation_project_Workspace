"""
RAG Store — ChromaDB adapter.

Responsibilities:
  - Embed text using Google Gemini text-embedding-004
  - Index three corpora into ChromaDB:
      A) Report type specs   (static, from REPORT_TYPES dict)
      B) Quality rules        (dynamic, from MongoDB)
      C) Learned patterns     (dynamic, from AI model state)
  - Retrieve top-K relevant chunks for a query

All public functions return gracefully on failure (CHROMA_AVAILABLE guard).
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

from app.core.config import settings
from app.db.collections import QUALITY_RULES_COLLECTION, AI_MODEL_STATE_COLLECTION

# ---------------------------------------------------------------------------
# ChromaDB availability guard
# ---------------------------------------------------------------------------

try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False

COLLECTION_NAME = "qc_rag_v1"

# ---------------------------------------------------------------------------
# Client singleton (lazy)
# ---------------------------------------------------------------------------

_chroma_client = None


def _get_client():
    global _chroma_client
    if _chroma_client is not None:
        return _chroma_client
    if not CHROMA_AVAILABLE:
        return None
    try:
        os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        return _chroma_client
    except Exception as exc:
        print(f"[RAG] ChromaDB client init failed: {exc}")
        return None


def _get_collection():
    client = _get_client()
    if client is None:
        return None
    try:
        return client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    except Exception as exc:
        print(f"[RAG] Could not get/create collection: {exc}")
        return None


# ---------------------------------------------------------------------------
# Embedding helper
# ---------------------------------------------------------------------------

async def _embed_texts(texts: list[str], _client=None) -> list[list[float]]:
    """
    Embed a batch of texts using Google Gemini text-embedding-004.
    The _client parameter is kept for signature compatibility but unused.
    Gemini embedding API is synchronous — we run it in an executor.
    """
    import asyncio
    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)

    def _sync_embed(batch: list[str]) -> list[list[float]]:
        results = []
        for text in batch:
            result = genai.embed_content(
                model=settings.EMBEDDING_MODEL,
                content=text,
                task_type="retrieval_document",
            )
            results.append(result["embedding"])
        return results

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _sync_embed, texts)


# ---------------------------------------------------------------------------
# Corpus A — Report type specs
# ---------------------------------------------------------------------------

async def index_report_type_specs(openai_client) -> int:
    """
    Index all 18 report types as chunks.
    Each report type → 2 chunks:
      - description chunk
      - required_elements chunk (numbered list)
    Returns number of chunks indexed, or 0 on failure.
    """
    collection = _get_collection()
    if collection is None:
        return 0

    # Import here to avoid circular dependency
    from app.services.qc_service import REPORT_TYPES

    docs, ids, metas = [], [], []
    now = datetime.utcnow().isoformat()

    for key, rt in REPORT_TYPES.items():
        # Chunk 1: description
        desc_text = (
            f"Report type: {rt['name_ar']} ({rt['name_en']})\n"
            f"Description: {rt['description']}"
        )
        docs.append(desc_text)
        ids.append(f"report_spec__{key}__description")
        metas.append({
            "chunk_type": "report_spec",
            "sub_type": "description",
            "report_type_key": key,
            "name_ar": rt["name_ar"],
            "name_en": rt["name_en"],
            "indexed_at": now,
        })

        # Chunk 2: required elements
        elements_text = (
            f"Report type: {rt['name_ar']} ({rt['name_en']})\n"
            "Required elements that MUST be present:\n"
            + "\n".join(f"{i+1}. {e}" for i, e in enumerate(rt["required_elements"]))
        )
        docs.append(elements_text)
        ids.append(f"report_spec__{key}__elements")
        metas.append({
            "chunk_type": "report_spec",
            "sub_type": "elements",
            "report_type_key": key,
            "name_ar": rt["name_ar"],
            "name_en": rt["name_en"],
            "indexed_at": now,
        })

    try:
        embeddings = await _embed_texts(docs, openai_client)
        collection.upsert(documents=docs, embeddings=embeddings, ids=ids, metadatas=metas)
        print(f"[RAG] Indexed {len(docs)} report-spec chunks")
        return len(docs)
    except Exception as exc:
        print(f"[RAG] index_report_type_specs failed: {exc}")
        return 0


# ---------------------------------------------------------------------------
# Corpus B — Quality rules
# ---------------------------------------------------------------------------

async def index_quality_rules(db, openai_client) -> int:
    """
    Index all active quality rules from MongoDB.
    Each rule → 1 chunk.
    Uses rule ObjectId as chunk ID so re-indexing is safe (upsert).
    Returns number of chunks indexed, or 0 on failure.
    """
    collection = _get_collection()
    if collection is None:
        return 0

    try:
        rules = await db[QUALITY_RULES_COLLECTION].find({"is_active": True}).to_list(length=1000)
    except Exception as exc:
        print(f"[RAG] Failed to fetch rules from MongoDB: {exc}")
        return 0

    if not rules:
        return 0

    docs, ids, metas = [], [], []
    now = datetime.utcnow().isoformat()

    for rule in rules:
        rule_id = str(rule["_id"])
        category = rule.get("category", "general")
        rule_text = rule.get("rule", "")
        chunk_text = f"[{category.upper()}] Quality rule: {rule_text}"

        docs.append(chunk_text)
        ids.append(f"quality_rule__{rule_id}")
        metas.append({
            "chunk_type": "quality_rule",
            "rule_id": rule_id,
            "rule_category": category,
            "rule_text": rule_text[:500],
            "indexed_at": now,
        })

    try:
        # Embed in batches of 100 to stay within API limits
        all_embeddings = []
        batch_size = 100
        for i in range(0, len(docs), batch_size):
            batch = docs[i: i + batch_size]
            batch_embeddings = await _embed_texts(batch, openai_client)
            all_embeddings.extend(batch_embeddings)

        collection.upsert(documents=docs, embeddings=all_embeddings, ids=ids, metadatas=metas)
        print(f"[RAG] Indexed {len(docs)} quality-rule chunks")
        return len(docs)
    except Exception as exc:
        print(f"[RAG] index_quality_rules failed: {exc}")
        return 0


# ---------------------------------------------------------------------------
# Corpus C — Learned patterns
# ---------------------------------------------------------------------------

async def index_learned_patterns(db, openai_client) -> int:
    """
    Index patterns from the latest trained AI model state.
    Each pattern → 1 chunk.
    Returns number of chunks indexed, or 0 on failure.
    """
    collection = _get_collection()
    if collection is None:
        return 0

    try:
        state = await db[AI_MODEL_STATE_COLLECTION].find_one(
            {}, sort=[("created_at", -1)]
        )
    except Exception as exc:
        print(f"[RAG] Failed to fetch model state: {exc}")
        return 0

    if not state or not state.get("patterns"):
        return 0

    patterns = state["patterns"]
    model_version = state.get("version", 0)
    now = datetime.utcnow().isoformat()

    # Remove old pattern chunks for previous versions
    try:
        collection.delete(where={"chunk_type": "learned_pattern"})
    except Exception:
        pass

    docs, ids, metas = [], [], []
    for i, pattern in enumerate(patterns):
        chunk_text = f"Learned quality pattern (v{model_version}): {pattern}"
        docs.append(chunk_text)
        ids.append(f"learned_pattern__v{model_version}__{i}")
        metas.append({
            "chunk_type": "learned_pattern",
            "model_version": model_version,
            "pattern_index": i,
            "indexed_at": now,
        })

    try:
        embeddings = await _embed_texts(docs, openai_client)
        collection.upsert(documents=docs, embeddings=embeddings, ids=ids, metadatas=metas)
        print(f"[RAG] Indexed {len(docs)} learned-pattern chunks (model v{model_version})")
        return len(docs)
    except Exception as exc:
        print(f"[RAG] index_learned_patterns failed: {exc}")
        return 0


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

async def retrieve_relevant_chunks(
    query_text: str,
    report_type_key: Optional[str],
    openai_client,
    n_rules: int = 8,
    n_patterns: int = 4,
) -> dict:
    """
    Retrieve relevant chunks for a given query.

    Strategy:
      - Report spec: deterministic fetch by metadata filter (exact, always included)
      - Rules: top-N by cosine similarity
      - Patterns: top-M by cosine similarity

    Returns:
        {
          "report_spec": [{"text": str, "metadata": dict}],
          "rules":       [{"text": str, "metadata": dict, "distance": float}],
          "patterns":    [{"text": str, "metadata": dict, "distance": float}],
          "fallback_used": False,
        }
    """
    empty = {"report_spec": [], "rules": [], "patterns": [], "fallback_used": True}
    collection = _get_collection()
    if collection is None:
        return empty

    try:
        # 1. Embed the query (task_type=retrieval_query for search)
        import asyncio
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)

        def _embed_query(text: str) -> list[float]:
            result = genai.embed_content(
                model=settings.EMBEDDING_MODEL,
                content=text,
                task_type="retrieval_query",
            )
            return result["embedding"]

        loop = asyncio.get_running_loop()
        query_embedding = await loop.run_in_executor(None, _embed_query, query_text)

        # 2. Report spec — deterministic: fetch by metadata filter
        report_spec_chunks = []
        if report_type_key:
            try:
                spec_results = collection.get(
                    where={"$and": [
                        {"chunk_type": {"$eq": "report_spec"}},
                        {"report_type_key": {"$eq": report_type_key}},
                    ]},
                    include=["documents", "metadatas"],
                )
                for doc, meta in zip(
                    spec_results.get("documents", []),
                    spec_results.get("metadatas", []),
                ):
                    report_spec_chunks.append({"text": doc, "metadata": meta})
            except Exception as exc:
                print(f"[RAG] Report spec fetch failed: {exc}")

        # 3. Rules — semantic similarity
        rule_chunks = []
        try:
            rule_results = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(n_rules, _count_by_type(collection, "quality_rule")),
                where={"chunk_type": {"$eq": "quality_rule"}},
                include=["documents", "metadatas", "distances"],
            )
            for doc, meta, dist in zip(
                rule_results["documents"][0],
                rule_results["metadatas"][0],
                rule_results["distances"][0],
            ):
                rule_chunks.append({"text": doc, "metadata": meta, "distance": dist})
        except Exception as exc:
            print(f"[RAG] Rules similarity search failed: {exc}")

        # 4. Patterns — semantic similarity
        pattern_chunks = []
        try:
            pattern_count = _count_by_type(collection, "learned_pattern")
            if pattern_count > 0:
                pattern_results = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=min(n_patterns, pattern_count),
                    where={"chunk_type": {"$eq": "learned_pattern"}},
                    include=["documents", "metadatas", "distances"],
                )
                for doc, meta, dist in zip(
                    pattern_results["documents"][0],
                    pattern_results["metadatas"][0],
                    pattern_results["distances"][0],
                ):
                    pattern_chunks.append({"text": doc, "metadata": meta, "distance": dist})
        except Exception as exc:
            print(f"[RAG] Patterns similarity search failed: {exc}")

        return {
            "report_spec": report_spec_chunks,
            "rules": rule_chunks,
            "patterns": pattern_chunks,
            "fallback_used": False,
        }

    except Exception as exc:
        print(f"[RAG] retrieve_relevant_chunks failed entirely: {exc}")
        return empty


def _count_by_type(collection, chunk_type: str) -> int:
    """Count documents of a given chunk_type in the collection."""
    try:
        result = collection.get(
            where={"chunk_type": {"$eq": chunk_type}},
            include=[],
        )
        return len(result.get("ids", []))
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# Collection stats (for admin endpoint)
# ---------------------------------------------------------------------------

def get_collection_stats() -> dict:
    """Return chunk counts per type for the admin status endpoint."""
    collection = _get_collection()
    if collection is None:
        return {"available": False, "total": 0}

    try:
        total = collection.count()
        return {
            "available": True,
            "total": total,
            "report_spec_chunks": _count_by_type(collection, "report_spec"),
            "quality_rule_chunks": _count_by_type(collection, "quality_rule"),
            "learned_pattern_chunks": _count_by_type(collection, "learned_pattern"),
        }
    except Exception as exc:
        return {"available": False, "error": str(exc)}


def wipe_collection() -> bool:
    """Delete and recreate the collection. Returns True on success."""
    client = _get_client()
    if client is None:
        return False
    try:
        client.delete_collection(COLLECTION_NAME)
        client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        print("[RAG] Collection wiped and recreated")
        return True
    except Exception as exc:
        print(f"[RAG] wipe_collection failed: {exc}")
        return False
