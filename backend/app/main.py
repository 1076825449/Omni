"""
税务案头助手 - 后端入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text

from app.core.database import engine, Base, SessionLocal
from app.core.config import CORS_ORIGINS
from app.routers import auth, modules, tasks, files, logs
from app.routers.backups import router as backups_router
from app.routers.roles import router as roles_router
from app.routers.users import router as users_router
from app.routers.notifications import router as notifications_router
from app.routers.search import router as search_router
from app.routers.stats import router as stats_router
from app.routers.settings import router as platform_settings_router
from app.routers.workbench import router as workbench_router
from app.routers.cross_links import router as cross_links_router
from app.routers.maintenance import router as maintenance_router
from app.routers.v1 import v1 as api_v1_router
from app.modules.analysis_router import router as analysis_router
from app.modules.records_router import router as records_router
from app.modules.learning_lab_router import router as learning_lab_router
from app.modules.dashboard_router import router as dashboard_router
from app.modules.schedule_router import router as schedule_router
from app.modules.info_query_router import router as info_query_router
from app.modules.risk_ledger_router import router as risk_ledger_router
from app.routers.webhooks import router as webhooks_router
from app.routers.ws import websocket_endpoint
from app.routers.data_ops import router as data_ops_router
from app.models.permission import Role, ROLE_PERMISSIONS
from app.models.record import OperationLog
from app.models.settings import SystemSetting
from app.models.taxpayer import TaxpayerInfo


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


def ensure_lightweight_migrations():
    if engine.dialect.name == "sqlite":
        with engine.begin() as conn:
            columns = {row[1] for row in conn.execute(text("PRAGMA table_info(risk_ledger_entries)")).fetchall()}
            migrations = {
                "rectification_deadline": "ALTER TABLE risk_ledger_entries ADD COLUMN rectification_deadline DATETIME",
                "contact_person": "ALTER TABLE risk_ledger_entries ADD COLUMN contact_person VARCHAR(100) DEFAULT ''",
                "contact_phone": "ALTER TABLE risk_ledger_entries ADD COLUMN contact_phone VARCHAR(100) DEFAULT ''",
            }
            for column, sql in migrations.items():
                if column not in columns:
                    conn.execute(text(sql))
            task_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(tasks)")).fetchall()}
            task_migrations = {
                "taxpayer_id": "ALTER TABLE tasks ADD COLUMN taxpayer_id VARCHAR(64) DEFAULT ''",
                "company_name": "ALTER TABLE tasks ADD COLUMN company_name VARCHAR(255) DEFAULT ''",
            }
            for column, sql in task_migrations.items():
                if column not in task_columns:
                    conn.execute(text(sql))
            taxpayer_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(taxpayer_infos)")).fetchall()}
            taxpayer_migrations = {
                "industry_tag": "ALTER TABLE taxpayer_infos ADD COLUMN industry_tag VARCHAR(120) DEFAULT ''",
                "industry_tag_manual": "ALTER TABLE taxpayer_infos ADD COLUMN industry_tag_manual BOOLEAN DEFAULT 0 NOT NULL",
                "address_tag": "ALTER TABLE taxpayer_infos ADD COLUMN address_tag VARCHAR(120) DEFAULT ''",
                "address_tag_manual": "ALTER TABLE taxpayer_infos ADD COLUMN address_tag_manual BOOLEAN DEFAULT 0 NOT NULL",
                "last_used_at": "ALTER TABLE taxpayer_infos ADD COLUMN last_used_at DATETIME",
                "proposed_tax_officer": "ALTER TABLE taxpayer_infos ADD COLUMN proposed_tax_officer VARCHAR(100) DEFAULT ''",
            }
            for column, sql in taxpayer_migrations.items():
                if column not in taxpayer_columns:
                    conn.execute(text(sql))
            user_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()}
            if "must_change_password" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0 NOT NULL"))
    elif engine.dialect.name == "postgresql":
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE risk_ledger_entries ADD COLUMN IF NOT EXISTS rectification_deadline TIMESTAMP"))
            conn.execute(text("ALTER TABLE risk_ledger_entries ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100) DEFAULT ''"))
            conn.execute(text("ALTER TABLE risk_ledger_entries ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(100) DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS taxpayer_id VARCHAR(64) DEFAULT ''"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) DEFAULT ''"))
            conn.execute(text("ALTER TABLE taxpayer_infos ADD COLUMN IF NOT EXISTS industry_tag VARCHAR(120) DEFAULT ''"))
            conn.execute(text("ALTER TABLE taxpayer_infos ADD COLUMN IF NOT EXISTS industry_tag_manual BOOLEAN DEFAULT FALSE NOT NULL"))
            conn.execute(text("ALTER TABLE taxpayer_infos ADD COLUMN IF NOT EXISTS address_tag VARCHAR(120) DEFAULT ''"))
            conn.execute(text("ALTER TABLE taxpayer_infos ADD COLUMN IF NOT EXISTS address_tag_manual BOOLEAN DEFAULT FALSE NOT NULL"))
            conn.execute(text("ALTER TABLE taxpayer_infos ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP"))
            conn.execute(text("ALTER TABLE taxpayer_infos ADD COLUMN IF NOT EXISTS proposed_tax_officer VARCHAR(100) DEFAULT ''"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE NOT NULL"))


def ensure_taxpayer_industry_tags():
    from app.modules.info_query_router import INDUSTRY_TAG_RULE_VERSION, rebuild_industry_tags

    db = SessionLocal()
    try:
        owner_ids = [row[0] for row in db.query(TaxpayerInfo.owner_id).distinct().all()]
        for owner_id in owner_ids:
            setting = db.query(SystemSetting).filter(
                SystemSetting.owner_id == owner_id,
                SystemSetting.key == "taxpayer_industry_tag_rule_version",
            ).first()
            if setting and (setting.value or {}).get("version") == INDUSTRY_TAG_RULE_VERSION:
                continue
            changed = rebuild_industry_tags(db, owner_id)
            value = {"version": INDUSTRY_TAG_RULE_VERSION, "changed": changed}
            if setting:
                setting.value = value
            else:
                db.add(SystemSetting(
                    owner_id=owner_id,
                    key="taxpayer_industry_tag_rule_version",
                    value=value,
                ))
        db.commit()
    finally:
        db.close()


def ensure_taxpayer_address_tags():
    from app.modules.info_query_router import ADDRESS_TAG_RULE_VERSION, rebuild_address_tags

    db = SessionLocal()
    try:
        owner_ids = [row[0] for row in db.query(TaxpayerInfo.owner_id).distinct().all()]
        for owner_id in owner_ids:
            setting = db.query(SystemSetting).filter(
                SystemSetting.owner_id == owner_id,
                SystemSetting.key == "taxpayer_address_tag_rule_version",
            ).first()
            if setting and (setting.value or {}).get("version") == ADDRESS_TAG_RULE_VERSION:
                continue
            changed = rebuild_address_tags(db, owner_id)
            value = {"version": ADDRESS_TAG_RULE_VERSION, "changed": changed}
            if setting:
                setting.value = value
            else:
                db.add(SystemSetting(
                    owner_id=owner_id,
                    key="taxpayer_address_tag_rule_version",
                    value=value,
                ))
        db.commit()
    finally:
        db.close()


def ensure_existing_manual_tag_locks():
    db = SessionLocal()
    try:
        logs = db.query(OperationLog).filter(
            OperationLog.module == "info-query",
            OperationLog.action == "update_taxpayer_tags",
            OperationLog.result == "success",
        ).all()
        changed = 0
        for log in logs:
            taxpayer_ids = [item.strip() for item in (log.target_id or "").split(",") if item.strip()]
            if not taxpayer_ids:
                continue
            lock_industry = "行业标签" in (log.detail or "")
            lock_address = "地址标签" in (log.detail or "")
            if not lock_industry and not lock_address:
                continue
            rows = db.query(TaxpayerInfo).filter(
                TaxpayerInfo.owner_id == log.operator_id,
                TaxpayerInfo.taxpayer_id.in_(taxpayer_ids),
            ).all()
            for row in rows:
                if lock_industry and not row.industry_tag_manual:
                    row.industry_tag_manual = True
                    changed += 1
                if lock_address and not row.address_tag_manual:
                    row.address_tag_manual = True
                    changed += 1
        if changed:
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_lightweight_migrations()
    ensure_existing_manual_tag_locks()
    seed_roles()
    ensure_taxpayer_industry_tags()
    ensure_taxpayer_address_tags()
    # 加载插件
    from app.plugins import get_plugin_manager
    pm = get_plugin_manager()
    pm.call_hooks("on_startup", app=app)
    yield
    # 关闭时调用插件钩子
    pm.call_hooks("on_shutdown", app=app)
    # 关闭 WebSocket 管理器
    from app.routers.ws import manager
    manager._connections.clear()


app = FastAPI(
    title="税务案头助手",
    description="税务案头助手系统管理接口，提供纳税人信息、案头分析、风险台账、文书报告和系统管理能力。",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        *CORS_ORIGINS,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 速率限制中间件
from app.middleware.rate_limit import rate_limit_middleware
app.middleware("http")(rate_limit_middleware)

# 挂载路由
app.include_router(auth.router)
app.include_router(modules.router)
app.include_router(tasks.router)
app.include_router(files.router)
app.include_router(logs.router)
app.include_router(backups_router)
app.include_router(roles_router)
app.include_router(users_router)
app.include_router(notifications_router)
app.include_router(search_router)
app.include_router(analysis_router)
app.include_router(records_router)
app.include_router(learning_lab_router)
app.include_router(stats_router)
app.include_router(platform_settings_router)
app.include_router(workbench_router)
app.include_router(cross_links_router)
app.include_router(maintenance_router)
app.include_router(webhooks_router)
app.include_router(dashboard_router)
app.include_router(schedule_router)
app.include_router(info_query_router)
app.include_router(risk_ledger_router)
app.include_router(data_ops_router)

# WebSocket
app.add_websocket_route("/ws", websocket_endpoint)

app.include_router(api_v1_router)


@app.get("/")
def root():
    return {"message": "税务案头助手系统管理接口"}
