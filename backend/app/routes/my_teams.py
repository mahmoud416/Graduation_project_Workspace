"""
"My Teams" endpoints — self-service views for any authenticated user.

These routes let a logged-in user query the teams they personally belong to
and see all other members of those teams.  No elevated role is required; the
data is scoped to the requesting user's own memberships, so there is no
cross-team information leakage.
"""
from typing import Any, Dict, List

from bson import ObjectId
from fastapi import APIRouter, Depends

from app.db.collections import MEMBERSHIPS_COLLECTION, TEAMS_COLLECTION, USERS_COLLECTION
from app.db.mongodb import get_database
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/my-teams", tags=["My Teams"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _str(v: Any) -> str | None:
    """Convert ObjectId (or None) to string."""
    return str(v) if v is not None else None


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("", summary="List all teams the current user belongs to")
async def my_teams(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db=Depends(get_database),
) -> List[dict]:
    """
    Return every team the authenticated user is a member of, along with that
    team's basic metadata (name, description).

    Used by the frontend to populate team selectors and navigation badges
    without requiring the user to know their team IDs in advance.
    """
    user_id = current_user["_id"]

    # Find all membership records for this user
    memberships = (
        await db[MEMBERSHIPS_COLLECTION]
        .find({"user_id": user_id})
        .to_list(length=None)
    )

    if not memberships:
        return []

    team_ids = list({m["team_id"] for m in memberships if m.get("team_id")})

    # Fetch team documents in one round-trip
    teams_cursor = db[TEAMS_COLLECTION].find({"_id": {"$in": team_ids}})
    teams_map: Dict[ObjectId, dict] = {}
    async for t in teams_cursor:
        teams_map[t["_id"]] = t

    # Build a membership lookup keyed by team_id for this user
    my_role: Dict[ObjectId, str] = {
        m["team_id"]: m.get("role", "member")
        for m in memberships
        if m.get("team_id")
    }

    result = []
    for tid in team_ids:
        team_doc = teams_map.get(tid, {})
        result.append({
            "team_id":     _str(tid),
            "name":        team_doc.get("name", "—"),
            "description": team_doc.get("description", ""),
            "my_role":     my_role.get(tid, "member"),
        })

    # Sort alphabetically by team name for a consistent UI order
    result.sort(key=lambda x: x["name"].lower())
    return result


@router.get("/members", summary="All members across all teams the current user belongs to")
async def my_teams_members(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db=Depends(get_database),
) -> List[dict]:
    """
    Return every member of every team the authenticated user belongs to,
    grouped by team.

    Algorithm (all MongoDB, no N+1 queries):
      1. Find all memberships where user_id == current_user._id  → get team IDs
      2. Find all memberships where team_id IN those team IDs     → peer members
      3. Batch-resolve user profiles (name, email, role, status)  → users lookup
      4. Batch-resolve team names                                  → teams lookup
      5. Group by team and return

    The current user appears in the result as a member of their own teams,
    which allows the frontend to highlight "you" in the list.
    """
    user_id = current_user["_id"]

    # ── 1. Find teams this user belongs to ────────────────────────────────────
    my_memberships = (
        await db[MEMBERSHIPS_COLLECTION]
        .find({"user_id": user_id})
        .to_list(length=None)
    )

    if not my_memberships:
        return []

    team_ids = list({m["team_id"] for m in my_memberships if m.get("team_id")})

    # ── 2. Find all memberships in those teams ────────────────────────────────
    all_memberships = (
        await db[MEMBERSHIPS_COLLECTION]
        .find({"team_id": {"$in": team_ids}})
        .to_list(length=None)
    )

    # ── 3. Batch-resolve user profiles ────────────────────────────────────────
    peer_user_ids = list({m["user_id"] for m in all_memberships if m.get("user_id")})
    users_map: Dict[ObjectId, dict] = {}
    if peer_user_ids:
        async for u in db[USERS_COLLECTION].find(
            {"_id": {"$in": peer_user_ids}},
            {"name": 1, "email": 1, "role": 1, "status": 1, "last_seen": 1},
        ):
            users_map[u["_id"]] = u

    # ── 4. Batch-resolve team names ───────────────────────────────────────────
    teams_map: Dict[ObjectId, dict] = {}
    async for t in db[TEAMS_COLLECTION].find(
        {"_id": {"$in": team_ids}},
        {"name": 1, "description": 1},
    ):
        teams_map[t["_id"]] = t

    # ── 5. Group by team ──────────────────────────────────────────────────────
    # Build a set of team_ids this user is in (for quick lookup)
    my_team_id_set = {m["team_id"] for m in my_memberships}

    groups: Dict[ObjectId, dict] = {}
    for m in all_memberships:
        tid = m.get("team_id")
        if tid not in my_team_id_set:
            continue  # safety guard — should not happen given the query above

        if tid not in groups:
            team_doc = teams_map.get(tid, {})
            groups[tid] = {
                "team_id":     _str(tid),
                "team_name":   team_doc.get("name", "—"),
                "description": team_doc.get("description", ""),
                "members":     [],
            }

        uid = m.get("user_id")
        user_doc = users_map.get(uid, {}) if uid else {}

        groups[tid]["members"].append({
            "user_id":    _str(uid),
            "name":       user_doc.get("name", "Unknown"),
            "email":      user_doc.get("email", ""),
            "role":       m.get("role", "member"),        # membership role (admin/sub_manager/staff)
            "system_role": user_doc.get("role", "staff"), # global system role
            "status":     user_doc.get("status", "active"),
            "last_seen":  user_doc.get("last_seen"),
            "is_me":      (uid == user_id),
        })

    # Sort members inside each team: current user first, then by name
    for group in groups.values():
        group["members"].sort(key=lambda x: (not x["is_me"], x["name"].lower()))

    # Sort teams alphabetically
    sorted_groups = sorted(groups.values(), key=lambda x: x["team_name"].lower())
    return sorted_groups
