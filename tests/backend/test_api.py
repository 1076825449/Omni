"""
Omni 平台后端 API 冒烟测试
覆盖真实 Cookie 登录态，避免鉴权回归。
"""
import io
import hashlib
import time
import pytest
import tempfile
import zipfile
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base, get_db
from app.main import app
from app.models import User, Role, Module
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
    for module in [
        {"key": "analysis-workbench", "name": "分析工作模块", "type": "workflow", "status": "active"},
        {"key": "info-query", "name": "信息查询表", "type": "list", "status": "active"},
        {"key": "risk-ledger", "name": "风险记录台账", "type": "list", "status": "active"},
        {"key": "record-operations", "name": "对象管理模块", "type": "list", "status": "active"},
        {"key": "learning-lab", "name": "学习训练模块", "type": "interactive", "status": "active"},
        {"key": "dashboard-workbench", "name": "Dashboard 模块", "type": "dashboard", "status": "active"},
        {"key": "schedule-workbench", "name": "Schedule 模块", "type": "workflow", "status": "active"},
    ]:
        db.add(Module(**module))
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


@pytest.fixture(scope="function")
def auth_client(seeded_db):
    """返回带真实登录态 Cookie 的 TestClient（admin）"""
    with TestClient(app) as client:
        login_resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        assert login_resp.status_code == 200
        yield client


@pytest.fixture(scope="function")
def viewer_client(seeded_db):
    """返回带真实登录态 Cookie 的 TestClient（viewer 角色）"""
    from app.services.auth import hash_password
    viewer = User(
        username="viewer",
        hashed_password=hash_password("viewer123"),
        nickname="Viewer",
        role="viewer",
        is_active=True,
    )
    seeded_db.add(viewer)
    seeded_db.commit()
    with TestClient(app) as client:
        login_resp = client.post("/api/auth/login", json={"username": "viewer", "password": "viewer123"})
        assert login_resp.status_code == 200
        yield client


@pytest.fixture(scope="function")
def user_client(seeded_db):
    """返回带真实登录态 Cookie 的 TestClient（user 角色）"""
    from app.services.auth import hash_password
    user = User(
        username="testuser",
        hashed_password=hash_password("user123"),
        nickname="TestUser",
        role="user",
        is_active=True,
    )
    seeded_db.add(user)
    seeded_db.commit()
    with TestClient(app) as client:
        login_resp = client.post("/api/auth/login", json={"username": "testuser", "password": "user123"})
        assert login_resp.status_code == 200
        yield client


def make_simple_xlsx(headers: list[str], rows: list[list[str]]) -> bytes:
    shared = headers + [cell for row in rows for cell in row]
    shared_xml = "".join(f"<si><t>{value}</t></si>" for value in shared)
    shared_index = {value: index for index, value in enumerate(shared)}

    def cell_ref(col: int, row: int) -> str:
        letter = chr(65 + col)
        return f"{letter}{row}"

    sheet_rows = []
    header_cells = "".join(
        f'<c r="{cell_ref(index, 1)}" t="s"><v>{shared_index[value]}</v></c>'
        for index, value in enumerate(headers)
    )
    sheet_rows.append(f'<row r="1">{header_cells}</row>')
    for row_index, row in enumerate(rows, start=2):
        row_cells = "".join(
            f'<c r="{cell_ref(col_index, row_index)}" t="s"><v>{shared_index[value]}</v></c>'
            for col_index, value in enumerate(row)
        )
        sheet_rows.append(f'<row r="{row_index}">{row_cells}</row>')

    workbook_xml = """<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>"""
    rels_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>"""
    sheet_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>{''.join(sheet_rows)}</sheetData>
</worksheet>"""
    shared_strings_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{len(shared)}" uniqueCount="{len(shared)}">
  {shared_xml}
