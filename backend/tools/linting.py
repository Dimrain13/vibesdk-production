import asyncio
import logging
from typing import Dict, Optional, List

logger = logging.getLogger(__name__)

async def lint_python(path_pattern: str, fix: bool = False, exclude_patterns: Optional[List[str]] = None) -> Dict:
    try:
        command = f"ruff check {path_pattern}"
        if fix:
            command += " --fix"
        if exclude_patterns:
            for pattern in exclude_patterns:
                command += f" --exclude {pattern}"
        
        from .bash_execution import execute_bash
        result = await execute_bash(command)
        return {"success": result["exit_code"] == 0, "output": result["stdout"], "errors": result["stderr"], "fixed": fix}
    except Exception as e:
        logger.error(f"lint_python failed: {str(e)}")
        return {"success": False, "error": str(e)}

async def lint_javascript(path_pattern: str, fix: bool = False, exclude_patterns: Optional[List[str]] = None) -> Dict:
    try:
        command = f"cd /app/frontend && npx eslint {path_pattern}"
        if fix:
            command += " --fix"
        
        from .bash_execution import execute_bash
        result = await execute_bash(command)
        return {"success": result["exit_code"] == 0, "output": result["stdout"], "errors": result["stderr"], "fixed": fix}
    except Exception as e:
        logger.error(f"lint_javascript failed: {str(e)}")
        return {"success": False, "error": str(e)}
