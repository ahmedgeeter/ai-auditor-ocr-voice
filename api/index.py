import os
import sys
from pathlib import Path

# Add api and backend directories to sys.path so app modules are discoverable on Vercel
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent / "backend"

for p in [str(current_dir), str(backend_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Auto-map VITE_GROQ_API_KEY to GROQ_API_KEY if present in Vercel environment
if not os.getenv("GROQ_API_KEY") and os.getenv("VITE_GROQ_API_KEY"):
    os.environ["GROQ_API_KEY"] = os.environ["VITE_GROQ_API_KEY"]

from app.main import app
