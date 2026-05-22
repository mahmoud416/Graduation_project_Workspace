"""
Configuration management using Pydantic Settings.
Loads environment variables and provides centralized configuration.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """

    # MongoDB Configuration
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "hericle_workspace"

    # JWT Configuration
    JWT_SECRET_KEY: str = "hericle-super-secret-key-change-in-production-2024"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    # Application Configuration
    APP_NAME: str = "Hericle - Project Management System"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    # AI / Quality Model Configuration (Google Gemini)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"
    QUALITY_DATASETS_DIR: str = "uploads/quality_datasets"
    QUALITY_MAX_DATASET_SIZE_MB: int = 200
    QUALITY_TRAINING_TIMEOUT_SECONDS: int = 600

    # RAG / Vector Store Configuration
    RAG_ENABLED: bool = True
    CHROMA_PERSIST_DIR: str = "./chroma_data"
    EMBEDDING_MODEL: str = "models/text-embedding-004"
    RAG_RULES_TOP_K: int = 8
    RAG_PATTERNS_TOP_K: int = 4

    # CORS Configuration
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

    @property
    def cors_origins(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]


# Global settings instance
settings = Settings()
