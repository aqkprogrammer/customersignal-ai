"""Application settings, loaded from environment variables and validated at startup."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "test", "staging", "production"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"), env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    # --- Core -------------------------------------------------------------
    environment: Environment = "development"
    app_name: str = "CustomerSignal AI"
    app_secret_key: str = Field(default="", description="Signs JWTs and encrypts integration credentials")
    app_url: str = Field(default="http://localhost:3000", alias="NEXT_PUBLIC_APP_URL")
    api_url: str = Field(default="http://localhost:8000", alias="API_PUBLIC_URL")
    cors_origins: str = "http://localhost:3000"
    log_level: str = "INFO"

    # --- Data stores ------------------------------------------------------
    database_url: str = "postgresql+asyncpg://localhost/customersignal"
    redis_url: str = "redis://localhost:6379/0"
    jobs_queue_name: str = Field(default="customersignal:jobs", description="Dedicated arq queue (avoids clashes on shared Redis)")
    jobs_inline: bool = Field(
        default=False, description="Run background jobs in-process instead of the arq worker (dev only)"
    )

    # --- Auth -------------------------------------------------------------
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    refresh_token_ttl_days_short: int = 1
    admin_session_ttl_hours: int = 8
    email_verification_required: bool = True
    cookie_secure: bool | None = None  # defaults to True outside development/test
    cookie_domain: str | None = None
    google_client_id: str = ""
    google_client_secret: str = ""

    # --- Admin bootstrap --------------------------------------------------
    admin_bootstrap_email: str = ""
    admin_bootstrap_secret: str = ""

    # --- AI ---------------------------------------------------------------
    ai_provider: Literal["auto", "anthropic", "openai", "heuristic", "mock"] = "auto"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5-5"
    anthropic_effort: Literal["low", "medium", "high", "xhigh", "max"] = "low"
    anthropic_server_fallback: bool = True
    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    ai_timeout_seconds: float = 120.0
    ai_max_retries: int = 3
    ai_batch_size: int = 15

    # --- Billing ----------------------------------------------------------
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_publishable_key: str = Field(default="", alias="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
    trial_days: int = 14

    # --- Email ------------------------------------------------------------
    resend_api_key: str = ""
    email_from: str = "CustomerSignal AI <noreply@customersignal.ai>"

    # --- Storage ----------------------------------------------------------
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = ""
    s3_region: str = "us-east-1"
    s3_endpoint_url: str = ""
    storage_backend: Literal["auto", "local", "database", "s3"] = "auto"
    local_storage_path: str = "./storage"
    max_upload_mb: int = 20

    # --- Supabase (optional, documented alternative auth provider) --------
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment in ("production", "staging")

    @property
    def secure_cookies(self) -> bool:
        if self.cookie_secure is not None:
            return self.cookie_secure
        return self.is_production

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def google_oauth_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def stripe_enabled(self) -> bool:
        return bool(self.stripe_secret_key)

    @property
    def s3_enabled(self) -> bool:
        return bool(self.s3_access_key and self.s3_secret_key and self.s3_bucket)

    @model_validator(mode="after")
    def _validate(self) -> Settings:
        if self.is_production:
            missing = [
                name
                for name, value in {
                    "APP_SECRET_KEY": self.app_secret_key,
                    "DATABASE_URL": self.database_url,
                    "REDIS_URL": self.redis_url,
                }.items()
                if not value
            ]
            if missing:
                raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
            if len(self.app_secret_key) < 32:
                raise ValueError("APP_SECRET_KEY must be at least 32 characters in production")
            if self.jobs_inline:
                raise ValueError("JOBS_INLINE must be false in production")
        elif not self.app_secret_key:
            # Development convenience: a fixed, clearly-insecure key.
            self.app_secret_key = "dev-insecure-secret-key-change-me-0123456789"
        if self.database_url.startswith("postgres://"):
            self.database_url = self.database_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
