"""
WebSocket 实时通知
连接地址: ws://localhost:3000/ws
认证: 通过 Cookie 中的 omni_session 验证
"""
import asyncio
import json
from typing import Dict, Set, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Cookie, Query
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.config import SESSION_COOKIE_NAME
from app.models import User, Session as SessionModel
from datetime import datetime

router = APIRouter()


class ConnectionManager:
    """管理所有 WebSocket 连接"""

    def __init__(self):
        # user_id -> set of websocket connections
        self._connections: Dict[int, Set[WebSocket]] = {}
        # websocket -> user_id
        self._ws_to_user: Dict[WebSocket, int] = {}

    async def connect(self, ws: WebSocket, user_id: int):
        await ws.accept()
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(ws)
        self._ws_to_user[ws] = user_id

    def disconnect(self, ws: WebSocket):
        user_id = self._ws_to_user.pop(ws, None)
        if user_id and user_id in self._connections:
            self._connections[user_id].discard(ws)
            if not self._connections[user_id]:
                del self._connections[user_id]

    async def send_to_user(self, user_id: int, message: dict):
        """向指定用户的所有连接发送消息"""
        if user_id in self._connections:
            dead = set()
            for ws in self._connections[user_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.add(ws)
            for ws in dead:
                self.disconnect(ws)

    async def broadcast(self, message: dict):
        """广播到所有连接"""
        for user_id in list(self._connections.keys()):
            await self.send_to_user(user_id, message)


# 全局连接管理器
manager = ConnectionManager()


def get_user_from_cookie(session_id: str) -> Optional[int]:
    """通过 session_id 获取 user_id"""
    if not session_id:
        return None
    db = SessionLocal()
    try:
        session = db.query(SessionModel).filter(
            SessionModel.session_id == session_id,
            SessionModel.is_valid == True,
        ).first()
        if not session:
            return None
        if session.expires_at < datetime.utcnow():
            session.is_valid = False
            db.commit()
            return None
        return session.user_id
    finally:
        db.close()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str = Cookie(None, alias=SESSION_COOKIE_NAME),
):
    """WebSocket 端点，需要有效的 session cookie"""
    if not session_id:
        await websocket.close(code=4001, reason="未登录")
        return

    user_id = get_user_from_cookie(session_id)
    if not user_id:
        await websocket.close(code=4001, reason="会话无效或已过期")
        return

    await manager.connect(websocket, user_id)
    try:
        # 发送欢迎消息
        await websocket.send_json({
            "type": "connected",
            "message": "WebSocket 连接成功",
            "user_id": user_id,
        })

        # 保持连接，处理客户端消息
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                # 客户端可以发送 ping
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# 供其他模块调用的推送接口
def push_to_user(user_id: int, event_type: str, data: dict):
    """在事件循环外调用: 使用 asyncio 推送消息到指定用户"""
    async def _do_push():
        await manager.send_to_user(user_id, {
            "type": event_type,
            "data": data,
        })
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(_do_push())
        else:
            loop.run_until_complete(_do_push())
    except RuntimeError:
        pass  # 无事件循环（启动前）
