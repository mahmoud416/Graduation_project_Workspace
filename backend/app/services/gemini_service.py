import google.generativeai as genai
from app.core.config import settings
from typing import Optional

# Configure Gemini once when the module is loaded
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

def get_gemini_model(model_name: Optional[str] = None) -> genai.GenerativeModel:
    """
    Returns a configured Gemini GenerativeModel.
    Falls back to settings.GEMINI_MODEL if no model_name is provided.
    """
    return genai.GenerativeModel(model_name or settings.GEMINI_MODEL)
