"""
RAG Admin Routes — /api/v1/rag

Admin endpoints for managing the ChromaDB vector index.
  GET  /rag/status   — index health and chunk counts
  POST /rag/index    — trigger manual full re-index
  DELETE /rag/index  — wipe and re-index from scratch
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.db.mongodb import get_database
from app.dependencies.auth import get_current_user
from app.dependencies.rbac import ensure_roles
from app.db.collections import RAG_INDEX_STATE_COLLECTION

router = APIRouter(prefix="/rag", tags=["RAG Admin"])


def _require_admin_or_qc(current_user: dict) -> None:
    ensure_roles(current_user, ["admin", "quality_control", "quality_manager"])


# ---------------------------------------------------------------------------
# GET /rag/status
# ---------------------------------------------------------------------------

@router.get("/status")
async def rag_status(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Return the current state of the RAG vector index.
    Shows chunk counts per type and last-indexed timestamp.
    """
    _require_admin_or_qc(current_user)

    from app.services import rag_store
    stats = rag_store.get_collection_stats()

    # Fetch last index state from MongoDB
    index_state = await db[RAG_INDEX_STATE_COLLECTION].find_one({"_id": "state"})
    last_indexed = None
    rules_dirty = True
    patterns_dirty = True

    if index_state:
        last_indexed = index_state.get("last_indexed_at")
        rules_dirty = index_state.get("rules_dirty", True)
        patterns_dirty = index_state.get("patterns_dirty", True)

    return {
        "chroma_available": stats.get("available", False),
        "total_chunks": stats.get("total", 0),
        "report_spec_chunks": stats.get("report_spec_chunks", 0),
        "quality_rule_chunks": stats.get("quality_rule_chunks", 0),
        "learned_pattern_chunks": stats.get("learned_pattern_chunks", 0),
        "last_indexed_at": last_indexed.isoformat() if last_indexed else None,
        "rules_dirty": rules_dirty,
        "patterns_dirty": patterns_dirty,
        "index_state": "stale" if (rules_dirty or patterns_dirty) else "fresh",
    }


# ---------------------------------------------------------------------------
# POST /rag/index
# ---------------------------------------------------------------------------

@router.post("/index", status_code=status.HTTP_202_ACCEPTED)
async def trigger_reindex(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Trigger a full re-index of all RAG corpora (rules + patterns + report specs).
    Returns immediately — indexing runs in the background.
    """
    _require_admin_or_qc(current_user)

    from app.services.rag_service import mark_rules_dirty, mark_patterns_dirty
    import asyncio

    # Mark everything dirty so ensure_index_fresh will re-index all corpora
    await mark_rules_dirty(db)
    await mark_patterns_dirty(db)

    # Run re-index as background task (non-blocking)
    async def _run():
        from app.services.rag_service import ensure_index_fresh
        try:
            await ensure_index_fresh(db)
            print("[RAG] Manual re-index complete")
        except Exception as exc:
            print(f"[RAG] Manual re-index failed: {exc}")

    asyncio.create_task(_run())

    return {
        "message": "Re-index triggered in background",
        "triggered_by": str(current_user.get("_id", "")),
        "triggered_at": datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# DELETE /rag/index
# ---------------------------------------------------------------------------

@router.delete("/index", status_code=status.HTTP_200_OK)
async def wipe_and_reindex(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Wipe the ChromaDB collection and re-index everything from scratch.
    Admin only.
    """
    ensure_roles(current_user, ["admin"])

    from app.services import rag_store
    from app.services.rag_service import mark_rules_dirty, mark_patterns_dirty
    import asyncio

    wiped = rag_store.wipe_collection()
    if not wiped:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ChromaDB not available or wipe failed",
        )

    # Reset index state in MongoDB
    await db[RAG_INDEX_STATE_COLLECTION].replace_one(
        {"_id": "state"},
        {
            "_id": "state",
            "rules_dirty": True,
            "patterns_dirty": True,
            "last_indexed_at": None,
            "wiped_at": datetime.utcnow(),
            "wiped_by": str(current_user.get("_id", "")),
        },
        upsert=True,
    )

    async def _run():
        from app.services.rag_service import ensure_index_fresh
        try:
            await ensure_index_fresh(db)
            print("[RAG] Wipe + re-index complete")
        except Exception as exc:
            print(f"[RAG] Wipe + re-index failed: {exc}")

    asyncio.create_task(_run())

    return {
        "message": "Collection wiped and re-index triggered in background",
        "wiped_by": str(current_user.get("_id", "")),
        "wiped_at": datetime.utcnow().isoformat(),
    }
