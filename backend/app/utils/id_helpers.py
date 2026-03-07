"""ObjectId / string conversion helpers."""
from bson import ObjectId
from typing import Any


def to_str(value: Any) -> str:
    """Convert any ObjectId or value to string."""
    if value is None:
        return ""
    return str(value)


def to_object_id(value: str) -> ObjectId:
    """Convert a string to ObjectId, raising ValueError on failure."""
    if not ObjectId.is_valid(value):
        raise ValueError(f"'{value}' is not a valid ObjectId")
    return ObjectId(value)


def maybe_object_id(value: Any) -> Any:
    """Return ObjectId if value looks like one, otherwise return as-is."""
    if value is None:
        return None
    s = str(value).strip()
    if len(s) == 24 and ObjectId.is_valid(s):
        return ObjectId(s)
    return s
