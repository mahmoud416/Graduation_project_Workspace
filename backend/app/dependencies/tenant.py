"""
Multi-tenant scoping helpers.

`tenant_id` is a FILTER dimension only — it is never part of any document _id.
Every institution (rooted at an IT account) has its own tenant_id. Reads are
scoped to the caller's tenant so one institution's data is invisible to another.
The Founder is global and bypasses all tenant scoping.
"""
from typing import Any, Dict, Optional


def is_founder(user: Optional[Dict[str, Any]]) -> bool:
    if not user:
        return False
    return (user.get("role") or "").strip().lower() == "founder"


def tenant_filter(user: Dict[str, Any], field: str = "tenant_id") -> Dict[str, Any]:
    """
    Return a MongoDB filter fragment scoping a query to the caller's tenant.

    - Founder → {} (sees everything).
    - User with a tenant_id → {field: tenant_id}.
    - User without a tenant_id → {} (legacy/unscoped — preserves pre-isolation behavior).
    """
    if is_founder(user):
        return {}
    tid = user.get("tenant_id")
    if not tid:
        return {}
    return {field: tid}


def scope_query(user: Dict[str, Any], query: Dict[str, Any], field: str = "tenant_id") -> Dict[str, Any]:
    """Merge the caller's tenant filter into an existing query dict (non-mutating)."""
    tf = tenant_filter(user, field)
    if not tf:
        return query
    merged = dict(query)
    merged.update(tf)
    return merged
