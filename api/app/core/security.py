import asyncio
import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.core.config import settings


class SlidingWindowRateLimiter:
    """
    Thread-safe & Async-safe in-memory sliding window rate limiter.
    Limits requests per client IP within a rolling 60-second window.
    """
    def __init__(self, requests_per_minute: int = 60):
        self.rpm = requests_per_minute
        self.window = 60.0  # seconds
        self._history: Dict[str, List[float]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def is_allowed(self, client_ip: str) -> Tuple[bool, int]:
        now = time.monotonic()
        async with self._lock:
            # Purge timestamps older than the rolling window
            cutoff = now - self.window
            timestamps = [t for t in self._history[client_ip] if t > cutoff]
            self._history[client_ip] = timestamps

            if len(timestamps) >= self.rpm:
                oldest = timestamps[0]
                retry_after = max(1, int(self.window - (now - oldest)))
                return False, retry_after

            self._history[client_ip].append(now)
            return True, 0

    async def reset(self):
        """Reset history, useful in test suites."""
        async with self._lock:
            self._history.clear()


rate_limiter = SlidingWindowRateLimiter(requests_per_minute=settings.RATE_LIMIT_PER_MINUTE)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Injects enterprise security headers into all responses:
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY (anti-clickjacking)
    - X-XSS-Protection: 1; mode=block
    - Referrer-Policy: strict-origin-when-cross-origin
    - Strict-Transport-Security: max-age=31536000
    """
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Enforces per-IP sliding window rate limiting on API endpoints to prevent
    denial-of-service and downstream LLM API quota exhaustion.
    """
    EXEMPT_PATHS = {"/docs", "/redoc", "/openapi.json", "/api/health", "/api/health/ready", "/"}

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path in self.EXEMPT_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "127.0.0.1"

        allowed, retry_after = await rate_limiter.is_allowed(client_ip)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down and try again later."},
                headers={"Retry-After": str(retry_after)}
            )

        return await call_next(request)
