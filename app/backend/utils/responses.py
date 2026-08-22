"""
Standard response formatting utilities for UniPool backend.
"""

from typing import Any, Dict, List, Optional, TypeVar, Generic
from datetime import datetime

T = TypeVar('T')

def success_response(data: Any = None, message: str = "Success") -> Dict[str, Any]:
    """
    Create a standardized success response.

    Args:
        data: Optional data to include in the response
        message: Optional message to include

    Returns:
        Dictionary representing the success response
    """
    response = {
        "success": True,
        "message": message,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    if data is not None:
        response["data"] = data
    return response


def error_response(message: str, details: Optional[Any] = None, status_code: int = 500) -> Dict[str, Any]:
    """
    Create a standardized error response.

    Args:
        message: Error message
        details: Optional additional details about the error
        status_code: HTTP status code

    Returns:
        Dictionary representing the error response
    """
    response = {
        "success": False,
        "message": message,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "status_code": status_code
    }
    if details is not None:
        response["details"] = details
    return response


def paginated_response(
    items: List[T],
    total: int,
    page: int,
    size: int,
    message: str = "Success"
) -> Dict[str, Any]:
    """
    Create a standardized paginated response.

    Args:
        items: List of items for the current page
        total: Total number of items available
        page: Current page number (1-based)
        size: Number of items per page
        message: Optional message to include

    Returns:
        Dictionary representing the paginated response
    """
    pages = (total + size - 1) // size  # Ceiling division
    return {
        "success": True,
        "message": message,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "pagination": {
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
            "has_next": page < pages,
            "has_prev": page > 1
        },
        "data": items
    }