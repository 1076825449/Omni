"""
API v1 路由 — 与 /api/ 完全兼容的前缀版本
"""
from fastapi import APIRouter
from app.routers import auth, modules, tasks, files, logs
from app.routers.backups import router as backups_router
from app.routers.roles import router as roles_router
from app.routers.notifications import router as notifications_router
from app.routers.search import router as search_router
from app.routers.stats import router as stats_router
from app.routers.cross_links import router as cross_links_router
from app.modules.analysis_router import router as analysis_router
from app.modules.records_router import router as records_router
from app.modules.learning_lab_router import router as learning_lab_router

v1 = APIRouter(prefix="/api/v1", tags=["API v1"])

# 将所有现有路由挂载到 /api/v1 下
v1.include_router(auth.router)
v1.include_router(modules.router)
v1.include_router(tasks.router)
v1.include_router(files.router)
v1.include_router(logs.router)
v1.include_router(backups_router)
v1.include_router(roles_router)
v1.include_router(notifications_router)
v1.include_router(search_router)
v1.include_router(stats_router)
v1.include_router(cross_links_router)
v1.include_router(analysis_router)
v1.include_router(records_router)
v1.include_router(learning_lab_router)
