import secrets
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models import User
from app.models.record import OperationLog
from app.models.learning import TrainingSet, PracticeSession, FavoriteQuestion, LearningStats
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/modules/learning-lab", tags=["学习训练模块"])


def log_action(db: Session, action: str, target_id: str, operator_id: int, detail: str = ""):
    db.add(OperationLog(
        action=action,
        target_type="LearningLab",
        target_id=target_id,
        module="learning-lab",
        operator_id=operator_id,
        detail=detail,
        result="success",
    ))


# --- Sample question bank ---
SAMPLE_QUESTIONS = [
    {
        "id": "q1",
        "question": "以下哪个是平台模块的正确描述？",
        "options": ["A. 模块必须独立运行完整服务", "B. 模块服从平台统一任务、文件、日志规范", "C. 模块可以自由定义自己的文件存储", "D. 模块不需要接入平台日志中心"],
        "answer": "B",
    },
    {
        "id": "q2",
        "question": "平台任务中心的作用是什么？",
        "options": ["A. 只记录成功任务", "B. 统一管理所有耗时操作的全流程状态", "C. 只管理用户创建的任务", "D. 替代所有模块的内部状态管理"],
        "answer": "B",
    },
    {
        "id": "q3",
        "question": "文件中心要求所有文件必须：",
        "options": ["A. 存储在模块私有目录", "B. 接入平台文件中心并记录元数据", "C. 仅通过邮件传递", "D. 不需要记录文件信息"],
        "answer": "B",
    },
    {
        "id": "q4",
        "question": "RBAC权限模型中的三个核心概念是：",
        "options": ["A. 用户、权限、系统", "B. 角色、权限、用户", "C. 角色、资源、访问", "D. 用户、角色、资源"],
        "answer": "B",
    },
    {
        "id": "q5",
        "question": "模块联动规范要求跨模块跳转必须：",
        "options": ["A. 直接读写对方数据库", "B. 通过平台 Record Link 统一实现", "C. 绕过平台日志记录", "D. 使用模块间私有 API"],
        "answer": "B",
    },
    {
        "id": "q6",
        "question": "分析工作台模块属于哪种模块形态？",
        "options": ["A. 列表型", "B. 工作流型", "C. 轻交互型", "D. 文档型"],
        "answer": "B",
    },
    {
        "id": "q7",
        "question": "学习训练模块的典型流程是：",
        "options": ["A. 上传 → 分析 → 报告", "B. 选择 → 练习 → 反馈 → 复盘 → 统计", "C. 导入 → 列表 → 导出", "D. 创建 → 分配 → 批量操作"],
        "answer": "B",
    },
    {
        "id": "q8",
        "question": "平台通知机制的第一优先场景是：",
        "options": ["A. 用户修改昵称", "B. 任务完成或失败等关键事件", "C. 定时心跳", "D. 每日汇总"],
        "answer": "B",
    },
    {
        "id": "q9",
        "question": "全局搜索的搜索范围包括：",
        "options": ["A. 只能搜索任务", "B. 只能搜索文件", "C. 任务、文件、日志、模块跨类型搜索", "D. 只能搜索模块名称"],
        "answer": "C",
    },
    {
        "id": "q10",
        "question": "备份文件的存放位置是：",
        "options": ["A. 项目根目录", "B. ~/.omni/backups/", "C. /tmp/", "D. 数据库内嵌"],
        "answer": "B",
    },
]


# Predefined training sets
PREDEFINED_SETS = [
    {"id": "set-platform-basics", "name": "平台规范入门", "description": "测试对 Omni 平台基础规范的掌握程度", "category": "平台规范", "difficulty": "easy", "tags": "平台,规范,入门"},
    {"id": "set-module-design", "name": "模块设计规范", "description": "验证对模块接入规范和联动机制的理解", "category": "模块设计", "difficulty": "medium", "tags": "模块,联动,规范"},
    {"id": "set-workflow", "name": "工作流与任务管理", "description": "理解平台任务体系和文件日志接入规则", "category": "工作流", "difficulty": "medium", "tags": "任务,文件,日志"},
]


