#!/usr/bin/env python3
"""
Omni 平台 CLI 工具
用法: python cli.py <command> [options]
"""
import sys
import os
import argparse
import secrets
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"

# 确保 backend 和虚拟环境依赖在路径中
for site_packages in sorted((BACKEND_DIR / ".venv").glob("lib/python*/site-packages")):
    sys.path.insert(0, str(site_packages))
sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import engine, Base, SessionLocal, get_db
from app.models import User, Role, Module, Session as SessionModel
from app.models.permission import ROLE_PERMISSIONS
from app.services.auth import hash_password, make_expires_at


def db_init():
    """初始化数据库表"""
    print("[db:init] 创建所有表...")
    Base.metadata.create_all(bind=engine)
    print("[db:init] 完成 ✓")


def db_status():
    """查看数据库状态"""
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        role_count = db.query(Role).count()
        module_count = db.query(Module).count()
        session_count = db.query(SessionModel).count()
        print(f"用户: {user_count}")
        print(f"角色: {role_count}")
        print(f"模块: {module_count}")
        print(f"会话: {session_count}")
    finally:
        db.close()


def user_create(username: str, password: str, role: str = "user"):
    """创建用户"""
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            print(f"[user:create] 用户 {username} 已存在，跳过")
            return
        # 确保角色存在
        for name, perms in ROLE_PERMISSIONS.items():
            if not db.query(Role).filter(Role.name == name).first():
                db.add(Role(name=name, display_name=name, permissions=perms))
        db.commit()
        user = User(
            username=username,
            hashed_password=hash_password(password),
            nickname=username,
            role=role,
            is_active=True,
        )
        db.add(user)
        db.commit()
        print(f"[user:create] 用户 {username} (role={role}) 创建成功 ✓")
    finally:
        db.close()


