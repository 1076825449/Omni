"""
示例插件：Hello Plugin
演示插件系统如何工作。
删除此文件或禁用此插件不会影响平台运行。
"""
from app.plugins.manager import PluginInterface


class HelloPlugin(PluginInterface):
    name = "hello-plugin"
    version = "0.1.0"
    author = "Omni Team"

    def on_startup(self, app):
        print(f"[HelloPlugin] 平台启动，Hello Plugin 已加载 ✓")

    def on_task_completed(self, task_data):
        print(f"[HelloPlugin] 任务完成事件: {task_data.get('name', 'unknown')}")

    def on_user_login(self, user_data):
        print(f"[HelloPlugin] 用户登录: {user_data.get('username', 'unknown')}")
