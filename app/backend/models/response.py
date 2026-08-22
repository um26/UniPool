"""
Common response models used across the API.
"""

from pydantic import BaseModel, Field
from typing import Generic, TypeVar, List, Optional
from datetime import datetime

# Generic type variable for paginated responses
T = TypeVar('T')

class BaseResponse(BaseModel):
    """Base response model"""
    ok: bool = True

class PaginatedResponse(BaseResponse, Generic[T]):
    """Paginated response model"""
    items: List[T]
    total: int
    page: int
    size: int
    pages: int

class IDResponse(BaseResponse):
    """Response returning an ID"""
    id: str

class MessageResponse(BaseResponse):
    """Response returning a message"""
    message: str

# Health check response
class HealthResponse(BaseResponse):
    """Health check response"""
    status: str = "ok"
    timestamp: datetime = Field(default_factory=datetime.utcnow)