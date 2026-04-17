"""
Omni 统一平台 - 后端入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.database import engine, Base, SessionLocal
from app.routers import auth, modules, tasks, files, logs
from app.routers.backups import router as backups_router
from app.routers.roles import router as roles_router
from app.routers.notifications import router as notifications_router
from app.routers.search import router as search_router
from app.routers.stats import router as stats_router
from app.routers.cross_links import router as cross_links_router
from app.modules.analysis_router import router as analysis_router
from app.modules.records_router import router as records_router
from app.models.permission import Role, ROLE_PERMISSIONS


def seed_roles():
    db = SessionLocal()
    try:
        for name, perms in ROLE_PERMISSIONS.items():
            existing = db.query(Role).filter(Role.name == name).first()
            display_names = {"admin": "管理员", "user": "普通用户", "viewer": "访客"}
            descriptions = {
                "admin": "拥有全部权限",
                "user": "可正常使用平台功能",
                "viewer": "仅可查看，不可操作",
            }
            if existing:
                existing.permissions = perms
                existing.display_name = display_names.get(name, name)
                existing.description = descriptions.get(name, "")
            else:
                db.add(Role(
                    name=name,
                    display_name=display_names.get(name, name),
                    description=descriptions.get(name, ""),
                    permissions=perms,
                ))
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_roles()
    yield


app = FastAPI(title="Omni Platform", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载路由
app.include_router(auth.router)
app.include_router(modules.router)
app.include_router(tasks.router)
app.include_router(files.router)
app.include_router(logs.router)
app.include_router(backups_router)
app.include_router(roles_router)
app.include_router(notifications_router)
app.include_router(search_router)
app.include_router(analysis_router)
app.include_router(records_router)
app.include_router(stats_router)
app.include_router(cross_links_router)


@app.get("/api/platform/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Omni Platform API"}
