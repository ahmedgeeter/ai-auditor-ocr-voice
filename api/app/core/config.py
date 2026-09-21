import os
from typing import List
from dotenv import load_dotenv

# Ensure .env is always loaded upon configuration import
load_dotenv()

class Settings:
    PROJECT_NAME: str = "Meridian Document Intelligence API"
    VERSION: str = "2.0.0"
    API_PREFIX: str = "/api"
    
    @property
    def GROQ_API_KEY(self) -> str:
        return os.getenv("GROQ_API_KEY", "") or os.getenv("VITE_GROQ_API_KEY", "")
        
    VISION_MODEL: str = os.getenv("VISION_MODEL", "qwen/qwen3.8-27b")
    VISION_FALLBACK_MODEL: str = os.getenv("VISION_FALLBACK_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
    REASONING_MODEL: str = os.getenv("REASONING_MODEL", "openai/gpt-oss-120b")
    REASONING_FAST_MODEL: str = os.getenv("REASONING_FAST_MODEL", "openai/gpt-oss-20b")
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "whisper-large-v3")
    
    # Limits & Origins
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "25"))
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    
    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        return [
            origin.strip()
            for origin in os.getenv(
                "ALLOWED_ORIGINS",
                "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
            ).split(",")
            if origin.strip()
        ]

settings = Settings()
