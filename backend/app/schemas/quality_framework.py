"""
Pydantic schemas for Quality Frameworks.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class QualityFrameworkCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., max_length=1000)
    ai_prompt_template: str = Field(..., min_length=10)
    acceptance_threshold: int = Field(default=70, ge=0, le=100)
    is_active: bool = True

class QualityFrameworkUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    ai_prompt_template: Optional[str] = Field(None, min_length=10)
    acceptance_threshold: Optional[int] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None

class QualityFrameworkResponse(BaseModel):
    id: str = Field(..., alias="_id")
    name: str
    description: Optional[str] = ""
    ai_prompt_template: Optional[str] = ""
    acceptance_threshold: Optional[int] = 70
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        extra = "ignore"
