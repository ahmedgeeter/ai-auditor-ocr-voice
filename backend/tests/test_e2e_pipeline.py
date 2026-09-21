import io
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.services.document_service import document_service
from app.services.voice_service import voice_service

client = TestClient(app)


def test_full_pipeline_e2e():
    """
    End-to-end simulation of a complete user session:
    1. Health check
    2. Upload document & forensic audit
    3. Ask follow-up question via voice chat
    4. Generate suggestions
    5. Transcribe user audio response
    """
    # 1. Health check
    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "online"

    # 2. Upload Document
    mock_groq_client = MagicMock()
    mock_audit_res = MagicMock()
    mock_choice = MagicMock()
    sample_audit = {
        "document_type": "Commercial Contract",
        "document_subtype": "Master Services Agreement",
        "confidence": 0.96,
        "extracted_fields": {
            "party_a": {"value": "Apex Innovations Inc", "confidence": 0.98, "category": "Parties"},
            "party_b": {"value": "Global Logistics Corp", "confidence": 0.97, "category": "Parties"},
            "effective_date": {"value": "2026-05-01", "confidence": 0.94, "category": "Dates"},
            "liability_cap": {"value": "$500,000", "confidence": 0.92, "category": "Liability"}
        },
        "detected_entities": ["Apex Innovations Inc", "Global Logistics Corp", "$500,000"],
        "anomalies": [
            {
                "type": "warning",
                "description": "Standard indemnification clause missing mutual disclaimer",
                "severity": "medium"
            }
        ],
        "document_specific_analysis": {
            "insights": ["High-value contract with unilateral termination risks"],
            "verification_status": "partial",
            "recommendations": ["Legal review recommended for Section 14 indemnification"]
        },
        "summary": "Master Services Agreement between Apex Innovations and Global Logistics."
    }
    mock_choice.message.content = json.dumps(sample_audit)
    mock_audit_res.choices = [mock_choice]
    mock_groq_client.chat.completions.create = AsyncMock(return_value=mock_audit_res)

    from pypdf import PdfWriter
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    pdf_buf = io.BytesIO()
    writer.write(pdf_buf)
    pdf_bytes = pdf_buf.getvalue()

    with patch.object(document_service, "_get_client", return_value=mock_groq_client):
        audit_response = client.post(
            "/api/audit/document",
            files={"file": ("msa_contract.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        )
        assert audit_response.status_code == 200
        audit_data = audit_response.json()
        assert audit_data["report"]["document_type"] == "Commercial Contract"
        assert audit_data["report"]["confidence"] == 0.96
        assert len(audit_data["report"]["anomalies"]) == 1

    # 3. Contextual Voice Chat
    mock_chat_res = MagicMock()
    mock_chat_choice = MagicMock()
    mock_chat_choice.message.content = "The liability cap is strictly $500,000 with a unilateral indemnification clause."
    mock_chat_res.choices = [mock_chat_choice]
    mock_groq_client.chat.completions.create = AsyncMock(return_value=mock_chat_res)

    with patch.object(voice_service, "_get_client", return_value=mock_groq_client):
        chat_req = {
            "user_text": "What is the liability limitation?",
            "context": json.dumps(audit_data["report"]),
            "history": [],
            "language": "en"
        }
        chat_res = client.post("/api/voice/chat", json=chat_req)
        assert chat_res.status_code == 200
        assert "$500,000" in chat_res.json()["response"]

    # 4. Suggestions
    mock_sugg_res = MagicMock()
    mock_sugg_choice = MagicMock()
    mock_sugg_choice.message.content = json.dumps({
        "questions": [
            "What triggers termination for convenience?",
            "Is the liability cap mutual or one-sided?",
            "What are the governing law provisions?",
            "Are intellectual property rights clearly assigned?"
        ]
    })
    mock_sugg_res.choices = [mock_sugg_choice]
    mock_groq_client.chat.completions.create = AsyncMock(return_value=mock_sugg_res)

    with patch.object(voice_service, "_get_client", return_value=mock_groq_client):
        sugg_req = {
            "context": json.dumps(audit_data["report"]),
            "language": "en"
        }
        sugg_res = client.post("/api/voice/suggestions", json=sugg_req)
        assert sugg_res.status_code == 200
        assert len(sugg_res.json()["questions"]) == 4

    # 5. Transcription
    mock_groq_client.audio.transcriptions.create = AsyncMock(return_value=MagicMock(text="Yes, proceed with manual review."))
    with patch.object(voice_service, "_get_client", return_value=mock_groq_client):
        trans_res = client.post(
            "/api/voice/transcribe",
            files={"file": ("audio.webm", io.BytesIO(b"fake audio data"), "audio/webm")},
            data={"language": "en"}
        )
        assert trans_res.status_code == 200
        assert trans_res.json()["text"] == "Yes, proceed with manual review."
