"""
Quality Framework model for MongoDB.
"""
from datetime import datetime
from typing import Optional


class QualityFrameworkModel:
    @staticmethod
    def create_document(
        name: str,
        description: str,
        ai_prompt_template: str,
        acceptance_threshold: int = 70,
        is_active: bool = True
    ) -> dict:
        return {
            "name": name,
            "description": description,
            "ai_prompt_template": ai_prompt_template,
            "acceptance_threshold": acceptance_threshold,
            "is_active": is_active,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
