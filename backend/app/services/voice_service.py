import json
import logging
import time
from typing import List
from fastapi import HTTPException, UploadFile
from groq import AsyncGroq

from app.core.config import settings
from app.schemas.voice import (
    ChatRequest,
    ChatResponse,
    SuggestionRequest,
    SuggestionResponse,
    TranscriptionResponse,
)

logger = logging.getLogger("voice_service")


class VoiceService:
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

    async def transcribe_audio(self, file: UploadFile, language: str = "en") -> TranscriptionResponse:
        client = self._get_client()
        content = await file.read()
        filename = file.filename or "recording.webm"

        try:
            # Groq audio API expects a tuple (filename, bytes, content_type)
            audio_file = (filename, content, file.content_type or "audio/webm")
            transcription = await client.audio.transcriptions.create(
                file=audio_file,
                model=settings.WHISPER_MODEL,
                language=language if language in ("ar", "en") else None,
                response_format="json"
            )
            text = transcription.text if hasattr(transcription, "text") else transcription.get("text", "")
            return TranscriptionResponse(text=text.strip(), language=language)
        except Exception as e:
            logger.error(f"Whisper transcription failed: {e}")
            raise HTTPException(status_code=502, detail=f"Transcription failed: {str(e)}")

    async def generate_chat_response(self, req: ChatRequest) -> ChatResponse:
        client = self._get_client()
        start = time.perf_counter()

        lang_instruction = (
            "Respond ONLY in clear, professional Arabic. Do not use English unless citing an exact document identifier or technical code."
            if req.language == "ar"
            else "Respond ONLY in professional, concise English."
        )

        base_system_prompt = (
            "You are Meridian, an elite Forensic Document Intelligence Assistant. "
            "Your objective is to provide high-precision answers based on the audited document. "
            "Be direct, highly factual, and concise (2-4 complete sentences). Flag any risks proactively.\n"
            f"{lang_instruction}"
        )

        if req.context:
            base_system_prompt += f"\n\nAUDITED DOCUMENT CONTEXT:\n{req.context[:10000]}"

        messages = [{"role": "system", "content": base_system_prompt}]
        for msg in req.history[-8:]:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": req.user_text})

        candidate_models = [settings.REASONING_FAST_MODEL, settings.REASONING_MODEL, "qwen/qwen3.8-27b"]
        last_err = None
        for model_name in candidate_models:
            try:
                chat_completion = await client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    max_tokens=650,
                    temperature=0.2
                )
                response_text = chat_completion.choices[0].message.content or ""
                latency_ms = (time.perf_counter() - start) * 1000

                return ChatResponse(
                    response=response_text.strip(),
                    language=req.language,
                    latency_ms=round(latency_ms, 2),
                    model_used=model_name
                )
            except Exception as e:
                logger.warning(f"Voice chat model {model_name} failed: {e}. Trying fallback...")
                last_err = e

        logger.error(f"All chat models failed. Last error: {last_err}")
        raise HTTPException(status_code=502, detail=f"LLM Reasoning failed: {str(last_err)}")

    async def generate_suggestions(self, req: SuggestionRequest) -> SuggestionResponse:
        client = self._get_client()
        context_slice = req.context[:3000]

        prompt = (
            f"Based on the following audited document summary, generate 4 concise, high-impact audit follow-up questions.\n"
            f"Respond strictly in {'Arabic' if req.language == 'ar' else 'English'}.\n"
            f"Return JSON strictly matching: {{\"questions\": [\"Q1\", \"Q2\", \"Q3\", \"Q4\"]}}\n"
            f"Context:\n{context_slice}"
        )

        candidate_models = [settings.REASONING_FAST_MODEL, settings.REASONING_MODEL, "qwen/qwen3.8-27b"]
        for model_name in candidate_models:
            try:
                res = await client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    max_tokens=300,
                    temperature=0.2
                )
                raw = res.choices[0].message.content or "{}"
                parsed = json.loads(raw)
                questions = parsed.get("questions", [])
                if not isinstance(questions, list) or len(questions) < 2:
                    questions = self._fallback_questions(req.language)
                return SuggestionResponse(questions=questions[:4])
            except Exception as e:
                logger.warning(f"Suggestion generation model {model_name} failed: {e}")

        return SuggestionResponse(questions=self._fallback_questions(req.language))

    def _fallback_questions(self, lang: str) -> List[str]:
        if lang == "ar":
            return [
                "ما هي أهم مؤشرات الخطر المكتشفة في المستند؟",
                "هل تطابقت المبالغ والتواريخ مع المعايير المطلوبة؟",
                "ما هي أهم 3 توصيات يجب التحقق منها يدوياً؟",
                "ما هو ملخص حالة الاعتماد النهائي لهذا الملف؟"
            ]
        return [
            "What are the highest-severity anomalies detected in this file?",
            "Are all declared entities and figures verified and consistent?",
            "What critical points require manual human verification?",
            "What is the final audit recommendation for this document?"
        ]


voice_service = VoiceService()
