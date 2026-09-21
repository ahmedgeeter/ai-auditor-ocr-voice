import io
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.document import DocumentReport, ExtractedField, AnomalyItem
from app.services.document_service import document_service

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "service" in data
    assert data["service"] == "Meridian Document Intelligence API"
    # Verify Enterprise Security Headers
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"


def test_health_endpoints():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

    ready_res = client.get("/api/health/ready")
    assert ready_res.status_code == 200
    assert "vision_model" in ready_res.json()


def test_document_report_schema():
    report_dict = {
        "document_type": "Commercial Invoice",
        "document_subtype": "Standard VAT Invoice",
        "confidence": 0.98,
        "extracted_fields": {
            "vendor_name": {
                "value": "Acme Global Tech",
                "confidence": 0.99,
                "category": "Vendor Information"
            },
            "total_amount": {
                "value": "$14,500.00",
                "confidence": 0.95,
                "category": "Financials"
            }
        },
        "detected_entities": ["Acme Global Tech", "2026-09-15"],
        "anomalies": [
            {
                "type": "warning",
                "description": "Due date precedes issue date by 2 days",
                "severity": "medium"
            }
        ],
        "document_specific_analysis": {
            "insights": ["High confidence extraction with zero missing mandatory headers"],
            "verification_status": "verified",
            "recommendations": ["Safe for accounts payable automated dispatch"]
        },
        "summary": "Valid corporate commercial invoice."
    }

    report = DocumentReport.model_validate(report_dict)
    assert report.document_type == "Commercial Invoice"
    assert report.confidence == 0.98
    assert "vendor_name" in report.extracted_fields
    assert report.extracted_fields["vendor_name"].confidence == 0.99
    assert len(report.anomalies) == 1
    assert report.anomalies[0].severity == "medium"


def test_unsupported_file_format():
    fake_file = io.BytesIO(b"malicious script")
    response = client.post(
        "/api/audit/document",
        files={"file": ("virus.exe", fake_file, "application/octet-stream")}
    )
    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]


@patch.object(document_service, "_get_client")
def test_audit_document_image_mocked(mock_get_client):
    mock_client = MagicMock()
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    
    sample_report = {
        "document_type": "Passport",
        "document_subtype": "International Travel Document",
        "confidence": 0.99,
        "extracted_fields": {
            "full_name": {"value": "Ahmed Hassan", "confidence": 0.99, "category": "Personal"},
            "expiry_date": {"value": "2032-11-20", "confidence": 0.95, "category": "Validity"}
        },
        "detected_entities": ["Ahmed Hassan", "Egypt"],
        "anomalies": [],
        "document_specific_analysis": {
            "insights": ["Valid biometric standard document format detected"],
            "verification_status": "verified",
            "recommendations": ["Identity confirmed"]
        },
        "summary": "Passport identity document."
    }
    mock_choice.message.content = json.dumps(sample_report)
    mock_completion.choices = [mock_choice]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_completion)
    mock_get_client.return_value = mock_client

    fake_image = io.BytesIO(b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xFF\xDB\x00C\x00")
    response = client.post(
        "/api/audit/document",
        files={"file": ("passport.jpg", fake_image, "image/jpeg")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["report"]["document_type"] == "Passport"
    assert data["report"]["confidence"] == 0.99
    assert "full_name" in data["report"]["extracted_fields"]
    assert data["latency_ms"] >= 0


def test_parse_and_validate_markdown_cleanup():
    markdown_wrapped_json = """```json
    {
        "document_type": "Certificate",
        "confidence": 0.92,
        "extracted_fields": {},
        "detected_entities": ["University"],
        "anomalies": [],
        "document_specific_analysis": {
            "insights": ["Accredited"],
            "verification_status": "verified",
            "recommendations": []
        },
        "summary": "Graduation certificate."
    }
    ```"""
    parsed = document_service._parse_and_validate(markdown_wrapped_json)
    assert parsed.document_type == "Certificate"
    assert parsed.confidence == 0.92
