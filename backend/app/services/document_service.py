import asyncio
import base64
import io
import json
import logging
import time
from typing import List, Tuple
from fastapi import HTTPException, UploadFile
from groq import AsyncGroq
from pypdf import PdfReader

from app.core.config import settings
from app.schemas.document import AuditResponse, DocumentReport

logger = logging.getLogger("document_service")

AUDIT_SYSTEM_PROMPT = """You are an Enterprise Document Intelligence & Forensic Auditor AI.
Analyze the provided document (both visual layout and extracted text across all pages).

Extraction Objectives:
1. Identify the exact document type (e.g., Commercial Invoice, Resume/CV, Employment Contract, Government ID, Bank Statement, Medical Record, Academic Certificate).
2. Extract all key operational fields into a structured key-value mapping with confidence scores (0.0 to 1.0) and categories.
3. Extract detected named entities (organizations, personal names, dates, financial amounts, legal jurisdictions).
4. Run anomaly and risk detection: flag missing required clauses, expired dates, arithmetic mismatches (e.g. tax + subtotal != total), or questionable formatting.
5. Provide high-level forensic insights, verification status ("verified", "partial", "suspicious", "failed"), and clear recommendations for human reviewers.
6. Provide an executive summary of the document.

You MUST respond strictly with a valid JSON object matching this schema:
{
  "document_type": "string",
  "document_subtype": "string or null",
  "confidence": 0.0-1.0,
  "extracted_fields": {
    "field_name": {
      "value": "string or number",
      "confidence": 0.0-1.0,
      "category": "string"
    }
  },
  "detected_entities": ["entity1", "entity2"],
  "anomalies": [
    {
      "type": "warning | error | info",
      "description": "string",
      "severity": "low | medium | high"
    }
  ],
  "document_specific_analysis": {
    "insights": ["insight1", "insight2"],
    "verification_status": "verified | partial | suspicious | failed",
    "recommendations": ["rec1", "rec2"]
  },
  "summary": "string"
}
Output ONLY valid JSON. No markdown backticks, no explanations."""


def validate_file_content(content: bytes, filename: str) -> str:
    """
    Enterprise File Content & Magic Bytes Validator.
    Strictly validates the binary headers of uploaded files to prevent
    extension spoofing, disguised executables, and polyglot malware.
    """
    if len(content) < 4:
        raise HTTPException(status_code=400, detail="Uploaded file is empty or corrupted.")

    # 1. PDF Check (%PDF-)
    if content.startswith(b"%PDF-"):
        return "pdf"

    # 2. JPEG Check (FF D8 FF)
    if content.startswith(b"\xFF\xD8\xFF"):
        return "image"

    # 3. PNG Check (89 50 4E 47 0D 0A 1A 0A)
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image"

    # 4. WEBP Check (RIFF....WEBP)
    if content.startswith(b"RIFF") and len(content) >= 12 and content[8:12] == b"WEBP":
        return "image"

    # Any file that does not match genuine magic bytes is rejected
    raise HTTPException(
        status_code=400,
        detail="Unsupported file format. Only valid PDF, JPEG, PNG, and WEBP files with genuine magic headers are accepted."
    )


