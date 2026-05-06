#!/usr/bin/env python3
"""初始化管理员账号"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.core.config import APP_ENV
from app.models import User
from app.services.auth import hash_password

Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    username = os.getenv("ADMIN_USERNAME", "admin")
    password = os.getenv("ADMIN_PASSWORD", "admin123")
    if APP_ENV == "production" and password == "admin123":
        raise RuntimeError("生产环境必须通过 ADMIN_PASSWORD 指定管理员初始密码，不能使用 admin123")

    existing = db.query(User).filter(User.username == username).first()
    if existing:
        print(f"{username} 用户已存在")
    else:
        user = User(
            username=username,
            hashed_password=hash_password(password),
            nickname="管理员",
            role="admin",
        )
        db.add(user)
        db.commit()
        print(f"{username} 用户创建成功")
finally:
    db.close()
