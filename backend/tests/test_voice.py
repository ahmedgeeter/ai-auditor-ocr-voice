import io
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.services.voice_service import voice_service

client = TestClient(app)


@patch.object(voice_service, "_get_client")
def test_voice_chat_mocked_english(mock_get_client):
    mock_client = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "The total invoice sum is $14,500 due on October 1st, 2026."
    mock_completion.choices = [mock_choice]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_completion)
    mock_get_client.return_value = mock_client

    payload = {
        "user_text": "What is the total amount due?",
        "context": '{"document_type": "Invoice", "extracted_fields": {"total": {"value": "$14,500"}}}',
        "history": [],
        "language": "en"
    }

    response = client.post("/api/voice/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "14,500" in data["response"]
    assert data["language"] == "en"
    assert data["latency_ms"] >= 0


@patch.object(voice_service, "_get_client")
def test_voice_chat_mocked_arabic(mock_get_client):
    mock_client = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "إجمالي المبلغ المستحق في الفاتورة هو 14,500 دولار أمريكي."
    mock_completion.choices = [mock_choice]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_completion)
    mock_get_client.return_value = mock_client

    payload = {
        "user_text": "كم إجمالي الفاتورة؟",
        "context": '{"document_type": "Invoice"}',
        "history": [],
        "language": "ar"
    }

    response = client.post("/api/voice/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "14,500" in data["response"]
    assert data["language"] == "ar"


@patch.object(voice_service, "_get_client")
def test_voice_suggestions_mocked(mock_get_client):
    mock_client = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = json.dumps({
        "questions": [
            "Are the payment terms net 30 or net 60?",
            "Is the vendor tax registration number verified?",
            "Does the subtotal match individual line items?",
            "What department authorized this expenditure?"
        ]
    })
    mock_completion.choices = [mock_choice]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_completion)
    mock_get_client.return_value = mock_client

    payload = {
        "context": '{"document_type": "Invoice", "summary": "Sample invoice"}',
        "language": "en"
    }

    response = client.post("/api/voice/suggestions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["questions"]) == 4
    assert "payment terms" in data["questions"][0]


@patch.object(voice_service, "_get_client")
def test_voice_transcribe_mocked(mock_get_client):
    mock_client = MagicMock()
    mock_transcription = MagicMock()
    mock_transcription.text = "Hello, please summarize the detected anomalies."
    mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_transcription)
    mock_get_client.return_value = mock_client

    fake_audio = io.BytesIO(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xAC\x00\x00")
    response = client.post(
        "/api/voice/transcribe",
        files={"file": ("recording.wav", fake_audio, "audio/wav")},
        data={"language": "en"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["text"] == "Hello, please summarize the detected anomalies."
    assert data["language"] == "en"