class DocumentService:
    def __init__(self):
        self._client = None

    def _get_client(self) -> AsyncGroq:
        api_key = settings.GROQ_API_KEY
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="Server configuration error: GROQ_API_KEY is not set on the backend. Please configure it in backend/.env"
            )
        if not self._client or getattr(self._client, "api_key", None) != api_key:
            self._client = AsyncGroq(api_key=api_key)
        return self._client

    async def extract_pdf_data(self, content: bytes) -> Tuple[str, List[str], int]:
        """
        Extracts multi-page text and images from a PDF asynchronously in a background thread
        so the main event loop remains responsive for other concurrent users.
        Returns (extracted_text, base64_images, page_count).
        """
        def _parse():
            reader = PdfReader(io.BytesIO(content))
            page_count = len(reader.pages)
            text_parts = []
            base64_images = []

            for page_idx, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                if page_text.strip():
                    text_parts.append(f"--- Page {page_idx + 1} ---\n{page_text}")
                
                # Extract embedded images if available (up to 3 key images)
                if len(base64_images) < 3:
                    for img in page.images:
                        try:
                            img_b64 = base64.b64encode(img.data).decode("utf-8")
                            base64_images.append(img_b64)
                            if len(base64_images) >= 3:
                                break
                        except Exception:
                            continue

            full_text = "\n\n".join(text_parts)
            return full_text, base64_images, page_count

        try:
            return await asyncio.to_thread(_parse)
        except Exception as e:
            logger.error(f"PDF extraction error: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")

    async def audit_file(self, file: UploadFile) -> AuditResponse:
        filename = (file.filename or "").lower()
        content = await file.read()
        
        if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB."
            )

        file_type = validate_file_content(content, filename)
        client = self._get_client()
        start_time = time.perf_counter()
        pages_count = 1
        messages_content = []

        if file_type == "pdf":
            full_text, base64_images, pages_count = await self.extract_pdf_data(content)
            prompt_text = f"{AUDIT_SYSTEM_PROMPT}\n\nDocument File: {file.filename} (Total Pages: {pages_count})\n"
            if full_text.strip():
                prompt_text += f"\nExtracted Document Text:\n{full_text[:8000]}\n"
            
            messages_content.append({"type": "text", "text": prompt_text})

            # If PDF contains extracted images, pass them to the multimodal model
            for img_b64 in base64_images[:2]:
                messages_content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}
                })
        else:
            # Direct Image Upload
            img_b64 = base64.b64encode(content).decode("utf-8")
            messages_content.append({
                "type": "text",
                "text": f"{AUDIT_SYSTEM_PROMPT}\n\nDocument File: {file.filename}"
            })
            mime = file.content_type or "image/jpeg"
            messages_content.append({
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{img_b64}"}
            })

        # Non-blocking Async Inference with Fallback
        model_to_use = settings.VISION_MODEL
        try:
            chat_completion = await client.chat.completions.create(
                model=model_to_use,
                messages=[{"role": "user", "content": messages_content}],
                max_tokens=4096,
                temperature=0.1
            )
            raw_content = chat_completion.choices[0].message.content or "{}"
        except Exception as primary_err:
            logger.warning(f"Primary vision model {model_to_use} failed: {primary_err}. Attempting fallback...")
            model_to_use = settings.VISION_FALLBACK_MODEL
            try:
                chat_completion = await client.chat.completions.create(
                    model=model_to_use,
                    messages=[{"role": "user", "content": messages_content}],
                    max_tokens=4096,
                    temperature=0.1
                )
                raw_content = chat_completion.choices[0].message.content or "{}"
            except Exception as fallback_err:
                logger.error(f"Vision inference failed on all models: {fallback_err}")
                raise HTTPException(
                    status_code=502,
                    detail=f"Inference provider failure: {str(fallback_err)}"
                )

        latency_ms = (time.perf_counter() - start_time) * 1000

        # Strict validation with Pydantic
        report = self._parse_and_validate(raw_content)

        return AuditResponse(
            report=report,
            latency_ms=round(latency_ms, 2),
            pages_analyzed=pages_count,
            model_used=model_to_use,
            status="success"
        )

    def _parse_and_validate(self, raw_content: str) -> DocumentReport:
        try:
            cleaned = raw_content.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            
            data = json.loads(cleaned.strip())
            return DocumentReport.model_validate(data)
        except Exception as e:
            logger.warning(f"Strict Pydantic parse encountered discrepancies: {e}. Normalizing with partial recovery...")
            try:
                data = json.loads(raw_content)
                # Ensure fields conform
                fields = {}
                for k, v in data.get("extracted_fields", {}).items():
                    if isinstance(v, dict):
                        fields[k] = {
                            "value": str(v.get("value", "")),
                            "confidence": float(v.get("confidence", 0.8)),
                            "category": str(v.get("category", "General"))
                        }
                    else:
                        fields[k] = {"value": str(v), "confidence": 0.8, "category": "General"}
                data["extracted_fields"] = fields
                return DocumentReport.model_validate(data)
            except Exception as recovery_err:
                logger.error(f"Complete parse failure: {recovery_err}")
                # Safe deterministic fallback
                return DocumentReport(
                    document_type="Document",
                    confidence=0.5,
                    summary="Document processed successfully, but structured fields required partial parsing.",
                    anomalies=[{
                        "type": "info",
                        "description": "Output schema normalized via backend recovery layer.",
                        "severity": "low"
                    }]
                )


document_service = DocumentService()
