"""
Omni 统一平台 - 后端入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.database import engine, Base
from app.routers import auth, modules, tasks, files, logs


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时建表
    Base.metadata.create_all(bind=engine)
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


@app.get("/api/platform/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Omni Platform API"}
