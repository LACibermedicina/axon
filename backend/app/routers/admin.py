"""Administração (somente papel admin): usuários, papéis, bloqueio, estatísticas e auditoria LGPD."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.security import Role, current_user, decrypt
from ..models import Asset, AuditLog, Composition, Playlist, User

router = APIRouter(prefix="/api/admin", tags=["admin"])


def admin_only(user: User = Depends(current_user)) -> User:
    if user.role != Role.admin.value:
        raise HTTPException(403, "Acesso restrito ao administrador")
    return user


@router.get("/users")
def list_users(admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    counts = dict(db.execute(select(Composition.owner_id, func.count()).group_by(Composition.owner_id)).all())
    db.add(AuditLog(user_id=admin.id, action="admin_list_users")); db.commit()
    return [{"id": u.id, "name": decrypt(u.name_enc), "email": decrypt(u.email_enc), "role": u.role, "active": u.active,
             "compositions": counts.get(u.id, 0), "createdAt": u.created_at.isoformat(),
             "consentVersion": u.consent_version}
            for u in db.scalars(select(User).order_by(User.created_at.desc()))]


class UserPatch(BaseModel):
    role: Role | None = None
    active: bool | None = None


@router.patch("/users/{uid}")
def patch_user(uid: int, body: UserPatch, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "Usuário não encontrado")
    if u.id == admin.id and (body.active is False or (body.role and body.role != Role.admin)):
        raise HTTPException(400, "Você não pode remover o seu próprio acesso de administrador")
    if body.role:
        u.role = body.role.value
    if body.active is not None:
        u.active = body.active
    db.add(AuditLog(user_id=admin.id, action="admin_patch_user",
                    detail={"target": uid, "role": body.role and body.role.value, "active": body.active}))
    db.commit()
    return {"ok": True}


@router.get("/stats")
def stats(_: User = Depends(admin_only), db: Session = Depends(get_db)):
    c = lambda stmt: db.scalar(stmt) or 0  # noqa: E731
    return {
        "users": c(select(func.count()).select_from(User)),
        "activeUsers": c(select(func.count()).select_from(User).where(User.active.is_(True))),
        "compositions": c(select(func.count()).select_from(Composition)),
        "public": c(select(func.count()).select_from(Composition).where(Composition.visibility == "public")),
        "featured": c(select(func.count()).select_from(Composition).where(Composition.featured.is_(True))),
        "playlists": c(select(func.count()).select_from(Playlist)),
        "storageMB": round(c(select(func.sum(Asset.size))) / 1048576, 1),
    }


@router.get("/audit")
def audit(limit: int = 100, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    rows = db.scalars(select(AuditLog).order_by(AuditLog.at.desc()).limit(min(limit, 500)))
    return [{"id": a.id, "userId": a.user_id, "action": a.action, "detail": a.detail, "at": a.at.isoformat()} for a in rows]


@router.post("/compositions/{cid}/unpublish")
def unpublish(cid: int, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    """Moderação da biblioteca pública."""
    comp = db.get(Composition, cid)
    if not comp:
        raise HTTPException(404, "Composição não encontrada")
    comp.visibility, comp.featured = "private", False
    db.add(AuditLog(user_id=admin.id, action="admin_unpublish", detail={"composition": cid})); db.commit()
    return {"ok": True}
