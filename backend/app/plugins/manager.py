"""
插件系统基础架构
"""
import importlib
import os
import sys
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional


class PluginInterface:
    """
    插件接口。所有插件必须继承此类。
    插件可通过实现以下钩子方法参与平台生命周期。
    """

    name: str = "base-plugin"
    version: str = "0.1.0"

    def on_startup(self, app: Any) -> None:
        """应用启动时调用"""
        pass

    def on_shutdown(self, app: Any) -> None:
        """应用关闭时调用"""
        pass

    def on_task_completed(self, task_data: Dict[str, Any]) -> None:
        """任务完成时调用"""
        pass

    def on_task_failed(self, task_data: Dict[str, Any]) -> None:
        """任务失败时调用"""
        pass

    def on_file_uploaded(self, file_data: Dict[str, Any]) -> None:
        """文件上传时调用"""
        pass

    def on_user_login(self, user_data: Dict[str, Any]) -> None:
        """用户登录时调用"""
        pass


class PluginManager:
    """
    插件管理器 — 发现/加载/卸载/调用插件
    """

    def __init__(self, plugins_dir: str = None):
        if plugins_dir is None:
            # 默认为 app/plugins/
            self.plugins_dir = Path(__file__).parent
        else:
            self.plugins_dir = Path(plugins_dir)
        self._plugins: Dict[str, PluginInterface] = {}

    def discover(self) -> List[str]:
        """返回 plugins/ 目录下所有 .py 文件（不含 __init__）"""
        plugins = []
        if not self.plugins_dir.exists():
            return plugins
        for f in self.plugins_dir.iterdir():
            if f.suffix == ".py" and f.stem not in ("__init__", "manager", "interface"):
                plugins.append(f.stem)
        return plugins

    def load_all(self) -> Dict[str, PluginInterface]:
        """加载所有发现插件"""
        self._plugins.clear()
        for name in self.discover():
            try:
                mod = importlib.import_module(f"app.plugins.{name}")
                # 查找插件类（最后一个继承 PluginInterface 的类）
                plugin_cls = None
                for attr_name in dir(mod):
                    attr = getattr(mod, attr_name)
                    if isinstance(attr, type) and issubclass(attr, PluginInterface) and attr is not PluginInterface:
                        plugin_cls = attr
                        break
                if plugin_cls is None:
                    print(f"[PluginManager] {name}: 未找到插件类，跳过")
                    continue
                instance = plugin_cls()
                self._plugins[instance.name] = instance
                print(f"[PluginManager] 已加载: {instance.name} v{instance.version}")
            except Exception as e:
                print(f"[PluginManager] 加载 {name} 失败: {e}")
        return self._plugins

    def call_hooks(self, hook_name: str, **kwargs) -> None:
        """触发所有插件的同名钩子方法"""
        for name, plugin in self._plugins.items():
            handler: Callable = getattr(plugin, hook_name, None)
            if callable(handler):
                try:
                    handler(**kwargs)
                except Exception as e:
                    print(f"[PluginManager] {name}.{hook_name} 执行失败: {e}")

    def get(self, name: str) -> Optional[PluginInterface]:
        """获取指定名称的插件"""
        return self._plugins.get(name)

    @property
    def loaded(self) -> List[str]:
        """返回已加载插件名称列表"""
        return list(self._plugins.keys())
