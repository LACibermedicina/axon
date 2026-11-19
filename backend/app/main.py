from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .routers import account, ai, auth, compositions, media

s = settings()
app = FastAPI(title="harmonIA API", version=s.version, docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=[s.public_base], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
for r in (auth, compositions, media, ai, account):
    app.include_router(r.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "project": s.project, "version": s.version, "commit": s.git_sha}
