"""
File upload validation utilities.
Validates MIME type, file size, and filename format against project rules.
"""
import re
from fastapi import UploadFile, HTTPException
from typing import Dict, Any


# Maximum allowed read size: 100 MB hard cap regardless of rules
HARD_MAX_BYTES = 100 * 1024 * 1024

# MIME type aliases for common user-friendly names
MIME_ALIASES: Dict[str, str] = {
    "pdf":  "application/pdf",
    "png":  "image/png",
    "jpg":  "image/jpeg",
    "jpeg": "image/jpeg",
    "gif":  "image/gif",
    "webp": "image/webp",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "zip":  "application/zip",
    "txt":  "text/plain",
    "csv":  "text/csv",
    "mp4":  "video/mp4",
}


async def validate_upload(file: UploadFile, rules: Dict[str, Any]) -> bytes:
    """
    Validate an uploaded file against the project's upload rules.

    Args:
        file:  The uploaded file object
        rules: Dict from file_upload_rules collection (may be empty)

    Returns:
        File content as bytes

    Raises:
        HTTPException 400 on validation failure
    """
    max_mb    = rules.get("max_size_mb", 50)
    max_bytes = min(max_mb * 1024 * 1024, HARD_MAX_BYTES)

    # --- Read content ---
    content = await file.read()
    await file.seek(0)

    # --- Size check ---
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File size {len(content) // (1024*1024):.1f}MB exceeds the "
                   f"{max_mb}MB limit for this project."
        )

    # --- MIME type check ---
    allowed = rules.get("allowed_types", [])
    if allowed:
        # Normalise aliases (e.g. "pdf" → "application/pdf")
        normalised_allowed = {
            MIME_ALIASES.get(t.lower(), t.lower()) for t in allowed
        }
        uploaded_mime = (file.content_type or "").lower()
        if uploaded_mime not in normalised_allowed:
            friendly = ", ".join(allowed)
            raise HTTPException(
                status_code=400,
                detail=f"File type '{uploaded_mime}' is not allowed. "
                       f"Accepted types: {friendly}"
            )

    # --- Filename pattern check ---
    pattern = rules.get("naming_pattern")
    if pattern and file.filename:
        if not re.match(pattern, file.filename):
            hint = rules.get("naming_description") or f"Filename must match pattern: {pattern}"
            raise HTTPException(status_code=400, detail=hint)

    return content
