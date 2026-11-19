from __future__ import annotations

import os
from functools import lru_cache


class Settings:
    def __init__(self) -> None:
        self.project = os.getenv("PROJETO_NOME", "harmonia")
        self.version = open(os.path.join(os.path.dirname(__file__), "..", "..", "VERSION")).read().strip() \
            if os.path.exists(os.path.join(os.path.dirname(__file__), "..", "..", "VERSION")) else "0.1.0-alpha"
        self.database_url = os.getenv("DATABASE_URL", "sqlite:///./harmonia.db")
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.jwt_secret = os.getenv("JWT_SECRET", "dev-secret-change-me-dev-secret-change-me")
        self.data_key = os.getenv("DATA_ENCRYPTION_KEY", "00" * 32)
        self.media_root = os.getenv("MEDIA_ROOT", "./media")
        self.public_base = os.getenv("PUBLIC_BASE_URL", "http://localhost:5173")
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.ai_model = os.getenv("AI_MODEL", "claude-sonnet-4-5")
        self.admin_email = os.getenv("ADMIN_EMAIL", "")
        self.admin_password = os.getenv("ADMIN_PASSWORD", "")
        self.token_ttl_min = int(os.getenv("TOKEN_TTL_MIN", "720"))
        self.max_upload_mb = int(os.getenv("MAX_UPLOAD_MB", "200"))
        self.git_sha = os.getenv("GIT_SHA", "dev")


@lru_cache
def settings() -> Settings:
    return Settings()
