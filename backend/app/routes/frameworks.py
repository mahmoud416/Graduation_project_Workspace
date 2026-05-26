"""
Quality Framework routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime
from bson import ObjectId

from app.db.mongodb import get_database
from app.db.collections import QUALITY_FRAMEWORKS_COLLECTION
from app.schemas.quality_framework import QualityFrameworkCreate, QualityFrameworkUpdate, QualityFrameworkResponse
from app.models.quality_framework import QualityFrameworkModel
from app.dependencies.rbac import require_founder

router = APIRouter()

@router.get("/", response_model=List[QualityFrameworkResponse])
async def list_frameworks(db=Depends(get_database), current_user=Depends(require_founder)):
    """List all quality frameworks. Only founders can access this."""
    frameworks = await db[QUALITY_FRAMEWORKS_COLLECTION].find().to_list(length=None)
    for fw in frameworks:
        fw["_id"] = str(fw["_id"])
    return frameworks

@router.post("/", response_model=QualityFrameworkResponse, status_code=status.HTTP_201_CREATED)
async def create_framework(
    framework: QualityFrameworkCreate,
    db=Depends(get_database),
    current_user=Depends(require_founder)
):
    """Create a new quality framework. Only founders can access this."""
    doc = QualityFrameworkModel.create_document(
        name=framework.name,
        description=framework.description,
        ai_prompt_template=framework.ai_prompt_template,
        acceptance_threshold=framework.acceptance_threshold,
        is_active=framework.is_active
    )
    result = await db[QUALITY_FRAMEWORKS_COLLECTION].insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc

@router.get("/{framework_id}", response_model=QualityFrameworkResponse)
async def get_framework(framework_id: str, db=Depends(get_database), current_user=Depends(require_founder)):
    """Get a specific quality framework."""
    try:
        obj_id = ObjectId(framework_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid framework ID")
    
    fw = await db[QUALITY_FRAMEWORKS_COLLECTION].find_one({"_id": obj_id})
    if not fw:
        raise HTTPException(status_code=404, detail="Framework not found")
    fw["_id"] = str(fw["_id"])
    return fw

@router.patch("/{framework_id}", response_model=QualityFrameworkResponse)
async def update_framework(
    framework_id: str,
    update_data: QualityFrameworkUpdate,
    db=Depends(get_database),
    current_user=Depends(require_founder)
):
    """Update a specific quality framework."""
    try:
        obj_id = ObjectId(framework_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid framework ID")
    
    update_dict = {k: v for k, v in update_data.dict(exclude_unset=True).items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_dict["updated_at"] = datetime.utcnow()
    
    result = await db[QUALITY_FRAMEWORKS_COLLECTION].find_one_and_update(
        {"_id": obj_id},
        {"$set": update_dict},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Framework not found")
    
    result["_id"] = str(result["_id"])
    return result
