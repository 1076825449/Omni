"""
Omni 插件系统
"""
from typing import Optional
from app.plugins.manager import PluginManager, PluginInterface

# 全局插件管理器实例
_plugin_manager: Optional[PluginManager] = None


def get_plugin_manager() -> PluginManager:
    global _plugin_manager
    if _plugin_manager is None:
        _plugin_manager = PluginManager()
        _plugin_manager.load_all()
    return _plugin_manager
