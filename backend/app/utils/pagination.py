"""Pagination helpers for list endpoints."""
from fastapi import Query


class PaginationParams:
    """Dependency for page/page_size query parameters."""

    def __init__(
        self,
        page:      int = Query(default=1,  ge=1,            description="Page number (1-based)"),
        page_size: int = Query(default=20, ge=1,   le=100,  description="Items per page"),
    ):
        self.skip      = (page - 1) * page_size
        self.limit     = page_size
        self.page      = page
        self.page_size = page_size

    def to_response_meta(self, total: int) -> dict:
        return {
            "page":       self.page,
            "page_size":  self.page_size,
            "total":      total,
            "pages":      max(1, (total + self.page_size - 1) // self.page_size),
        }
