"""
Quality Control Analysis model for MongoDB.
Stores AI analysis results for task evaluations.
"""
from datetime import datetime
from typing import List, Optional


class QCAnalysisModel:
    """QC Analysis document structure for MongoDB."""

    @staticmethod
    def create_document(
        analyzed_by: str,
        task_id: str,
        project_id: str,
        task_title: str,
        task_description: str,
        compliance_score: float,
        passed_standards: List[dict],
        failed_standards: List[dict],
        suggestions: List[str],
        ai_raw_response: str,
        standards_applied: Optional[List[str]] = None,
        files_analyzed: Optional[List[dict]] = None,
        model_used: str = "gpt-4o",
    ) -> dict:
        """Create a new QC analysis document."""
        return {
            "analyzed_by":      analyzed_by,
            "task_id":          task_id,
            "project_id":       project_id,
            "task_title":       task_title,
            "task_description": task_description,
            "standards_applied": standards_applied or [],
            "compliance_score": compliance_score,
            "passed_standards": passed_standards,
            # Each item: {standard_id, rule, result}
            "failed_standards": failed_standards,
            # Each item: {standard_id, rule, reason}
            "suggestions":      suggestions,
            "ai_raw_response":  ai_raw_response,
            "files_analyzed":   files_analyzed or [],
            # Each item: {file_name, file_type, analysis_result}
            "model_used":       model_used,
            "created_at":       datetime.utcnow(),
        }
