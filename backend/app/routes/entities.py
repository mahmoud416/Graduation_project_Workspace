"""
Entities API routes.
Restricted strictly to the Founder role.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from typing import List

from app.schemas.entity import EntityCreate, AssignITStaffRequest, EntityResponse
from app.models.entity import EntityModel
from app.dependencies.rbac import require_founder
from app.db.mongodb import get_database
from app.db.collections import ENTITIES_COLLECTION, USERS_COLLECTION


router = APIRouter(prefix="/entities", tags=["Entities"])


@router.get("", response_model=List[EntityResponse])
async def get_entities(
    current_user=Depends(require_founder),
    db=Depends(get_database)
):
    """Get all entities. ONLY Founders can do this."""
    entities = await db[ENTITIES_COLLECTION].find().to_list(length=None)
    for ent in entities:
        ent["_id"] = str(ent["_id"])
        ent["founder_id"] = str(ent["founder_id"])
        ent["it_staff_ids"] = [str(uid) for uid in ent.get("it_staff_ids", [])]
        ent["team_ids"] = [str(tid) for tid in ent.get("team_ids", [])]
        ent["quality_framework_ids"] = [str(qid) for qid in ent.get("quality_framework_ids", [])]
    return entities


@router.post("", response_model=EntityResponse, status_code=status.HTTP_201_CREATED)
async def create_entity(
    entity_data: EntityCreate,
    current_user=Depends(require_founder),
    db=Depends(get_database)
):
    """
    Create a new entity (organization).
    ONLY Founders can create entities.
    """
    # Check if entity name already exists
    existing = await db[ENTITIES_COLLECTION].find_one({"name": entity_data.name.strip()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Entity with this name already exists"
        )
    
    qf_ids = []
    if entity_data.quality_framework_ids:
        for qid in entity_data.quality_framework_ids:
            try:
                qf_ids.append(ObjectId(qid))
            except:
                pass

    doc = EntityModel.create_document(
        name=entity_data.name,
        founder_id=current_user["_id"],
        description=entity_data.description or "",
        quality_framework_ids=qf_ids,
        subscription_tier=entity_data.subscription_tier or "Basic",
        max_teams=50 if entity_data.subscription_tier == "Enterprise" else (15 if entity_data.subscription_tier == "Pro" else 5),
        ai_quota=50000 if entity_data.subscription_tier == "Enterprise" else (10000 if entity_data.subscription_tier == "Pro" else 1000),
        quality_system=entity_data.quality_system or current_user.get("quality_system"),
    )
    
    result = await db[ENTITIES_COLLECTION].insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["founder_id"] = str(doc["founder_id"])
    doc["it_staff_ids"] = [str(uid) for uid in doc["it_staff_ids"]]
    doc["team_ids"] = [str(tid) for tid in doc["team_ids"]]
    doc["quality_framework_ids"] = [str(qid) for qid in doc["quality_framework_ids"]]
    
    return doc


@router.post("/{entity_id}/assign-it", response_model=EntityResponse)
async def assign_it_staff(
    entity_id: str,
    payload: AssignITStaffRequest,
    current_user=Depends(require_founder),
    db=Depends(get_database)
):
    """
    Assign IT Staff to an entity.
    ONLY Founders can do this.
    """
    try:
        ent_obj_id = ObjectId(entity_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid entity ID")
        
    entity = await db[ENTITIES_COLLECTION].find_one({"_id": ent_obj_id})
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
        
    if entity["founder_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to manage this entity")

    # Validate staff IDs
    staff_obj_ids = []
    for sid in payload.it_staff_ids:
        try:
            staff_obj_ids.append(ObjectId(sid))
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid user ID: {sid}")

    # Check if they exist and are actually IT staff
    for sid in staff_obj_ids:
        user = await db[USERS_COLLECTION].find_one({"_id": sid})
        if not user:
            raise HTTPException(status_code=404, detail=f"User {sid} not found")
        if "it" not in user.get("roles", []) and user.get("role") != "it":
            raise HTTPException(status_code=400, detail=f"User {sid} is not an IT staff member")
            
    # Update entity
    result = await db[ENTITIES_COLLECTION].find_one_and_update(
        {"_id": ent_obj_id},
        {"$addToSet": {"it_staff_ids": {"$each": staff_obj_ids}}},
        return_document=True
    )
    
    result["_id"] = str(result["_id"])
    result["founder_id"] = str(result["founder_id"])
    result["it_staff_ids"] = [str(uid) for uid in result["it_staff_ids"]]
    result["team_ids"] = [str(tid) for tid in result["team_ids"]]
    
    return result
