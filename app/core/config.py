"""应用配置：集中读取环境变量和项目根目录的 .env 文件。"""

from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import quote_plus

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppEnv(StrEnum):
    """应用运行环境。"""

    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    """应用全局配置，生产环境中的敏感值应由部署平台注入。"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "金融企业智能办公平台"
    APP_ENV: AppEnv = AppEnv.DEVELOPMENT
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = Field(min_length=32)
    DATABASE_CHECK_ON_STARTUP: bool = False

    DATABASE_HOST: str = "127.0.0.1"
    DATABASE_PORT: int = 3306
    DATABASE_USER: str = "root"
    DATABASE_PASSWORD: str = ""
    DATABASE_NAME: str = "financial_office"
    DATABASE_CHARSET: str = "utf8mb4"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    DATABASE_POOL_RECYCLE: int = 1800
    DATABASE_POOL_TIMEOUT: int = 30
    DATABASE_ECHO: bool = False

    REDIS_URL: str = "redis://127.0.0.1:6379/0"

    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120

    STORAGE_DIR: Path = Path("storage/uploads")
    RAG_MAX_FILE_SIZE_MB: int = 20
    PDF_OCR_ENABLED: bool = False
    PDF_OCR_EXECUTABLE: str = "tesseract"
    PDF_OCR_LANGUAGES: str = "chi_sim+eng"
    PDF_OCR_DPI: int = Field(default=300, ge=72, le=600)
    PDF_OCR_MIN_NATIVE_TEXT_CHARS: int = Field(default=20, ge=0, le=10000)
    PDF_OCR_MAX_PAGES: int = Field(default=30, ge=1, le=1000)
    PDF_OCR_PAGE_TIMEOUT_SECONDS: int = Field(default=30, ge=1, le=300)
    PDF_OCR_DOCUMENT_TIMEOUT_SECONDS: int = Field(default=180, ge=1, le=3600)
    PDF_OCR_MAX_CONCURRENCY: int = Field(default=1, ge=1, le=8)
    RAG_VECTOR_SEARCH_ENABLED: bool = False
    RAG_VECTOR_FALLBACK_TO_KEYWORD: bool = True
    RAG_VECTOR_TOP_K: int = Field(default=20, ge=1, le=100)
    RAG_VECTOR_TOP_N: int = Field(default=6, ge=1, le=20)
    RAG_VECTOR_SCORE_THRESHOLD: float = Field(default=0.45, ge=-1.0, le=1.0)
    RAG_INDEX_ENABLED: bool = False

    AI_PROVIDER: Literal["openai_compatible", "ark"] = "openai_compatible"
    AI_API_STYLE: Literal["chat_completions", "responses"] = "chat_completions"
    AI_API_KEY: str = ""
    AI_BASE_URL: str = "https://api.openai.com/v1"
    ARK_API_KEY: str = ""
    ARK_BASE_URL: str = "https://ark.cn-beijing.volces.com/api/v3"
    AI_CHAT_MODEL: str = "gpt-4o-mini"
    AI_RAG_MODEL: str = ""
    AI_WEB_SEARCH_MODEL: str = ""
    AI_DOCUMENT_MODEL: str = ""
    AI_SUMMARY_MODEL: str = ""
    AI_MEETING_MODEL: str = ""
    AI_AGENT_MODEL: str = ""
    AI_WEB_SEARCH_MAX_KEYWORD: int = Field(default=2, ge=1, le=10)
    AI_TIMEOUT_SECONDS: int = 60
    AI_SDK_MAX_RETRIES: int = Field(default=0, ge=0, le=5)
    AI_PROVIDERS_JSON: str = ""
    AI_MODEL_PROFILES_JSON: str = ""
    AI_TASK_ROUTES_JSON: str = ""
    AI_FALLBACK_ENABLED: bool = True
    AI_MAX_RETRIES: int = Field(default=1, ge=0, le=5)
    AI_RETRY_BACKOFF_SECONDS: float = Field(default=0.2, ge=0, le=10)
    AI_LOG_PROMPTS: bool = False
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
    DEEPSEEK_MODEL: str = "deepseek-reasoner"
    DOUBAO_API_KEY: str = ""
    DOUBAO_BASE_URL: str = "https://ark.cn-beijing.volces.com/api/v3"
    DOUBAO_MODEL: str = ""
    QWEN_API_KEY: str = ""
    QWEN_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    QWEN_MODEL: str = "qwen-plus"

    QDRANT_URL: str = "http://127.0.0.1:6333"
    QDRANT_API_KEY: str = ""
    QDRANT_COLLECTION: str = "enterprise_knowledge"
    QDRANT_TIMEOUT_SECONDS: int = Field(default=10, ge=1, le=300)
    EMBEDDING_VERSION: str = "v1"

    EMBEDDING_PROVIDER: Literal["bailian"] = "bailian"
    EMBEDDING_API_KEY: str = ""
    EMBEDDING_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    EMBEDDING_MODEL: str = "text-embedding-v4"
    EMBEDDING_DIMENSION: int = Field(default=1024, ge=1, le=4096)
    EMBEDDING_BATCH_SIZE: int = Field(default=10, ge=1, le=100)
    EMBEDDING_TIMEOUT_SECONDS: int = Field(default=30, ge=1, le=300)
    EMBEDDING_TRUST_ENV: bool = False
    EMBEDDING_MAX_RETRIES: int = Field(default=2, ge=0, le=5)
    EMBEDDING_RETRY_BACKOFF_SECONDS: float = Field(default=0.2, ge=0, le=10)
    EMBEDDING_MAX_TEXT_CHARS: int = Field(default=12000, ge=1, le=1000000)

    CHAT_HISTORY_LIMIT: int = 12
    CHAT_RAG_TOP_K: int = 4
    CHAT_RAG_CHUNK_SIZE: int = 1000
    CHAT_RAG_CHUNK_OVERLAP: int = 150
    CHAT_RAG_MAX_DOCUMENTS: int = 50

    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    LOG_DIR: str = "logs"
    LOG_JSON_FILE: bool = True
    LOG_MAX_BYTES: int = 10 * 1024 * 1024
    LOG_BACKUP_COUNT: int = 10

    CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://localhost:8080"]
    )
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list[str] = Field(default_factory=lambda: ["*"])
    CORS_ALLOW_HEADERS: list[str] = Field(default_factory=lambda: ["*"])

    @field_validator("API_V1_PREFIX")
    @classmethod
    def validate_api_prefix(cls, value: str) -> str:
        """确保API前缀格式统一。"""
        normalized = value.strip()
        if not normalized.startswith("/"):
            normalized = f"/{normalized}"
        return normalized.rstrip("/")

    @field_validator("PDF_OCR_EXECUTABLE")
    @classmethod
    def validate_pdf_ocr_executable(cls, value: str) -> str:
        """拒绝空白或包含控制字符的OCR可执行文件配置。"""
        normalized = value.strip()
        if not normalized or any(ord(character) < 32 for character in normalized):
            raise ValueError("PDF_OCR_EXECUTABLE配置无效")
        return normalized

    @field_validator("PDF_OCR_LANGUAGES")
    @classmethod
    def validate_pdf_ocr_languages(cls, value: str) -> str:
        """限制Tesseract语言配置为明确的语言包名称列表。"""
        normalized = value.strip()
        parts = normalized.split("+")
        if not parts or any(
            not part.isascii() or not part.replace("_", "").isalnum() for part in parts
        ):
            raise ValueError("PDF_OCR_LANGUAGES配置无效")
        return "+".join(parts)

    @computed_field
    @property
    def DATABASE_URL(self) -> str:
        """生成经过URL转义的SQLAlchemy MySQL连接地址。"""
        user = quote_plus(self.DATABASE_USER)
        password = quote_plus(self.DATABASE_PASSWORD)
        return (
            f"mysql+pymysql://{user}:{password}@{self.DATABASE_HOST}:"
            f"{self.DATABASE_PORT}/{self.DATABASE_NAME}?charset={self.DATABASE_CHARSET}"
        )


@lru_cache
def get_settings() -> Settings:
    """返回进程级缓存配置实例。"""
    return Settings()


settings = get_settings()
