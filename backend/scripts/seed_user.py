#!/usr/bin/env python3
"""初始化管理员账号"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.models import User
from app.services.auth import hash_password

Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    existing = db.query(User).filter(User.username == "admin").first()
    if existing:
        print("admin 用户已存在")
    else:
        user = User(
            username="admin",
            hashed_password=hash_password("admin123"),
            nickname="管理员",
            role="admin",
        )
        db.add(user)
        db.commit()
        print("admin 用户创建成功，用户名: admin，密码: admin123")
finally:
    db.close()
