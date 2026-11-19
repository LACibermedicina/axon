from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .routers import account, admin, ai, auth, compositions, media

s = settings()
app = FastAPI(title="harmonIA API", version=s.version, docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=[s.public_base], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
for r in (auth, compositions, media, ai, account, admin):
    app.include_router(r.router)


@app.get("/api/health")
def health():
    import os
    return {"status": "ok", "project": s.project, "version": s.version, "commit": s.git_sha,
            "ai_full": os.getenv("AI_ML", "0") == "1"}
