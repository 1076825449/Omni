"""
Rate Limiting 中间件
基于 IP + 用户ID 的双重限制
- 登录接口: 5次/分钟
- 其他 API: 100次/分钟
"""
import time
from collections import defaultdict
from typing import Dict, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RateLimiter:
    """滑动窗口速率限制器"""

    def __init__(self):
        # key -> list of timestamps
        self._hits: Dict[str, list] = defaultdict(list)

    def _cleanup(self, key: str, window: int):
        """清理窗口外的旧记录"""
        now = time.time()
        self._hits[key] = [
            t for t in self._hits[key] if now - t < window
        ]

    def is_allowed(self, key: str, limit: int, window: int) -> Tuple[bool, int]:
        """
        检查是否允许请求。
        返回 (是否允许, 剩余次数)
        """
        self._cleanup(key, window)
        remaining = limit - len(self._hits[key])
        if remaining <= 0:
            return False, 0
        self._hits[key].append(time.time())
        return True, remaining - 1


# 全局限流器
_limiter = RateLimiter()


def get_client_ip(request: Request) -> str:
    """获取真实客户端 IP（支持代理）"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_user_key(request: Request) -> str:
    """获取限流 key：优先用 user_id，否则用 IP"""
    # 从 request state 获取 user_id（需要路由先设置）
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    ip = get_client_ip(request)
    return f"ip:{ip}"


def is_login_path(path: str) -> bool:
    return path in ("/api/auth/login", "/api/auth/login/")


LOCALHOSTS = frozenset(("127.0.0.1", "localhost", "::1"))


def is_localhost(request: Request) -> bool:
    return request.client.host in LOCALHOSTS if request.client else False


async def rate_limit_middleware(request: Request, call_next):
    """速率限制中间件"""
    # 开发/测试环境跳过（来自 localhost）
    if is_localhost(request):
        return await call_next(request)

    path = request.url.path

    # 登录接口: 5次/分钟
    if is_login_path(path):
        key = f"login:{get_client_ip(request)}"
        allowed, remaining = _limiter.is_allowed(key, limit=5, window=60)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "请求过于频繁，请稍后再试"},
                headers={"Retry-After": "60", "X-RateLimit-Remaining": "0"},
            )
    else:
        # 其他 API: 100次/分钟
        # 跳过 docs/redoc/openapi.json
        if path.startswith("/docs") or path.startswith("/redoc") or path == "/openapi.json":
            return await call_next(request)

        key = get_user_key(request)
        allowed, remaining = _limiter.is_allowed(key, limit=100, window=60)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "请求频率超限，请稍后访问"},
                headers={"Retry-After": "60", "X-RateLimit-Remaining": "0"},
            )

    response = await call_next(request)
    return response
