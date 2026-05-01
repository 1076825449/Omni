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
            "name": "案头分析",
            "description": "统一处理上传、校验、分析、结果、报告输出。支持发票、申报、财报交叉识别与通知书/分析报告导出。",
            "type": "workflow",
            "priority": "high",
            "status": "active",
            "icon": "🔵",
        },
        {
            "key": "record-operations",
            "name": "辅助数据管理",
            "description": "统一处理辅助记录、分类标签、批量调整和导出，作为系统辅助数据落点。",
            "type": "list",
            "priority": "high",
            "status": "active",
            "icon": "🟡",
        },
        {
            "key": "info-query",
            "name": "管户分配",
            "description": "导入纳税人完整信息查询表，按管理员和管户部门查看纳税人分布，供案头分析、管户记录和后续模块复用。",
            "type": "list",
            "priority": "high",
            "status": "active",
            "icon": "📋",
        },
        {
            "key": "risk-ledger",
            "name": "管户记录",
            "description": "按纳税人建立管户记录档案，支持单户记录、批量留痕、风险排除和整改状态跟踪。",
            "type": "list",
            "priority": "high",
            "status": "active",
            "icon": "🧾",
        },
        {
            "key": "learning-lab",
            "name": "刷题程序",
            "description": "统一处理题库、刷题、错题、收藏和统计。支持真实答题、得分统计和会话持续。",
            "type": "interactive",
            "priority": "medium",
            "status": "active",
            "icon": "🟢",
        },
        {
            "key": "dashboard-workbench",
            "name": "数据仪表盘",
            "description": "平台数据总览仪表盘，展示任务、文件、模块统计和近期活动。",
            "type": "dashboard",
            "priority": "medium",
            "status": "active",
            "icon": "📊",
        },
        {
            "key": "schedule-workbench",
            "name": "定时调度",
            "description": "定时任务调度，支持 cron 表达式、手动执行、执行历史与统一任务通知链路。",
            "type": "workflow",
            "priority": "medium",
            "status": "active",
            "icon": "⏰",
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