def user_reset_password(username: str, new_password: str):
    """重置用户密码"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            print(f"[user:reset-password] 用户 {username} 不存在")
            return
        user.hashed_password = hash_password(new_password)
        db.commit()
        print(f"[user:reset-password] {username} 密码已更新 ✓")
    finally:
        db.close()


def user_list():
    """列出所有用户"""
    db = SessionLocal()
    try:
        users = db.query(User).all()
        if not users:
            print("[user:list] 无用户")
            return
        for u in users:
            print(f"  {u.username} | {u.role} | active={u.is_active} | id={u.id}")
    finally:
        db.close()


def session_cleanup():
    """清理过期会话"""
    from datetime import datetime
    db = SessionLocal()
    try:
        expired = db.query(SessionModel).filter(
            SessionModel.expires_at < datetime.utcnow(),
            SessionModel.is_valid == True,
        ).all()
        for s in expired:
            s.is_valid = False
        db.commit()
        print(f"[session:cleanup] 清理了 {len(expired)} 个过期会话 ✓")
    finally:
        db.close()


def server_status():
    """检查后端服务是否运行"""
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('127.0.0.1', 3000))
    sock.close()
    if result == 0:
        print("[server:status] 后端服务运行中 (localhost:3000) ✓")
    else:
        print("[server:status] 后端服务未运行 (localhost:3000) ✗")


def server_restart():
    """重启后端服务（仅限 macOS/Linux）"""
    import subprocess
    # 先停
    stop = subprocess.run(["bash", "scripts/stop.sh"], cwd=os.path.dirname(__file__), capture_output=True)
    print(f"[server:restart] stop: {stop.returncode}")
    # 再启
    start = subprocess.run(["bash", "scripts/start.sh"], cwd=os.path.dirname(__file__), capture_output=True)
    print(f"[server:restart] start: {start.returncode}")
    if start.returncode == 0:
        print("[server:restart] 后端服务已重启 ✓")
    else:
        print(f"[server:restart] 启动失败: {start.stderr.decode()}")


def module_list():
    """列出所有模块"""
    db = SessionLocal()
    try:
        modules = db.query(Module).all()
        if not modules:
            print("[module:list] 无模块")
            return
        for m in modules:
            print(f"  {m.key} | {m.name} | type={m.type} | status={m.status}")
    finally:
        db.close()


def db_restore(backup_id: str):
    """从备份文件恢复数据库"""
    import zipfile, shutil, datetime
    from pathlib import Path

    db = SessionLocal()
    try:
        backup = db.query(Backup).filter(Backup.backup_id == backup_id).first()
        if not backup:
            print(f"[db:restore] 备份 {backup_id} 不存在")
            return
        if backup.status != "succeeded" or not backup.file_path:
            print(f"[db:restore] 备份 {backup_id} 未完成或文件不可用")
            return
        backup_path = Path(backup.file_path)
        if not backup_path.exists():
            print(f"[db:restore] 备份文件已丢失: {backup.file_path}")
            return

        # 验证 ZIP 内容
        try:
            with zipfile.ZipFile(backup_path, "r") as zf:
                names = zf.namelist()
                if "omni.db" not in names:
                    print("[db:restore] 错误：备份文件格式无效，缺少 omni.db")
                    return
                with zf.open("omni.db") as db_f:
                    header = db_f.read(16)
                    if header[:16] != b"SQLite format 3\x00":
                        print("[db:restore] 错误：备份数据库文件无效")
                        return
        except Exception as e:
            print(f"[db:restore] 错误：备份文件损坏 ({e})")
            return

        DATA_DIR = Path(__file__).resolve().parent / "data"
        DB_PATH = DATA_DIR / "omni.db"
        UPLOAD_DIR = DATA_DIR / "uploads"

        # 创建安全备份（恢复前）
        safety_name = f"pre-restore-{datetime.now().strftime('%Y%m%d%H%M%S')}.db"
        safety_path = DATA_DIR / safety_name
        if DB_PATH.exists():
            shutil.copy2(DB_PATH, safety_path)
            print(f"[db:restore] 安全备份已保存: data/{safety_name}")

        # 提取备份
        with zipfile.ZipFile(backup_path, "r") as zf:
            # 恢复 DB
            with zf.open("omni.db") as src_db:
                with open(DB_PATH, "wb") as dst_db:
                    shutil.copyfileobj(src_db, dst_db)
            print(f"[db:restore] 数据库已恢复: data/omni.db")

            # 可选：恢复 uploads
            if "uploads" in zf.namelist():
                if UPLOAD_DIR.exists():
                    shutil.rmtree(UPLOAD_DIR)
                zf.extractall(DATA_DIR, [n for n in zf.namelist() if n.startswith("uploads/")])
                print(f"[db:restore] 上传文件已恢复: data/uploads/")

        # 记录操作日志
        try:
            from app.models.record import OperationLog
            admin = db.query(User).filter(User.username == "admin").first()
            if admin:
                log = OperationLog(
                    action="restore",
                    target_type="Backup",
                    target_id=backup_id,
                    module="platform",
                    operator_id=admin.id,
                    detail=f"CLI恢复：{backup.name} ({backup_id})",
                    result="success",
                )
                db.add(log)
                db.commit()
        except Exception:
            pass

        print(f"[db:restore] 恢复完成 ✓")
        print(f"请重启后端服务: python3 cli.py server restart")
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Omni 平台 CLI 工具")
    sub = parser.add_subparsers(dest="command")

    # db
    p_db = sub.add_parser("db", help="数据库操作")
    p_db_sub = p_db.add_subparsers(dest="sub")
    p_db_sub.add_parser("init", help="初始化表")
    p_db_sub.add_parser("status", help="查看状态")
    restore_parser = p_db_sub.add_parser("restore", help="从备份恢复数据库")
    restore_parser.add_argument("backup_id", help="备份ID (例如: backup-20250425120000-xxxx)")

    # user
    p_user = sub.add_parser("user", help="用户管理")
    p_user_sub = p_user.add_subparsers(dest="sub")
    uc = p_user_sub.add_parser("create", help="创建用户")
    uc.add_argument("username")
    uc.add_argument("password")
    uc.add_argument("--role", default="user")
    p_user_sub.add_parser("list", help="列出用户")
    rp = p_user_sub.add_parser("reset-password", help="重置密码")
    rp.add_argument("username")
    rp.add_argument("new_password")

    # session
    p_sess = sub.add_parser("session", help="会话管理")
    p_sess_sub = p_sess.add_subparsers(dest="sub")
    p_sess_sub.add_parser("cleanup", help="清理过期会话")

    # server
    p_server = sub.add_parser("server", help="服务管理")
    p_server_sub = p_server.add_subparsers(dest="sub")
    p_server_sub.add_parser("status", help="检查状态")
    p_server_sub.add_parser("restart", help="重启服务")

    # module
    p_mod = sub.add_parser("module", help="模块管理")
    p_mod_sub = p_mod.add_subparsers(dest="sub")
    p_mod_sub.add_parser("list", help="列出模块")

    args = parser.parse_args()

    if args.command == "db":
        if args.sub == "init":
            db_init()
        elif args.sub == "status":
            db_status()
        elif args.sub == "restore":
            db_restore(args.backup_id)
        else:
            p_db.print_help()
    elif args.command == "user":
        if args.sub == "create":
            user_create(args.username, args.password, args.role)
        elif args.sub == "list":
            user_list()
        elif args.sub == "reset-password":
            user_reset_password(args.username, args.new_password)
        else:
            p_user.print_help()
    elif args.command == "session":
        if args.sub == "cleanup":
            session_cleanup()
        else:
            p_sess.print_help()
    elif args.command == "server":
        if args.sub == "status":
            server_status()
        elif args.sub == "restart":
            server_restart()
        else:
            p_server.print_help()
    elif args.command == "module":
        if args.sub == "list":
            module_list()
        else:
            p_mod.print_help()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
