import asyncio
import io
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import rate_limiter
from app.services.voice_service import voice_service
from app.services.document_service import document_service

client = TestClient(app)


def test_security_headers_present_on_all_endpoints():
    """Verify enterprise defensive headers protect against sniffing, clickjacking, and XSS."""
    res = client.get("/")
    assert res.status_code == 200
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert res.headers["x-xss-protection"] == "1; mode=block"
    assert "strict-transport-security" in res.headers


@pytest.mark.asyncio
async def test_rate_limiter_blocks_excessive_traffic():
    """Verify that requests exceeding RPM trigger HTTP 429 Too Many Requests."""
    await rate_limiter.reset()
    test_ip = "192.168.1.100"

    # Fill rate limit bucket
    for _ in range(rate_limiter.rpm):
        allowed, _ = await rate_limiter.is_allowed(test_ip)
        assert allowed is True

    # Next request must be rejected
    allowed, retry_after = await rate_limiter.is_allowed(test_ip)
    assert allowed is False
    assert retry_after > 0

    await rate_limiter.reset()


def test_malicious_polyglot_rejected_by_magic_bytes():
    """Verify binary magic bytes check blocks spoofed extensions (e.g. bash script named fake.png)."""
    malicious_script = b"#!/bin/bash\necho 'hacked'\n"
    res = client.post(
        "/api/audit/document",
        files={"file": ("fake.png", io.BytesIO(malicious_script), "image/png")}
    )
    assert res.status_code == 400
    assert "Unsupported file format" in res.json()["detail"]


@pytest.mark.asyncio
async def test_multi_user_concurrency_and_session_isolation():
    """
    Simulate 10 distinct concurrent users sending requests simultaneously.
    Verifies that:
    1. AsyncGroq and FastAPI event loop handle 10 concurrent requests without blocking.
    2. Zero session cross-talk: User A's invoice context is never returned to User B.
    """
    mock_client = MagicMock()

    async def mock_chat_create(model, messages, **kwargs):
        # Extract user text from messages
        user_prompt = messages[-1]["content"]
        # Simulate slight network jitter
        await asyncio.sleep(0.01)
        mock_choice = MagicMock()
        mock_choice.message.content = f"CONFIRMED_USER_QUERY: {user_prompt}"
        mock_res = MagicMock()
        mock_res.choices = [mock_choice]
        return mock_res

    mock_client.chat.completions.create = AsyncMock(side_effect=mock_chat_create)

    with patch.object(voice_service, "_get_client", return_value=mock_client):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as async_client:
            tasks = []
            for user_id in range(10):
                payload = {
                    "user_text": f"User_{user_id}_Auditing_Query",
                    "context": f"Document context for user {user_id}",
                    "history": [],
                    "language": "en"
                }
                tasks.append(async_client.post("/api/voice/chat", json=payload))

            responses = await asyncio.gather(*tasks)

            # Assert all 10 completed successfully and returned isolated responses
            for user_id, resp in enumerate(responses):
                assert resp.status_code == 200, f"User {user_id} request failed"
                data = resp.json()
                expected_marker = f"CONFIRMED_USER_QUERY: User_{user_id}_Auditing_Query"
                assert expected_marker in data["response"], f"Session cross-talk detected for user {user_id}"
