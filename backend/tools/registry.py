from typing import Dict, Callable
import logging

logger = logging.getLogger(__name__)

class ToolsRegistry:
    def __init__(self):
        self.tools: Dict[str, Callable] = {}
        self._register_all_tools()
    
    def _register_all_tools(self):
        from .file_operations import view_file, create_file, search_replace, view_bulk, glob_files
        from .bash_execution import execute_bash
        from .web_search import web_search
        from .screenshot import screenshot
        from .linting import lint_python, lint_javascript
        
        self.register("view_file", view_file)
        self.register("create_file", create_file)
        self.register("search_replace", search_replace)
        self.register("view_bulk", view_bulk)
        self.register("glob_files", glob_files)
        self.register("execute_bash", execute_bash)
        self.register("web_search", web_search)
        self.register("screenshot", screenshot)
        self.register("lint_python", lint_python)
        self.register("lint_javascript", lint_javascript)
    
    def register(self, name: str, func: Callable):
        self.tools[name] = func
        logger.debug(f"Registered tool: {name}")
    
    def get_tool(self, name: str) -> Callable:
        return self.tools.get(name)
    
    def list_tools(self) -> list:
        return list(self.tools.keys())
