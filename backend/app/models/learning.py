from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, JSON
from datetime import datetime
from app.core.database import Base


class TrainingSet(Base):
    """训练集/题集"""
    __tablename__ = "training_sets"

    id = Column(Integer, primary_key=True, index=True)
    set_id = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    category = Column(String(50), default="")
    difficulty = Column(String(20), default="medium")  # easy / medium / hard
    question_count = Column(Integer, default=0)
    tags = Column(String(255), default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PracticeSession(Base):
    """练习会话"""
    __tablename__ = "practice_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), unique=True, index=True, nullable=False)
    set_id = Column(String(64), nullable=False)
    set_name = Column(String(200), default="")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="in_progress")  # in_progress / completed / abandoned
    total_count = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    score = Column(Integer, default=0)  # 0-100
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # 题目内容（JSON格式，来自 learning-lab 内容配置）
    questions = Column(JSON, default=list)  # [{id, question, options, answer, user_answer, is_correct}]


class FavoriteQuestion(Base):
    """收藏的题目"""
    __tablename__ = "favorite_questions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), nullable=False)
    question_id = Column(String(64), nullable=False)
    question_text = Column(Text, default="")
    user_answer = Column(Text, default="")
    correct_answer = Column(Text, default="")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class LearningStats(Base):
    """学习统计"""
    __tablename__ = "learning_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    total_sessions = Column(Integer, default=0)
    total_correct = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
    avg_score = Column(Integer, default=0)
    streak_days = Column(Integer, default=0)  # 连续练习天数
    last_practice_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
