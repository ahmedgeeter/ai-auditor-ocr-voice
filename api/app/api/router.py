from fastapi import APIRouter, File, Form, UploadFile
from app.core.config import settings
from app.schemas.document import AuditResponse
from app.schemas.voice import (
    ChatRequest,
    ChatResponse,
    SuggestionRequest,
    SuggestionResponse,
    TranscriptionResponse,
)
from app.services.document_service import document_service
from app.services.voice_service import voice_service

api_router = APIRouter()


@api_router.get("/health")
async def health_check():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "groq_configured": bool(settings.GROQ_API_KEY),
    }


@api_router.get("/health/ready")
async def health_ready():
    is_ready = bool(settings.GROQ_API_KEY)
    return {
        "status": "ready" if is_ready else "degraded",
        "vision_model": settings.VISION_MODEL,
        "reasoning_model": settings.REASONING_MODEL,
        "whisper_model": settings.WHISPER_MODEL,
    }


@api_router.post("/audit/document", response_model=AuditResponse)
async def audit_document(file: UploadFile = File(...)):
    """
    Multimodal Document Audit endpoint.
    Accepts PDF or Image (JPEG/PNG/WEBP), extracts full-page layout,
    performs AI forensic extraction, anomaly detection, and schema validation.
    """
    return await document_service.audit_file(file)


@api_router.post("/voice/transcribe", response_model=TranscriptionResponse)
async def transcribe_voice(
    file: UploadFile = File(...),
    language: str = Form("en")
):
    """
    Transcribes vocal input via Whisper-Large-V3.
    """
    return await voice_service.transcribe_audio(file, language)


@api_router.post("/voice/chat", response_model=ChatResponse)
async def voice_chat(req: ChatRequest):
    """
    Contextual conversational intelligence over the audited document.
    """
    return await voice_service.generate_chat_response(req)


@api_router.post("/voice/suggestions", response_model=SuggestionResponse)
async def get_suggestions(req: SuggestionRequest):
    """
    Generates intelligent follow-up audit questions based on document findings.
    """
    return await voice_service.generate_suggestions(req)
