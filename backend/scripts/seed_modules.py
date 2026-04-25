#!/usr/bin/env python3
"""初始化模块注册数据"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.models.module import Module

Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    modules_data = [
        {
            "key": "analysis-workbench",
            "name": "分析工作模块",
            "description": "统一处理上传、校验、分析、结果、报告输出。适合作为平台里\"任务型模块\"的样板。",
            "type": "workflow",
            "priority": "high",
            "status": "active",
            "icon": "🔵",
        },
        {
            "key": "record-operations",
            "name": "对象管理模块",
            "description": "统一处理对象管理、分类、分配、批量调整和导出。适合作为平台里\"列表型模块\"的样板。",
            "type": "list",
            "priority": "high",
            "status": "active",
            "icon": "🟡",
        },
        {
            "key": "info-query",
            "name": "信息查询表",
            "description": "导入纳税人完整信息查询表，供案头分析、管户分配和后续模块复用。",
            "type": "list",
            "priority": "high",
            "status": "active",
            "icon": "📋",
        },
        {
            "key": "risk-ledger",
            "name": "风险记录台账",
            "description": "按纳税人建立风险记录档案，支持单户记录、批量留痕和整改状态跟踪。",
            "type": "list",
            "priority": "high",
            "status": "active",
            "icon": "🧾",
        },
        {
            "key": "learning-lab",
            "name": "学习训练模块",
            "description": "统一处理题库、训练、错题、收藏和统计。适合作为平台里\"沉浸式轻模块\"的样板。",
            "type": "interactive",
            "priority": "medium",
            "status": "active",
            "icon": "🟢",
        },
    ]

    for m in modules_data:
        existing = db.query(Module).filter(Module.key == m["key"]).first()
        if existing:
            print(f"模块 {m['key']} 已存在")
        else:
            db.add(Module(**m))
            print(f"模块 {m['key']} 创建成功")

    db.commit()
finally:
    db.close()
