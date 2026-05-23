from fastapi import APIRouter, Depends
from bson import ObjectId
from app.db.mongodb import get_database
from app.dependencies.auth import get_current_user
from app.db.collections import TASKS_COLLECTION

router = APIRouter(prefix="/ai", tags=["AI"])

@router.get("/history")
async def get_ai_history(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Fetch tasks where aiScore != null, sorted by updatedAt DESC.
    Limit to last 10 items.
    """
    query = {"aiScore": {"$ne": None}}
    
    if "admin" not in current_user.get("roles", []) and current_user.get("role") not in ["admin", "founder"]:
        # Try to parse user ID, could be '_id' or 'sub' depending on auth
        user_id_str = str(current_user.get("_id") or current_user.get("sub", ""))
        user_oid = None
        if ObjectId.is_valid(user_id_str):
            user_oid = ObjectId(user_id_str)
            
        if user_oid:
            query["$or"] = [
                {"created_by": user_oid},
                {"assigned_to": user_oid},
                {"assignees": user_oid}
            ]
        
    tasks = await db[TASKS_COLLECTION].find(query).sort("updated_at", -1).limit(10).to_list(length=10)
    
    history = []
    for t in tasks:
        history.append({
            "taskId": str(t["_id"]),
            "taskTitle": t.get("title", "Untitled Task"),
            "score": t.get("aiScore", 0),
            "status": t.get("status", "Unknown"),
            "timestamp": t.get("updated_at").isoformat() if t.get("updated_at") else None
        })
        
    return history
