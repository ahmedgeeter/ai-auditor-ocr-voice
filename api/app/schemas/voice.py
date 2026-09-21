from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    user_text: str = Field(..., min_length=1, max_length=4000)
    context: Optional[str] = Field(None, description="Audited document JSON context")
    history: List[ChatMessage] = Field(default_factory=list, description="Prior conversation history")
    language: Literal["en", "ar"] = Field(default="en", description="Target response language")


class ChatResponse(BaseModel):
    response: str
    language: Literal["en", "ar"]
    latency_ms: float
    model_used: str


class SuggestionRequest(BaseModel):
    context: str = Field(..., description="Audited document JSON context")
    language: Literal["en", "ar"] = Field(default="en")


class SuggestionResponse(BaseModel):
    questions: List[str]


class TranscriptionResponse(BaseModel):
    text: str
    language: str
    duration_estimate_sec: Optional[float] = None
