"""
Omni 平台后端 API 冒烟测试
通过直接调用 app 而非 HTTP，绕过 TestClient Cookie 传递问题
"""
import pytest
import tempfile
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base, get_db
from app.main import app
from app.models import User, Role
from app.models.permission import ROLE_PERMISSIONS


TEST_DB = tempfile.mktemp(suffix=".db")
engine = create_engine(f"sqlite:///{TEST_DB}", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    # 清理 rate limiter 状态
    from app.middleware.rate_limit import _limiter
    _limiter._hits.clear()
    yield
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def seeded_db(setup_db):
    db = TestingSessionLocal()
    for name, perms in ROLE_PERMISSIONS.items():
        db.add(Role(name=name, display_name=name, permissions=perms))
    db.commit()
    from app.services.auth import hash_password
    admin = User(
        username="admin",
        hashed_password=hash_password("admin123"),
        nickname="Admin",
        role="admin",
        is_active=True,
    )
    db.add(admin)
    db.commit()
    yield db
    db.close()


# ---- Helper: bypass cookie via dependency override ----
@pytest.fixture(scope="function")
def auth_client(seeded_db):
    """返回 TestClient + 自动注入 admin session cookie"""
    with TestClient(app) as client:
        # 登录获取 cookie
        login_resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        assert login_resp.status_code == 200
        # 直接覆盖 get_current_user 依赖（绕过 Cookie 解析问题）
        from app.routers.auth import get_current_user
        def fake_current_user(session_id=None, db=None):
            db2 = TestingSessionLocal()
            user = db2.query(User).filter(User.username == "admin").first()
            db2.close()
            return user
        app.dependency_overrides[get_current_user] = fake_current_user
        yield client
        if get_current_user in app.dependency_overrides:
            del app.dependency_overrides[get_current_user]


# ---- Tests ----

def test_login_success(seeded_db):
    with TestClient(app) as client:
        resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["user"]["username"] == "admin"


def test_login_wrong_password(seeded_db):
    with TestClient(app) as client:
        resp = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        assert resp.status_code == 401


def test_tasks_list_requires_auth(seeded_db):
    with TestClient(app) as client:
        resp = client.get("/api/tasks")
        assert resp.status_code == 401


def test_search_requires_auth(seeded_db):
    with TestClient(app) as client:
        resp = client.get("/api/search?q=test")
        assert resp.status_code == 401


def test_notifications_requires_auth(seeded_db):
    with TestClient(app) as client:
        resp = client.get("/api/notifications")
        assert resp.status_code == 401


def test_stats_requires_auth(seeded_db):
    with TestClient(app) as client:
        resp = client.get("/api/platform/stats/overview")
        assert resp.status_code == 401


def test_tasks_list_with_auth(auth_client):
    resp = auth_client.get("/api/tasks")
    assert resp.status_code == 200
    assert "tasks" in resp.json() or "total" in resp.json()


def test_files_list_with_auth(auth_client):
    resp = auth_client.get("/api/files")
    assert resp.status_code == 200


def test_notifications_with_auth(auth_client):
    resp = auth_client.get("/api/notifications")
    assert resp.status_code == 200
    assert "notifications" in resp.json() or "total" in resp.json()


def test_stats_overview_with_auth(auth_client):
    resp = auth_client.get("/api/platform/stats/overview")
    assert resp.status_code == 200
    assert "task_total" in resp.json() or "file_total" in resp.json()