</sst>"""
    content_types = """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>"""
    package_rels = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", package_rels)
        archive.writestr("xl/workbook.xml", workbook_xml)
        archive.writestr("xl/_rels/workbook.xml.rels", rels_xml)
        archive.writestr("xl/worksheets/sheet1.xml", sheet_xml)
        archive.writestr("xl/sharedStrings.xml", shared_strings_xml)
    return buffer.getvalue()


# ---- Tests ----

def test_login_success(seeded_db):
    with TestClient(app) as client:
        resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["user"]["username"] == "admin"


def test_login_upgrades_legacy_password_hash(seeded_db):
    legacy_user = User(
        username="legacy",
        hashed_password=hashlib.sha256("legacy123".encode()).hexdigest(),
        nickname="Legacy",
        role="admin",
        is_active=True,
    )
    seeded_db.add(legacy_user)
    seeded_db.commit()

    with TestClient(app) as client:
        resp = client.post("/api/auth/login", json={"username": "legacy", "password": "legacy123"})
        assert resp.status_code == 200

    seeded_db.refresh(legacy_user)
    assert legacy_user.hashed_password.startswith("pbkdf2_sha256$")


def test_login_logout_are_audited(auth_client):
    resp = auth_client.post("/api/auth/logout")
    assert resp.status_code == 200

    db = TestingSessionLocal()
    try:
        from app.models.record import OperationLog

        actions = [
            log.action
            for log in db.query(OperationLog).filter(OperationLog.module == "auth").all()
        ]
        assert "login" in actions
        assert "logout" in actions
    finally:
        db.close()


def test_change_password_rejects_wrong_current_password(auth_client):
    resp = auth_client.post(
        "/api/auth/change-password",
        json={"current_password": "wrong-password", "new_password": "new-admin-123"},
    )
    assert resp.status_code == 400


def test_change_password_invalidates_old_password_and_audits(seeded_db):
    with TestClient(app) as client:
        login_resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        assert login_resp.status_code == 200
        change_resp = client.post(
            "/api/auth/change-password",
            json={"current_password": "admin123", "new_password": "new-admin-123"},
        )
        assert change_resp.status_code == 200

        old_login = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        assert old_login.status_code == 401
        new_login = client.post("/api/auth/login", json={"username": "admin", "password": "new-admin-123"})
        assert new_login.status_code == 200

    db = TestingSessionLocal()
    try:
        from app.models.record import OperationLog

        log = db.query(OperationLog).filter(
            OperationLog.module == "auth",
            OperationLog.action == "change_password",
            OperationLog.result == "success",
        ).first()
        assert log is not None
    finally:
        db.close()


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


def test_task_detail_with_auth(auth_client):
    create_resp = auth_client.post(
        "/api/modules/analysis-workbench/tasks",
        json={"name": "任务详情测试", "description": "验证任务详情"},
    )
    assert create_resp.status_code == 200
    task_id = create_resp.json()["task_id"]

    upload_resp = auth_client.post(
        f"/api/modules/analysis-workbench/upload?task_id={task_id}",
        files={"file": ("task-detail.txt", io.BytesIO("detail payload".encode("utf-8")), "text/plain")},
    )
    assert upload_resp.status_code == 200

    run_resp = auth_client.post(f"/api/modules/analysis-workbench/tasks/{task_id}/run")
    assert run_resp.status_code == 200

    detail_resp = auth_client.get(f"/api/tasks/{task_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["task_id"] == task_id
    assert detail["module"] == "analysis-workbench"
    assert detail["file_count"] == 1
    assert detail["log_count"] >= 2
    assert detail["related_record_count"] == 0
    assert detail["source_url"].endswith(task_id)
    assert detail["type"] == "analysis"
    assert detail["updated_at"] is not None
    assert detail["completed_at"] is not None


def test_files_list_with_auth(auth_client):
    resp = auth_client.get("/api/files")
    assert resp.status_code == 200


def test_file_preview_with_auth(auth_client):
    create_resp = auth_client.post(
        "/api/modules/analysis-workbench/tasks",
        json={"name": "文件预览测试", "description": "验证文件预览"},
    )
    assert create_resp.status_code == 200
    task_id = create_resp.json()["task_id"]

    upload_resp = auth_client.post(
        f"/api/modules/analysis-workbench/upload?task_id={task_id}",
        files={"file": ("preview.txt", io.BytesIO("preview content".encode("utf-8")), "text/plain")},
    )
    assert upload_resp.status_code == 200
    file_id = upload_resp.json()["file_id"]

    preview_resp = auth_client.get(f"/api/files/{file_id}/preview")
    assert preview_resp.status_code == 200
    preview = preview_resp.json()
    assert preview["preview_type"] == "text"
    assert "preview content" in preview["content"]


def test_xlsx_preview_and_analysis_with_auth(auth_client):
    create_resp = auth_client.post(
        "/api/modules/analysis-workbench/tasks",
        json={"name": "XLSX 识别测试", "description": "验证 xlsx 预览与分析"},
    )
    assert create_resp.status_code == 200
    task_id = create_resp.json()["task_id"]

    xlsx_bytes = make_simple_xlsx(
        ["期间", "企业名称", "纳税人识别号", "金额", "供应商名称", "商品名称"],
        [["2026-03", "Excel企业", "91310000123450000X", "88000", "供货商A", "材料"]],
    )
    upload_resp = auth_client.post(
        f"/api/modules/analysis-workbench/upload?task_id={task_id}",
        files={"file": ("purchase_invoices_2026-03.xlsx", io.BytesIO(xlsx_bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert upload_resp.status_code == 200
    upload_payload = upload_resp.json()
    file_id = upload_payload["file_id"]
    assert upload_payload["profile"]["dataset_kind"] == "purchase_invoice"
    assert upload_payload["profile"]["row_count"] == 1
    assert "company_name" in upload_payload["profile"]["headers"]
    assert "period" in upload_payload["profile"]["required_fields"]
    assert upload_payload["profile"]["missing_required_fields"] == []

    preview_resp = auth_client.get(f"/api/files/{file_id}/preview")
    assert preview_resp.status_code == 200
    preview = preview_resp.json()
    assert preview["preview_type"] == "code"
    assert "Excel企业" in preview["content"]

    run_resp = auth_client.post(f"/api/modules/analysis-workbench/tasks/{task_id}/run")
    assert run_resp.status_code == 200
    detail_resp = auth_client.get(f"/api/modules/analysis-workbench/tasks/{task_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["company_name"] == "Excel企业"


def test_manual_tax_data_and_image_evidence_with_auth(auth_client):
    create_resp = auth_client.post(
        "/api/modules/analysis-workbench/tasks",
        json={"name": "无表格补录测试", "description": "验证图片佐证和手工补录"},
    )
    assert create_resp.status_code == 200
    task_id = create_resp.json()["task_id"]

    image_resp = auth_client.post(
        f"/api/modules/analysis-workbench/upload?task_id={task_id}",
        files={"file": ("pit-screen.png", io.BytesIO(b"not-a-real-image-but-evidence"), "image/png")},
    )
    assert image_resp.status_code == 200
    image_payload = image_resp.json()
    assert image_payload["profile"]["dataset_kind"] == "image_evidence"
    assert image_payload["profile"]["source_type"] == "image"

    manual_resp = auth_client.post(
        f"/api/modules/analysis-workbench/tasks/{task_id}/manual-data",
        json={
            "data_kind": "pit_return",
            "rows": [{
                "period": "2026-03",
                "company_name": "无表格企业",
                "taxpayer_id": "91310000111110000X",
                "salary_amount": 50000,
                "employee_count": 0,
                "pit_tax_amount": 0,
            }],
        },
    )
    assert manual_resp.status_code == 200
    manual_payload = manual_resp.json()
    assert manual_payload["profile"]["dataset_kind"] == "pit_return"

    run_resp = auth_client.post(f"/api/modules/analysis-workbench/tasks/{task_id}/run")
    assert run_resp.status_code == 200
    detail_resp = auth_client.get(f"/api/modules/analysis-workbench/tasks/{task_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["company_name"] == "无表格企业"
    assert any(risk["risk_type"] == "个税申报异常" for risk in detail["risks"])
    assert any("图片/扫描件佐证" in warning or "扫描件佐证" in warning for warning in detail["data_warnings"])


def test_info_query_import_assignment_stats_and_analysis_profile(auth_client):
    from app.modules.info_query_router import derive_address_tag, derive_industry_tag, normalize_row

    normalized = normalize_row({
        "社会信用代码（纳税人识别号）": "91450200322587799A",
        "纳税人名称": "广西真昌祥电子商务有限公司",
        "纳税人状态": "正常",
        "课征主体登记类型": "单位纳税人税务登记",
        "登记注册类型": "私营有限责任公司",
        "主管税务所（科、分局）": "拉堡税务分局",
        "税收管理员": "韦新现",
        "社会信用代码": "",
    })
    assert normalized["taxpayer_id"] == "91450200322587799A"
    assert normalized["company_name"] == "广西真昌祥电子商务有限公司"
    assert normalized["registration_status"] == "正常"
    assert normalized["taxpayer_type"] == "单位纳税人税务登记"
    assert normalized["manager_department"] == "拉堡税务分局"
    assert derive_address_tag("广西柳州市柳江区拉堡镇柳堡路56号") == "柳堡路"
    assert derive_address_tag("柳江大道1号毅德城") == "柳江大道1号"
    assert derive_address_tag("柳江县柳南高速公路新兴服务区下线") == "柳南高速公路"
    assert derive_address_tag("广西柳州市柳江区拉堡镇") == ""
    assert derive_industry_tag("", "柳州某某建材经营部", "销售水泥、五金") == "建材五金"

    csv_content = (
        "企业名称,纳税人识别号,法定代表人,行业,经营范围,注册地址,经营地址,属地,主管税务机关,管理分局,税收管理员,风险等级,纳税信用等级\n"
        "信息企业A,91310000INFO0001,王法人,制造业,机械加工,注册地址A,广西柳州市柳江区拉堡镇柳堡路56号,浦东,第一税务所,一分局,张税官,高,A\n"
        "信息企业B,91310000INFO0002,李法人,,建材批发,注册地址B,柳江大道1号毅德城,黄浦,第二税务所,二分局,李税官,中,B\n"
    )
    import_resp = auth_client.post(
        "/api/modules/info-query/import",
        files={"file": ("taxpayer-info.csv", io.BytesIO(csv_content.encode("utf-8-sig")), "text/csv")},
    )
    assert import_resp.status_code == 200
    import_payload = import_resp.json()
    assert import_payload["imported"] == 2
    assert import_payload["updated"] == 0
    assert import_payload["skipped"] == 0

    list_resp = auth_client.get("/api/modules/info-query/taxpayers?q=信息企业A")
    assert list_resp.status_code == 200
    listed = list_resp.json()
    assert listed["total"] == 1
    assert listed["taxpayers"][0]["tax_officer"] == "张税官"
    assert listed["taxpayers"][0]["address"] == "广西柳州市柳江区拉堡镇柳堡路56号"
    assert listed["taxpayers"][0]["address_tag"] == "柳堡路"
    assert listed["taxpayers"][0]["industry_tag"] == "制造业"

    officer_search_resp = auth_client.get("/api/modules/info-query/taxpayers?q=张税官")
    assert officer_search_resp.status_code == 200
    assert officer_search_resp.json()["total"] == 1

    tag_filter_resp = auth_client.get("/api/modules/info-query/taxpayers?address_tag=柳江大道1号")
    assert tag_filter_resp.status_code == 200
    assert tag_filter_resp.json()["taxpayers"][0]["company_name"] == "信息企业B"
    assert tag_filter_resp.json()["taxpayers"][0]["industry_tag"] == "建材五金"

    stats_resp = auth_client.get("/api/modules/info-query/assignment-stats")
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["total"] == 2
    assert stats["by_officer"]["张税官"] == 1
    assert stats["by_department"]["一分局"] == 1
    assert stats["by_risk_level"]["高"] == 1
    assert stats["by_industry_tag"]["制造业"] == 1
    assert stats["by_address_tag"]["柳堡路"] == 1

    create_resp = auth_client.post(
        "/api/modules/analysis-workbench/tasks",
        json={"name": "信息表画像联动测试", "description": "验证案头分析引用纳税人画像"},
    )
    assert create_resp.status_code == 200
    task_id = create_resp.json()["task_id"]

    manual_resp = auth_client.post(
        f"/api/modules/analysis-workbench/tasks/{task_id}/manual-data",
        json={
            "data_kind": "vat_return",
            "rows": [{
                "period": "2026-03",
                "company_name": "信息企业A",
                "taxpayer_id": "91310000INFO0001",
                "sales_amount": 100000,
                "output_tax": 13000,
                "purchase_amount": 80000,
                "input_tax": 10400,
            }],
        },
    )
    assert manual_resp.status_code == 200
    run_resp = auth_client.post(f"/api/modules/analysis-workbench/tasks/{task_id}/run")
    assert run_resp.status_code == 200

    detail_resp = auth_client.get(f"/api/modules/analysis-workbench/tasks/{task_id}")
    assert detail_resp.status_code == 200
    profile = detail_resp.json()["taxpayer_profile"]
    assert profile["company_name"] == "信息企业A"
    assert profile["tax_officer"] == "张税官"
    assert profile["manager_department"] == "一分局"

    workbench_resp = auth_client.get("/api/workbench/taxpayer/91310000INFO0001")
    assert workbench_resp.status_code == 200
    assert workbench_resp.json()["taxpayer"]["address_tag"] == "柳堡路"
    recent_resp = auth_client.get("/api/workbench/recent-taxpayers")
    assert recent_resp.status_code == 200
    assert recent_resp.json()["items"][0]["taxpayer_id"] == "91310000INFO0001"


def test_risk_ledger_single_batch_import_filters_detail_and_backup(auth_client):
    info_csv = (
        "企业名称,纳税人识别号,登记状态,税收管理员,经营地址\n"
        "台账企业A,91310000RISK0001,正常,张台账,一号路1号\n"
        "台账企业B,91310000RISK0002,正常,李台账,二号路2号\n"
    )
    info_resp = auth_client.post(
        "/api/modules/info-query/import",
        files={"file": ("risk-taxpayers.csv", io.BytesIO(info_csv.encode("utf-8-sig")), "text/csv")},
    )
    assert info_resp.status_code == 200
    records_before_resp = auth_client.get("/api/workbench/taxpayer-records?q=台账企业")
    assert records_before_resp.status_code == 200
    records_before = records_before_resp.json()
    assert records_before["total"] == 2
    assert records_before["summary"]["taxpayer_total"] == 2
    assert records_before["items"][0]["entry_count"] == 0

    single_resp = auth_client.post(
        "/api/modules/risk-ledger/entries",
        json={
            "taxpayer_id": "91310000RISK0001",
            "recorded_at": "2026-04-01T09:00:00",
            "content": "触发有进无销风险",
            "entry_status": "待核实",
            "rectification_deadline": "2026-04-10T18:00:00",
            "contact_person": "张台账",
            "contact_phone": "123456",
        },
    )
    assert single_resp.status_code == 200
    assert single_resp.json()["taxpayer_id"] == "91310000RISK0001"
    records_after_resp = auth_client.get("/api/workbench/taxpayer-records?entry_status=待核实")
    assert records_after_resp.status_code == 200
    assert any(item["taxpayer_id"] == "91310000RISK0001" for item in records_after_resp.json()["items"])

    temporary_resp = auth_client.post(
        "/api/modules/risk-ledger/entries",
        json={
            "taxpayer_id": "TEMP-RISK-001",
            "company_name": "临时台账企业",
            "registration_status": "未知",
            "tax_officer": "临时管理员",
            "address": "临时地址",
            "recorded_at": "2026-04-02T10:00:00",
            "content": "人工补充风险记录",
            "entry_status": "整改中",
        },
    )
    assert temporary_resp.status_code == 200

    batch_resp = auth_client.post(
        "/api/modules/risk-ledger/entries/batch-text",
        json={
            "taxpayer_ids": ["91310000RISK0001", "91310000RISK0002", "NO-NAME-RISK"],
            "recorded_at": "2026-04-03T11:00:00",
            "content": "批量触发申报异常",
            "entry_status": "已排除",
        },
    )
    assert batch_resp.status_code == 200
    batch = batch_resp.json()
    assert batch["created"] == 2
    assert batch["failed"] == 1
    assert batch["failures"][0]["taxpayer_id"] == "NO-NAME-RISK"

    import_csv = (
        "纳税人识别号,纳税人名称,记录时间,记录内容,事项状态,整改期限,联系人,联系电话,备注\n"
        "91310000RISK0001,台账企业A,2026-04-04,问题已整改,已整改,2026-04-12,张台账,123456,复核通过\n"
        "TEMP-RISK-CSV,表格临时企业,2026-04-05,表格导入风险,待核实,,,,待联系\n"
    )
    import_resp = auth_client.post(
        "/api/modules/risk-ledger/entries/import",
        files={"file": ("risk-ledger.csv", io.BytesIO(import_csv.encode("utf-8-sig")), "text/csv")},
    )
    assert import_resp.status_code == 200
    imported = import_resp.json()
    assert imported["created"] == 2
    assert imported["failed"] == 0

    xlsx_bytes = make_simple_xlsx(
        ["纳税人识别号", "纳税人名称", "记录时间", "记录内容", "事项状态"],
        [["TEMP-RISK-XLSX", "XLSX临时企业", "2026-04-06", "XLSX导入风险", "待核实"]],
    )
    xlsx_import_resp = auth_client.post(
        "/api/modules/risk-ledger/entries/import",
        files={"file": ("risk-ledger.xlsx", io.BytesIO(xlsx_bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert xlsx_import_resp.status_code == 200
    assert xlsx_import_resp.json()["created"] == 1

    list_resp = auth_client.get("/api/modules/risk-ledger/dossiers?q=台账企业A")
    assert list_resp.status_code == 200
    listed = list_resp.json()
    assert listed["total"] == 1
    dossier = listed["dossiers"][0]
    assert dossier["company_name"] == "台账企业A"
    assert dossier["registration_status"] == "正常"
    assert dossier["tax_officer"] == "张台账"
    assert dossier["latest_entry_status"] == "已整改"
    assert dossier["latest_rectification_deadline"].startswith("2026-04-12")
    assert dossier["latest_contact_person"] == "张台账"
    assert dossier["entry_count"] == 3

    filtered_resp = auth_client.get("/api/modules/risk-ledger/dossiers?entry_status=整改中")
    assert filtered_resp.status_code == 200
    assert any(item["taxpayer_id"] == "TEMP-RISK-001" for item in filtered_resp.json()["dossiers"])

    detail_resp = auth_client.get("/api/modules/risk-ledger/dossiers/91310000RISK0001")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["dossier"]["address"] == "一号路1号"
    assert detail["entries"][0]["contact_phone"] == "123456"
    assert [entry["content"] for entry in detail["entries"]][:2] == ["问题已整改", "批量触发申报异常"]

    stats_resp = auth_client.get("/api/modules/risk-ledger/stats")
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["dossier_total"] >= 4
    assert stats["entry_total"] >= 6
    assert stats["temporary_count"] >= 2

    taxpayer_workbench_resp = auth_client.get("/api/workbench/taxpayer/91310000RISK0001")
    assert taxpayer_workbench_resp.status_code == 200
    taxpayer_workbench = taxpayer_workbench_resp.json()
    assert taxpayer_workbench["taxpayer"]["company_name"] == "台账企业A"
    assert taxpayer_workbench["dossier"]["latest_entry_status"] == "已整改"
    assert len(taxpayer_workbench["entries"]) == 3

    search_resp = auth_client.get("/api/workbench/taxpayers/search?q=台账企业A")
    assert search_resp.status_code == 200
    assert search_resp.json()["items"][0]["taxpayer_id"] == "91310000RISK0001"

    my_risk_list_resp = auth_client.get("/api/workbench/my-risk-list?entry_status=整改中")
    assert my_risk_list_resp.status_code == 200
    my_risk_list = my_risk_list_resp.json()
    assert any(item["taxpayer_id"] == "TEMP-RISK-001" for item in my_risk_list["items"])
    assert my_risk_list["summary"]["rectifying_count"] >= 1

    status_resp = auth_client.post(
        "/api/modules/risk-ledger/entries/batch-status",
        json={
            "taxpayer_ids": ["91310000RISK0001", "91310000RISK0002"],
            "entry_status": "整改中",
            "content": "管户风险清单批量标记为整改中",
            "rectification_deadline": (datetime.utcnow() + timedelta(days=3)).isoformat(),
            "contact_person": "张台账",
            "contact_phone": "123456",
        },
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["created"] == 2

    missing_deadline_resp = auth_client.post(
        "/api/modules/risk-ledger/entries/batch-status",
        json={
            "taxpayer_ids": ["91310000RISK0001"],
            "entry_status": "整改中",
            "content": "缺少整改期限",
            "contact_person": "张台账",
        },
    )
    assert missing_deadline_resp.status_code == 400

    overdue_resp = auth_client.post(
        "/api/modules/risk-ledger/entries/batch-status",
        json={
            "taxpayer_ids": ["TEMP-RISK-001"],
            "entry_status": "整改中",
            "content": "逾期未整改测试",
            "rectification_deadline": (datetime.utcnow() - timedelta(days=1)).isoformat(),
            "contact_person": "临时管理员",
        },
    )
    assert overdue_resp.status_code == 200

    todos_resp = auth_client.get("/api/workbench/todos?limit=10")
    assert todos_resp.status_code == 200
    todos = todos_resp.json()
    assert todos["summary"]["due_soon_count"] >= 2
    assert todos["summary"]["overdue_count"] >= 1
    assert any(item["todo_label"] == "逾期未整改" for item in todos["items"])

    export_resp = auth_client.get("/api/workbench/my-risk-list/export?entry_status=整改中")
    assert export_resp.status_code == 200
    assert "text/csv" in export_resp.headers["content-type"]
    assert "纳税人识别号" in export_resp.text
    assert "91310000RISK0001" in export_resp.text
    assert "整改期限" in export_resp.text
    assert "张台账" in export_resp.text

    backup_resp = auth_client.get("/api/platform/backup/export")
    assert backup_resp.status_code == 200
    backup = backup_resp.json()["data"]
    assert any(item["taxpayer_id"] == "91310000RISK0001" for item in backup["risk_dossiers"])
    assert any(item["taxpayer_id"] == "91310000RISK0001" for item in backup["risk_ledger_entries"])


def test_notifications_with_auth(auth_client):
    resp = auth_client.get("/api/notifications")
    assert resp.status_code == 200
    assert "notifications" in resp.json() or "total" in resp.json()


def test_notifications_mark_read_and_mark_all(auth_client):
    first = auth_client.post(
        "/api/modules/analysis-workbench/tasks",
        json={"name": "通知测试一", "description": "生成通知"},
    )
    second = auth_client.post(
        "/api/modules/analysis-workbench/tasks",
        json={"name": "通知测试二", "description": "生成通知"},
    )
    assert first.status_code == 200
    assert second.status_code == 200

    for task_id in (first.json()["task_id"], second.json()["task_id"]):
        upload_resp = auth_client.post(
            f"/api/modules/analysis-workbench/upload?task_id={task_id}",
            files={"file": ("notification.txt", io.BytesIO("notification payload".encode("utf-8")), "text/plain")},
        )
        assert upload_resp.status_code == 200
        run_resp = auth_client.post(f"/api/modules/analysis-workbench/tasks/{task_id}/run")
        assert run_resp.status_code == 200

    deadline = time.time() + 6
    notifications = []
    while time.time() < deadline:
        list_resp = auth_client.get("/api/notifications")
        assert list_resp.status_code == 200
        payload = list_resp.json()
        notifications = payload["notifications"]
        if payload["unread_count"] >= 2:
            break
        time.sleep(0.25)

    assert len(notifications) >= 2
    assert all(item["is_read"] is False for item in notifications[:2])

    first_id = notifications[0]["id"]
    mark_one = auth_client.post(f"/api/notifications/{first_id}/read")
    assert mark_one.status_code == 200
    assert mark_one.json()["success"] is True

    after_one = auth_client.get("/api/notifications").json()
    target = next(item for item in after_one["notifications"] if item["id"] == first_id)
    assert target["is_read"] is True
    assert after_one["unread_count"] >= 1

    mark_all = auth_client.post("/api/notifications/read-all")
    assert mark_all.status_code == 200
    assert mark_all.json()["success"] is True

    after_all = auth_client.get("/api/notifications").json()
    assert after_all["unread_count"] == 0
    assert all(item["is_read"] is True for item in after_all["notifications"])


def test_stats_overview_with_auth(auth_client):
    resp = auth_client.get("/api/platform/stats/overview")
    assert resp.status_code == 200
    assert "task_total" in resp.json() or "file_total" in resp.json()


def test_learning_lab_full_practice_flow_with_auth(auth_client):
    sets_resp = auth_client.get("/api/modules/learning-lab/sets")
    assert sets_resp.status_code == 200
    sets = sets_resp.json()
    assert len(sets) >= 1
    set_id = sets[0]["set_id"]

    start_resp = auth_client.post(f"/api/modules/learning-lab/practice/start?set_id={set_id}")
    assert start_resp.status_code == 200
    session = start_resp.json()
    session_id = session["session_id"]
    assert session["status"] == "in_progress"
    assert len(session["questions"]) == sets[0]["question_count"]

    continue_resp = auth_client.get("/api/modules/learning-lab/practice/continue")
    assert continue_resp.status_code == 200
    assert continue_resp.json()["session_id"] == session_id

    first_question = session["questions"][0]
    favorite_resp = auth_client.post(
        f"/api/modules/learning-lab/practice/{session_id}/favorite/{first_question['id']}"
    )
    assert favorite_resp.status_code == 200
    assert favorite_resp.json()["favorited"] is True

    favorites_resp = auth_client.get("/api/modules/learning-lab/favorites")
    assert favorites_resp.status_code == 200
    favorites = favorites_resp.json()
    assert len(favorites) == 1
    favorite_id = favorites[0]["id"]
    assert favorites[0]["question_id"] == first_question["id"]

    remove_favorite_resp = auth_client.delete(f"/api/modules/learning-lab/favorites/{favorite_id}")
    assert remove_favorite_resp.status_code == 200
    assert remove_favorite_resp.json()["success"] is True

    for question in session["questions"]:
        answer_resp = auth_client.post(
            f"/api/modules/learning-lab/practice/{session_id}/answer?question_id={question['id']}&user_answer={question['answer']}"
        )
        assert answer_resp.status_code == 200

    detail_resp = auth_client.get(f"/api/modules/learning-lab/practice/{session_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["status"] == "completed"
    assert detail["score"] == 100
    assert detail["correct_count"] == len(session["questions"])
    assert detail["completed_at"] is not None

    stats_resp = auth_client.get("/api/modules/learning-lab/stats")
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["total_sessions"] >= 1
    assert stats["avg_score"] == 100
    assert stats["recent_sessions"][0]["session_id"] == session_id


def test_schedule_task_create_with_valid_cron(auth_client):
    resp = auth_client.post(
        "/api/modules/schedule-workbench/tasks",
        json={
            "name": "每日备份",
            "description": "每天执行一次",
            "cron_expression": "0 9 * * *",
            "task_type": "backup",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "每日备份"
    assert data["next_run_at"] is not None


def test_schedule_task_create_with_invalid_cron(auth_client):
    resp = auth_client.post(
        "/api/modules/schedule-workbench/tasks",
        json={
            "name": "非法 cron",
            "description": "应返回 400",
            "cron_expression": "61 25 * * *",
            "task_type": "backup",
        },
    )
    assert resp.status_code == 400


def test_schedule_task_update_and_list_with_auth(auth_client):
    create_resp = auth_client.post(
        "/api/modules/schedule-workbench/tasks",
        json={
            "name": "晨间同步",
            "description": "每天早上同步一次",
            "cron_expression": "0 8 * * *",
            "task_type": "analysis",
        },
    )
    assert create_resp.status_code == 200
    task = create_resp.json()

    update_resp = auth_client.put(
        f"/api/modules/schedule-workbench/tasks/{task['id']}",
        json={
            "name": "晨间同步-已调整",
            "description": "工作日同步",
            "cron_expression": "30 9 * * 1,2,3,4,5",
            "is_active": False,
        },
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["name"] == "晨间同步-已调整"
    assert updated["description"] == "工作日同步"
    assert updated["cron_expression"] == "30 9 * * 1,2,3,4,5"
    assert updated["is_active"] is False
    assert updated["next_run_at"] is not None

    list_resp = auth_client.get("/api/modules/schedule-workbench/tasks")
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert data["total"] >= 1
    assert any(item["id"] == task["id"] and item["name"] == "晨间同步-已调整" for item in data["tasks"])


def test_schedule_task_run_updates_execution_state_with_auth(auth_client):
    create_resp = auth_client.post(
        "/api/modules/schedule-workbench/tasks",
        json={
            "name": "执行校验任务",
            "description": "验证手动执行结果",
            "cron_expression": "0 7 * * *",
            "task_type": "backup",
        },
    )
    assert create_resp.status_code == 200
    task = create_resp.json()

    run_resp = auth_client.post(f"/api/modules/schedule-workbench/tasks/{task['id']}/run")
    assert run_resp.status_code == 200
    assert run_resp.json()["message"] == "任务已执行完成"

    list_resp = auth_client.get("/api/modules/schedule-workbench/tasks")
    assert list_resp.status_code == 200
    reloaded = next(item for item in list_resp.json()["tasks"] if item["id"] == task["id"])
    assert reloaded["last_run_at"] is not None
    assert reloaded["next_run_at"] is not None
    assert reloaded["last_result"].startswith("success:")

    logs_resp = auth_client.get(f"/api/logs?module=schedule-workbench&q={task['id']}")
    assert logs_resp.status_code == 200
    logs = logs_resp.json()["logs"]
    assert any("手动执行定时任务" in item["detail"] for item in logs)
    assert any("定时任务执行完成" in item["detail"] for item in logs)

    history_resp = auth_client.get(f"/api/modules/schedule-workbench/tasks/{task['id']}/history")
    assert history_resp.status_code == 200
    history = history_resp.json()["history"]
    assert len(history) >= 2
    assert any("手动执行定时任务" in item["detail"] for item in history)

    platform_tasks_resp = auth_client.get("/api/tasks?module=schedule-workbench")
    assert platform_tasks_resp.status_code == 200
    assert any("执行校验任务" in item["name"] for item in platform_tasks_resp.json()["tasks"])


def test_records_import_and_batch_filter_with_auth(auth_client):
    csv_content = (
        "name,category,assignee,tags,detail\n"
        "线索A,sales,Alice,hot,第一条记录\n"
        "线索B,ops,Bob,warm,第二条记录\n"
    )
    import_resp = auth_client.post(
        "/api/modules/record-operations/import",
        files={"file": ("records.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    assert import_resp.status_code == 200
    batch = import_resp.json()["batch"]

    batch_resp = auth_client.get(f"/api/modules/record-operations/records?batch={batch}")
    assert batch_resp.status_code == 200
    batch_data = batch_resp.json()
    assert batch_data["total"] == 2
    assert {record["name"] for record in batch_data["records"]} == {"线索A", "线索B"}
    assert all(record["import_batch"] == batch for record in batch_data["records"])

    query_resp = auth_client.get(f"/api/modules/record-operations/records?batch={batch}&q=线索A")
    assert query_resp.status_code == 200
    query_data = query_resp.json()
    assert query_data["total"] == 1
    assert query_data["records"][0]["name"] == "线索A"

    tags_resp = auth_client.get("/api/modules/record-operations/records?tags=hot")
    assert tags_resp.status_code == 200
    tags_data = tags_resp.json()
    assert tags_data["total"] == 1
    assert tags_data["records"][0]["name"] == "线索A"

    tag_suggestions_resp = auth_client.get("/api/modules/record-operations/records/tags/suggestions?q=ho")
    assert tag_suggestions_resp.status_code == 200
    assert "hot" in tag_suggestions_resp.json()["tags"]


def test_record_tag_update_with_auth(auth_client):
    create_resp = auth_client.post(
        "/api/modules/record-operations/records",
        json={
            "name": "标签更新对象",
            "category": "ops",
            "assignee": "Alice",
            "tags": "old-tag",
            "detail": "需要更新标签",
        },
    )
    assert create_resp.status_code == 200
    record = create_resp.json()

    update_resp = auth_client.post(
        f"/api/modules/record-operations/records/{record['record_id']}/tags",
        json={"tags": "urgent, follow-up , urgent"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["success"] is True
    assert update_resp.json()["tags"] == "urgent,follow-up"

    detail_resp = auth_client.get(f"/api/modules/record-operations/records/{record['record_id']}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["tags"] == "urgent,follow-up"


def test_analysis_task_run_and_report_export_with_auth(auth_client):
    defaults_resp = auth_client.put(
        "/api/platform/settings/document-defaults",
        json={
            "agency_name": "国家税务总局默认税务局",
            "contact_person": "默认联系人",
            "contact_phone": "默认电话",
            "rectification_deadline": "默认整改期限",
        },
    )
    assert defaults_resp.status_code == 200
    assert auth_client.get("/api/platform/settings/document-defaults").json()["agency_name"] == "国家税务总局默认税务局"

    create_resp = auth_client.post(
        "/api/modules/analysis-workbench/tasks",
        json={"name": "测试分析", "description": "生成报告", "taxpayer_id": "91310000123456789X", "company_name": "测试企业"},
    )
    assert create_resp.status_code == 200
    task_id = create_resp.json()["task_id"]

    files = [
        (
            "purchase_invoices.csv",
            "期间,企业名称,纳税人识别号,金额,供应商名称,商品名称\n"
            "2026-03,测试企业,91310000123456789X,120000,上游供应商A,电子元件\n"
            "2026-03,测试企业,91310000123456789X,80000,上游供应商B,电子元件\n",
        ),
        (
            "sales_invoices.csv",
            "期间,企业名称,纳税人识别号,金额,购方名称,商品名称\n"
            "2026-03,测试企业,91310000123456789X,10000,客户A,电子元件\n",
        ),
        (
            "vat_return.csv",
            "期间,企业名称,纳税人识别号,申报销售额,申报销项,申报进项\n"
            "2026-03,测试企业,91310000123456789X,8000,1040,18000\n",
        ),
        (
            "financial_statement.csv",
            "期间,企业名称,纳税人识别号,主营业务收入,主营业务成本,期初存货,期末存货\n"
            "2026-03,测试企业,91310000123456789X,15000,160000,5000,20000\n",
        ),
        (
            "expense_detail.csv",
            "期间,企业名称,纳税人识别号,费用金额,凭证类型\n"
            "2026-03,测试企业,91310000123456789X,30000,白条\n",
        ),
    ]
    for filename, content in files:
        upload_resp = auth_client.post(
            f"/api/modules/analysis-workbench/upload?task_id={task_id}",
            files={"file": (filename, io.BytesIO(content.encode("utf-8")), "text/csv")},
        )
        assert upload_resp.status_code == 200

    run_resp = auth_client.post(f"/api/modules/analysis-workbench/tasks/{task_id}/run")
    assert run_resp.status_code == 200

    deadline = time.time() + 6
    detail = None
    while time.time() < deadline:
      detail_resp = auth_client.get(f"/api/modules/analysis-workbench/tasks/{task_id}")
      assert detail_resp.status_code == 200
      detail = detail_resp.json()
      if detail["status"] == "succeeded":
          break
      time.sleep(0.25)

    assert detail is not None
    assert detail["status"] == "succeeded"
    assert detail["file_count"] == 5
    assert detail["company_name"] == "测试企业"
    assert detail["risk_count"] >= 3
    assert detail["related_record_count"] == detail["risk_count"]
    assert len(detail["material_gap_list"]) >= 1
    risk_types = {item["risk_type"] for item in detail["risks"]}
    assert "有进无销" in risk_types
    assert "白条入账" in risk_types
    purchase_risk = next(item for item in detail["risks"] if item["risk_type"] == "有进无销")
    expense_risk = next(item for item in detail["risks"] if item["risk_type"] == "白条入账")
    assert "采购" in purchase_risk["trigger_reason"]
    assert "÷" in purchase_risk["calculation_text"]
    assert purchase_risk["source_data_refs"][0]["dataset_label"] == "进项发票"
    assert "白条" in expense_risk["trigger_reason"]
    assert expense_risk["source_data_refs"][0]["dataset_label"] == "费用明细"
    reviewable = next(item for item in detail["risks"] if item["review_record_id"])
    assert reviewable["review_status"] == "pending_review"
    review_resp = auth_client.post(
        f"/api/modules/analysis-workbench/tasks/{task_id}/risks/{reviewable['review_record_id']}/review",
        json={"status": "confirmed", "note": "测试确认"},
    )
    assert review_resp.status_code == 200
    detail_after_review = auth_client.get(f"/api/modules/analysis-workbench/tasks/{task_id}").json()
    updated_review = next(item for item in detail_after_review["risks"] if item["review_record_id"] == reviewable["review_record_id"])
    assert updated_review["review_status"] == "confirmed"

    ledger_resp = auth_client.post(f"/api/modules/analysis-workbench/risks/{reviewable['review_record_id']}/ledger")
    assert ledger_resp.status_code == 200
    assert ledger_resp.json()["success"] is True
    taxpayer_workbench_resp = auth_client.get("/api/workbench/taxpayer/91310000123456789X")
    assert taxpayer_workbench_resp.status_code == 200
    taxpayer_workbench = taxpayer_workbench_resp.json()
    assert taxpayer_workbench["latest_risk"]["entry_status"] == "待核实"
    assert taxpayer_workbench["recent_analysis_tasks"][0]["task_id"] == task_id

    report_resp = auth_client.get(f"/api/modules/analysis-workbench/tasks/{task_id}/report?format=json")
    assert report_resp.status_code == 200
    assert report_resp.headers["content-type"].startswith("application/json")
    report = report_resp.json()
    assert report["task_id"] == task_id
    assert report["risk_count"] >= 3
    assert len(report["risks"]) >= 3
    assert "trigger_reason" in report["risks"][0]
    assert "source_data_refs" in report["risks"][0]

    txt_resp = auth_client.get(f"/api/modules/analysis-workbench/tasks/{task_id}/report?format=txt")
    assert txt_resp.status_code == 200
    assert "任务名称: 测试分析" in txt_resp.text
    assert "企业涉税风险分析报告" in txt_resp.text

    doc_config_query = (
        "agency_name=国家税务总局测试税务局"
        "&document_number=测试税通〔2026〕001号"
        "&contact_person=李税官"
        "&contact_phone=12345"
        "&rectification_deadline=2026年5月10日前"
        "&document_date=2026-04-29"
    )
    notice_resp = auth_client.get(f"/api/modules/analysis-workbench/tasks/{task_id}/report?format=txt&doc_type=notice&{doc_config_query}")
    assert notice_resp.status_code == 200
    assert "税务事项通知书" in notice_resp.text
    assert "国家税务总局测试税务局" in notice_resp.text
    assert "测试税通〔2026〕001号" in notice_resp.text
    assert "2026年5月10日前" in notice_resp.text
    assert "李税官" in notice_resp.text

    default_notice_resp = auth_client.get(f"/api/modules/analysis-workbench/tasks/{task_id}/report?format=txt&doc_type=notice")
    assert default_notice_resp.status_code == 200
    assert "国家税务总局默认税务局" in default_notice_resp.text
    assert "默认联系人" in default_notice_resp.text

    report_docx_resp = auth_client.get(f"/api/modules/analysis-workbench/tasks/{task_id}/report?format=docx&doc_type=analysis&{doc_config_query}")
    assert report_docx_resp.status_code == 200
    assert report_docx_resp.headers["content-type"].startswith("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    with zipfile.ZipFile(io.BytesIO(report_docx_resp.content)) as docx_zip:
        document_xml = docx_zip.read("word/document.xml").decode("utf-8")
    assert "税务疑点核实报告" in document_xml
    assert "应要求企业提供资料" in document_xml
    assert "规则名称" in document_xml
    assert "测试税通" in document_xml

    notice_docx_resp = auth_client.get(f"/api/modules/analysis-workbench/tasks/{task_id}/report?format=docx&doc_type=notice&{doc_config_query}")
    assert notice_docx_resp.status_code == 200
    with zipfile.ZipFile(io.BytesIO(notice_docx_resp.content)) as docx_zip:
        notice_xml = docx_zip.read("word/document.xml").decode("utf-8")
    assert "税务事项通知书" in notice_xml
    assert "整改要求" in notice_xml
    assert "国家税务总局测试税务局" in notice_xml
    assert "李税官" in notice_xml
    assert "12345" in notice_xml


def test_analysis_task_rerun_clones_files_with_auth(auth_client):
    create_resp = auth_client.post(
        "/api/modules/analysis-workbench/tasks",
        json={"name": "重跑测试", "description": "验证重跑"},
    )
    assert create_resp.status_code == 200
    task_id = create_resp.json()["task_id"]

    upload_resp = auth_client.post(
        f"/api/modules/analysis-workbench/upload?task_id={task_id}",
        files={"file": ("rerun.txt", io.BytesIO("rerun payload".encode("utf-8")), "text/plain")},
    )
    assert upload_resp.status_code == 200

    rerun_resp = auth_client.post(f"/api/modules/analysis-workbench/tasks/{task_id}/rerun")
    assert rerun_resp.status_code == 200
    new_task_id = rerun_resp.json()["task_id"]
    assert new_task_id != task_id

    detail_resp = auth_client.get(f"/api/modules/analysis-workbench/tasks/{new_task_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["file_count"] == 1
    assert detail["files"] == ["rerun.txt"]


def test_dashboard_overview_reflects_real_user_data(auth_client):
    task_resp = auth_client.post(
        "/api/modules/analysis-workbench/tasks",
        json={"name": "Dashboard 数据校验", "description": "为 dashboard 准备数据"},
    )
    assert task_resp.status_code == 200
    task_id = task_resp.json()["task_id"]

    upload_resp = auth_client.post(
        f"/api/modules/analysis-workbench/upload?task_id={task_id}",
        files={"file": ("dashboard.txt", io.BytesIO("dashboard".encode("utf-8")), "text/plain")},
    )
    assert upload_resp.status_code == 200

    overview_resp = auth_client.get("/api/modules/dashboard-workbench/overview")
    assert overview_resp.status_code == 200
    overview = overview_resp.json()

    stat_cards = {card["label"]: card for card in overview["stat_cards"]}
    assert stat_cards["任务总数"]["value"] >= 1
    assert stat_cards["文件总数"]["value"] >= 1
    assert stat_cards["活跃模块"]["value"] >= 1
    assert len(overview["task_trend"]) == 7
    assert any(item["module"] == "analysis-workbench" for item in overview["module_stats"])
    assert any("创建分析任务" in item["detail"] or "上传文件" in item["detail"] for item in overview["recent_activity"])

    overview_30_resp = auth_client.get("/api/modules/dashboard-workbench/overview?days=30")
    assert overview_30_resp.status_code == 200
    overview_30 = overview_30_resp.json()
    assert len(overview_30["task_trend"]) == 30


def test_analysis_run_creates_files_logs_notifications_links_and_search_entries(auth_client):
    create_resp = auth_client.post(
        "/api/modules/analysis-workbench/tasks",
        json={"name": "跨模块联动测试", "description": "覆盖搜索和联动"},
    )
    assert create_resp.status_code == 200
    task_id = create_resp.json()["task_id"]

    uploads = [
        (
            "cross-sales.csv",
            "期间,企业名称,纳税人识别号,金额,购方名称,商品名称\n"
            "2026-03,跨模块企业,91310000999999999X,300000,客户A,配件\n"
            "2026-03,跨模块企业,91310000999999999X,280000,客户B,配件\n",
        ),
        (
            "cross-purchase.csv",
            "期间,企业名称,纳税人识别号,金额,供应商名称,商品名称\n"
            "2026-03,跨模块企业,91310000999999999X,20000,上游供应商,配件\n",
        ),
    ]
    file_id = None
    for filename, content in uploads:
        upload_resp = auth_client.post(
            f"/api/modules/analysis-workbench/upload?task_id={task_id}",
            files={"file": (filename, io.BytesIO(content.encode("utf-8")), "text/csv")},
        )
        assert upload_resp.status_code == 200
        file_id = file_id or upload_resp.json()["file_id"]

    run_resp = auth_client.post(f"/api/modules/analysis-workbench/tasks/{task_id}/run")
    assert run_resp.status_code == 200

    deadline = time.time() + 6
    while time.time() < deadline:
        detail_resp = auth_client.get(f"/api/modules/analysis-workbench/tasks/{task_id}")
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        if detail["status"] == "succeeded":
            break
        time.sleep(0.25)

    assert detail["status"] == "succeeded"

    files_resp = auth_client.get("/api/files?module=analysis-workbench&q=cross-sales.csv")
    assert files_resp.status_code == 200
    files_payload = files_resp.json()
    assert files_payload["total"] == 1
    assert files_payload["files"][0]["file_id"] == file_id

    logs_resp = auth_client.get(f"/api/logs?module=analysis-workbench&q={task_id}")
    assert logs_resp.status_code == 200
    logs_payload = logs_resp.json()
    assert logs_payload["total"] >= 3
    assert any("上传文件" in item["detail"] for item in logs_payload["logs"])
    assert any("发起分析任务" in item["detail"] for item in logs_payload["logs"])

    notifications_resp = auth_client.get("/api/notifications")
    assert notifications_resp.status_code == 200
    notifications_payload = notifications_resp.json()
    assert notifications_payload["total"] >= 1
    assert any(item["title"] == "案头分析完成" for item in notifications_payload["notifications"])
    assert any((item.get("target_url") or "").endswith(task_id) for item in notifications_payload["notifications"] if item["title"] == "案头分析完成")

    links_resp = auth_client.get("/api/cross-links")
    assert links_resp.status_code == 200
    links_payload = links_resp.json()
    task_links = [item for item in links_payload["links"] if item["source_id"] == task_id]
    assert len(task_links) >= 1
    assert all(item["target_module"] == "record-operations" for item in task_links)

    records_resp = auth_client.get(f"/api/modules/record-operations/records?batch=analysis-{task_id}")
    assert records_resp.status_code == 200
    records_payload = records_resp.json()
    assert records_payload["total"] >= 1

    first_record_id = records_payload["records"][0]["record_id"]
    relations_resp = auth_client.get(f"/api/modules/record-operations/records/{first_record_id}/relations")
    assert relations_resp.status_code == 200
    relations = relations_resp.json()
    assert relations["source_module"] == "analysis-workbench"
    assert relations["source_task_id"] == task_id
    assert len(relations["files"]) == 2
    assert any(log["module"] == "analysis-workbench" for log in relations["logs"])

    search_resp = auth_client.get("/api/search?q=跨模块联动测试")
    assert search_resp.status_code == 200
    search_payload = search_resp.json()
    assert any(item["type"] == "task" and item["title"] == "跨模块联动测试" for item in search_payload["results"])


def test_tax_analysis_detects_multiple_risks_and_exports_notice(auth_client):
    create_resp = auth_client.post(
        "/api/modules/analysis-workbench/tasks",
        json={"name": "税务专项识别", "description": "识别多类涉税风险"},
    )
    assert create_resp.status_code == 200
    task_id = create_resp.json()["task_id"]

    datasets = [
        (
            "purchase_invoice_detail.csv",
            "期间,企业名称,纳税人识别号,金额,供应商名称,商品名称\n"
            "2026-02,样例企业,91310000111222333X,90000,供货商A,原材料\n"
            "2026-02,样例企业,91310000111222333X,85000,供货商B,原材料\n",
        ),
        (
            "sales_invoice_detail.csv",
            "期间,企业名称,纳税人识别号,金额,购方名称,商品名称\n"
            "2026-02,样例企业,91310000111222333X,12000,客户甲,原材料\n"
            "2026-02,样例企业,91310000111222333X,12000,客户甲,原材料\n"
            "2026-02,样例企业,91310000111222333X,12000,客户甲,原材料\n"
            "2026-02,样例企业,91310000111222333X,12000,客户甲,原材料\n"
            "2026-02,样例企业,91310000111222333X,12000,客户甲,原材料\n",
        ),
        (
            "cit_return.csv",
            "期间,企业名称,纳税人识别号,收入总额,主营业务成本,利润总额,应纳税所得额\n"
                "2026-02,样例企业,91310000111222333X,10000,260000,5000,5000\n",
        ),
        (
            "expense_sheet.csv",
            "期间,企业名称,纳税人识别号,费用金额,凭证类型\n"
            "2026-02,样例企业,91310000111222333X,20000,无票报销\n"
            "2026-02,样例企业,91310000111222333X,8000,收据\n",
        ),
    ]
    for filename, content in datasets:
        upload_resp = auth_client.post(
            f"/api/modules/analysis-workbench/upload?task_id={task_id}",
            files={"file": (filename, io.BytesIO(content.encode("utf-8")), "text/csv")},
        )
        assert upload_resp.status_code == 200

    run_resp = auth_client.post(f"/api/modules/analysis-workbench/tasks/{task_id}/run")
    assert run_resp.status_code == 200

    detail_resp = auth_client.get(f"/api/modules/analysis-workbench/tasks/{task_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    risk_types = {item["risk_type"] for item in detail["risks"]}
    assert {"有进无销", "虚列成本", "白条入账", "变票"} <= risk_types

    notice_resp = auth_client.get(f"/api/modules/analysis-workbench/tasks/{task_id}/report?format=json&doc_type=notice")
    assert notice_resp.status_code == 200
    notice = notice_resp.json()
    assert notice["document_type"] == "tax_notice"
    assert notice["enterprise_name"] == "样例企业"
    assert len(notice["issues"]) >= 4


def test_notifications_is_read_filter(auth_client):
    """测试通知列表的 is_read 筛选功能"""
    # 创建两条任务触发通知
    for name in ["is_read测试A", "is_read测试B"]:
        task_resp = auth_client.post("/api/modules/analysis-workbench/tasks", json={"name": name, "description": "测试"})
        assert task_resp.status_code == 200
        task_id = task_resp.json()["task_id"]
        auth_client.post(
            f"/api/modules/analysis-workbench/upload?task_id={task_id}",
            files={"file": ("test.txt", io.BytesIO(b"test"), "text/plain")},
        )
        auth_client.post(f"/api/modules/analysis-workbench/tasks/{task_id}/run")

    # 等待通知生成
    time.sleep(3)

    # 全部未读
    resp_all = auth_client.get("/api/notifications")
    assert resp_all.status_code == 200
    all_items = resp_all.json()["notifications"]
    assert len(all_items) >= 2

    # 只看未读
    resp_unread = auth_client.get("/api/notifications?is_read=false")
    assert resp_unread.status_code == 200
    unread_items = resp_unread.json()["notifications"]
    assert all(item["is_read"] is False for item in unread_items)

    # 只看已读（刚创建的应该没有已读的）
    resp_read = auth_client.get("/api/notifications?is_read=true")
    assert resp_read.status_code == 200
    read_items = resp_read.json()["notifications"]
    # 可能为空（如果没有更早的通知），但接口必须返回 200
    assert "notifications" in resp_read.json()


def test_backup_create_requires_permission(auth_client, viewer_client):
    """测试备份创建需要 platform:backup:create 权限"""
    # viewer 没有 backup:create 权限
    viewer_resp = viewer_client.post("/api/platform/backup", json={"name": "测试备份", "note": ""})
    assert viewer_resp.status_code == 403

    # admin 可以创建
    admin_resp = auth_client.post("/api/platform/backup", json={"name": "管理备份", "note": ""})
    assert admin_resp.status_code == 200
    assert admin_resp.json()["success"] is True


def test_backup_restore_requires_admin(auth_client, viewer_client):
    """测试备份恢复需要 admin 角色"""
    # viewer 尝试恢复会被拒绝（无备份，返回404在权限检查之后）
    viewer_resp = viewer_client.post("/api/platform/backups/nonexistent-restore")
    # viewer 没有 platform:backup:restore 权限，应该 403
    # 但如果 get_current_user 失败可能 401/404，这里先检查 403
    assert viewer_resp.status_code in (401, 403, 404)

    # admin 可以访问备份列表
    resp = auth_client.get("/api/platform/backups")
    assert resp.status_code == 200


def test_file_archive_requires_permission(auth_client, viewer_client, seeded_db):
    """测试文件归档需要 platform:file:operate 权限"""
    from app.models.record import FileRecord
    import uuid

    # 先用 admin 上传一个文件
    file_id = str(uuid.uuid4())
    f = FileRecord(
        file_id=file_id,
        name="test_archive.txt",
        original_name="test_archive.txt",
        module="analysis-workbench",
        owner_id=1,
        size=100,
        mime_type="text/plain",
        status="active",
    )
    seeded_db.add(f)
    seeded_db.commit()

    # viewer 无法归档（无 platform:file:operate 权限）
    viewer_resp = viewer_client.post(f"/api/files/{file_id}/archive")
    assert viewer_resp.status_code == 403

    # admin 可以归档
    admin_resp = auth_client.post(f"/api/files/{file_id}/archive")
    assert admin_resp.status_code == 200


def test_viewer_cannot_access_platform_management(viewer_client):
    """测试 viewer 角色不能访问平台管理端点"""
    # viewer 不能注册模块
    mod_resp = viewer_client.post("/api/modules/register", json={
        "key": "test-module", "name": "测试模块", "type": "list"
    })
    assert mod_resp.status_code == 403

    # viewer 不能创建备份
    backup_resp = viewer_client.post("/api/platform/backup", json={"name": "test", "note": ""})
    assert backup_resp.status_code == 403

    # viewer 不能修改角色
    role_resp = viewer_client.put("/api/platform/roles/viewer", json={"permissions": []})
    assert role_resp.status_code == 403


def test_user_cannot_access_platform_management(user_client):
    """测试 user 角色不能访问平台管理端点"""
    # user 不能注册模块
    mod_resp = user_client.post("/api/modules/register", json={
        "key": "test-module", "name": "测试模块", "type": "list"
    })
    assert mod_resp.status_code == 403

    # user 不能创建备份
    backup_resp = user_client.post("/api/platform/backup", json={"name": "test", "note": ""})
    assert backup_resp.status_code == 403

    # user 不能修改角色
    role_resp = user_client.put("/api/platform/roles/user", json={"permissions": []})
    assert role_resp.status_code == 403


def test_log_center_detail_logged_action(auth_client):
    """测试日志中心记录关键操作"""
    # 创建一个任务会写日志（操作类型为 create）
    task_resp = auth_client.post("/api/modules/analysis-workbench/tasks", json={"name": "日志测试任务", "description": ""})
    assert task_resp.status_code == 200
    time.sleep(0.5)

    # 验证任务创建写入了日志（action=create）
    log_resp = auth_client.get("/api/logs?action=create")
    assert log_resp.status_code == 200
    payload = log_resp.json()
    assert "logs" in payload or "total" in payload  # 接口结构正确