# --- Schemas ---
class QuestionSchema(BaseModel):
    id: str
    question: str
    options: list[str]
    answer: str
    user_answer: Optional[str] = None
    is_correct: Optional[bool] = None


class TrainingSetSchema(BaseModel):
    id: int
    set_id: str
    name: str
    description: str
    category: str
    difficulty: str
    question_count: int
    tags: str
    is_active: bool

    class Config:
        from_attributes = True


class QuestionSchema(BaseModel):
    id: str
    question: str
    options: list[str]
    answer: str
    user_answer: Optional[str] = None
    is_correct: Optional[bool] = None


class PracticeSessionSchema(BaseModel):
    session_id: str
    set_id: str
    set_name: str
    status: str
    total_count: int
    correct_count: int
    score: int
    questions: list[QuestionSchema]
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SessionListResponse(BaseModel):
    sessions: list
    total: int


# --- Routes ---
@router.get("/sets", response_model=list[TrainingSetSchema])
def list_sets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 确保有预设题集
    for ps in PREDEFINED_SETS:
        existing = db.query(TrainingSet).filter(TrainingSet.set_id == ps["id"]).first()
        if not existing:
            ts = TrainingSet(
                set_id=ps["id"],
                name=ps["name"],
                description=ps["description"],
                category=ps["category"],
                difficulty=ps["difficulty"],
                tags=ps["tags"],
                question_count=len(SAMPLE_QUESTIONS),
            )
            db.add(ts)
    db.commit()

    q = db.query(TrainingSet).filter(TrainingSet.is_active == True)
    return q.order_by(TrainingSet.created_at.desc()).all()


