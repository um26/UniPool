"""
Custom exception classes for UniPool backend.
"""

class UniPoolException(Exception):
    """Base exception for all UniPool-specific errors."""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class AuthenticationException(UniPoolException):
    """Exception raised for authentication errors."""
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, status_code=401)


class ValidationException(UniPoolException):
    """Exception raised for validation errors."""
    def __init__(self, message: str = "Validation failed"):
        super().__init__(message, status_code=400)


class NotFoundException(UniPoolException):
    """Exception raised when a resource is not found."""
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)


class ConflictException(UniPoolException):
    """Exception raised when there's a conflict with current state."""
    def __init__(self, message: str = "Conflict with current state"):
        super().__init__(message, status_code=409)


class RateLimitException(UniPoolException):
    """Exception raised when rate limits are exceeded."""
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(message, status_code=429)