import asyncio
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

async def execute_bash(command: str, timeout: int = 120, cwd: Optional[str] = None) -> Dict:
    try:
        dangerous_commands = ['rm -rf /', 'mkfs', 'dd if=']
        if any(danger in command for danger in dangerous_commands):
            return {"success": False, "error": "Dangerous command blocked"}
        
        process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd or "/app"
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            process.kill()
            return {"success": False, "error": f"Command timed out after {timeout}s"}
        
        return {
            "success": process.returncode == 0,
            "stdout": stdout.decode('utf-8'),
            "stderr": stderr.decode('utf-8'),
            "exit_code": process.returncode
        }
    except Exception as e:
        logger.error(f"execute_bash failed: {str(e)}")
        return {"success": False, "error": str(e)}