@router.get("/sets/{set_id}")
def get_set(
    set_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ts = db.query(TrainingSet).filter(TrainingSet.set_id == set_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="训练集不存在")
    return ts


@router.get("/practice/continue")
def continue_last(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """继续上次的练习"""
    session = db.query(PracticeSession).filter(
        PracticeSession.user_id == current_user.id,
        PracticeSession.status == "in_progress",
    ).order_by(PracticeSession.started_at.desc()).first()

    if not session:
        raise HTTPException(status_code=404, detail="没有正在进行的练习")
    return session


@router.post("/practice/start")
def start_practice(
    set_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """开始一个新练习"""
    ts = db.query(TrainingSet).filter(TrainingSet.set_id == set_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="训练集不存在")

    # 把预设题目注入 session（带空 user_answer）
    questions = []
    for q in SAMPLE_QUESTIONS:
        questions.append({
            **q,
            "user_answer": None,
            "is_correct": None,
        })

    session_id = f"session-{secrets.token_hex(6)}"
    session = PracticeSession(
        session_id=sid,
        set_id=set_id,
        set_name=ts.name,
        user_id=current_user.id,
        status="in_progress",
        total_count=len(questions),
        questions=questions,
    )
    db.add(session)
    log_action(db, "start", sid, current_user.id, detail=f"开始练习: {ts.name}")
    db.commit()
    db.refresh(session)
    return session


@router.get("/practice/{sid}")
def get_practice(
    sid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(PracticeSession).filter(
        PracticeSession.session_id == sid,
        PracticeSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="练习不存在")
    return session


@router.post("/practice/{sid}/answer")
def submit_answer(
    sid: str,
    question_id: str = Query(...),
    user_answer: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """提交单题答案"""
    session = db.query(PracticeSession).filter(
        PracticeSession.session_id == sid,
        PracticeSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="练习不存在")
    if session.status != "in_progress":
        raise HTTPException(status_code=400, detail="练习已结束")

    questions = session.questions or []
    for q in questions:
        if q["id"] == question_id:
            q["user_answer"] = user_answer
            q["is_correct"] = (user_answer == q["answer"])
            break

    # 检查是否全部作答
    all_answered = all(q.get("user_answer") is not None for q in questions)
    if all_answered:
        correct = sum(1 for q in questions if q.get("is_correct"))
        session.status = "completed"
        session.correct_count = correct
        session.score = int(correct / len(questions) * 100)
        session.completed_at = datetime.utcnow
        log_action(db, "complete", sid, current_user.id, detail=f"完成练习: {session.set_name}，得分 {session.score}")

        # 更新统计
        stats = db.query(LearningStats).filter(LearningStats.user_id == current_user.id).first()
        if stats:
            stats.total_sessions += 1
            stats.total_correct += correct
            stats.total_questions += len(questions)
            stats.avg_score = int(stats.total_correct / stats.total_questions * 100)
            stats.last_practice_at = datetime.utcnow()
        else:
            stats = LearningStats(
                user_id=current_user.id,
                total_sessions=1,
                total_correct=correct,
                total_questions=len(questions),
                avg_score=int(correct / len(questions) * 100),
                last_practice_at=datetime.utcnow(),
            )
            db.add(stats)

    db.commit()
    return {"success": True, "all_answered": all_answered, "is_correct": next((q["is_correct"] for q in questions if q["id"] == question_id), None)}


@router.post("/practice/{sid}/favorite/{question_id}")
def toggle_favorite(
    sid: str,
    question_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """收藏或取消收藏一道题"""
    session = db.query(PracticeSession).filter(
        PracticeSession.session_id == sid,
        PracticeSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="练习不存在")

    existing = db.query(FavoriteQuestion).filter(
        FavoriteQuestion.session_id == sid,
        FavoriteQuestion.question_id == question_id,
        FavoriteQuestion.user_id == current_user.id,
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        return {"favorited": False}
    else:
        questions = session.questions or []
        q_data = next((q for q in questions if q["id"] == question_id), None)
        if not q_data:
            raise HTTPException(status_code=404, detail="题目不存在")
        fav = FavoriteQuestion(
            session_id=sid,
            question_id=question_id,
            question_text=q_data["question"],
            user_answer=q_data.get("user_answer", ""),
            correct_answer=q_data["answer"],
            user_id=current_user.id,
        )
        db.add(fav)
        log_action(db, "favorite", question_id, current_user.id, detail=f"收藏题目: {question_id}")
        db.commit()
        return {"favorited": True}


@router.get("/favorites")
def list_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    favs = db.query(FavoriteQuestion).filter(
        FavoriteQuestion.user_id == current_user.id,
    ).order_by(FavoriteQuestion.created_at.desc()).all()
    return favs


@router.delete("/favorites/{id}")
def remove_favorite(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fav = db.query(FavoriteQuestion).filter(
        FavoriteQuestion.id == id,
        FavoriteQuestion.user_id == current_user.id,
    ).first()
    if not fav:
        raise HTTPException(status_code=404, detail="收藏不存在")
    db.delete(fav)
    db.commit()
    return {"success": True}


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stats = db.query(LearningStats).filter(
        LearningStats.user_id == current_user.id,
    ).first()

    recent_sessions = db.query(PracticeSession).filter(
        PracticeSession.user_id == current_user.id,
    ).order_by(PracticeSession.started_at.desc()).limit(10).all()

    if not stats:
        return {
            "total_sessions": 0,
            "total_correct": 0,
            "total_questions": 0,
            "avg_score": 0,
            "streak_days": 0,
            "recent_sessions": [],
        }

    return {
        "total_sessions": stats.total_sessions,
        "total_correct": stats.total_correct,
        "total_questions": stats.total_questions,
        "avg_score": stats.avg_score,
        "streak_days": stats.streak_days,
        "last_practice_at": stats.last_practice_at.isoformat() if stats.last_practice_at else None,
        "recent_sessions": [
            {
                "session_id": s.session_id,
                "set_name": s.set_name,
                "score": s.score,
                "correct_count": s.correct_count,
                "total_count": s.total_count,
                "status": s.status,
                "started_at": s.started_at.isoformat(),
            }
            for s in recent_sessions
        ],
    }
