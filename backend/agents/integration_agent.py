from .base_agent import BaseAgent
from typing import Dict, Any
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class IntegrationAgent(BaseAgent):
    async def execute(self, task: Dict) -> Dict[str, Any]:
        self.start_time = datetime.now(timezone.utc)
        
        try:
            integration_name = task.get("integration_name")
            cached = self.cache.get("integration_playbook", integration_name)
            
            if cached:
                return {"success": True, "session_id": self.session_id, "playbook": cached, "cached": True}
            
            messages = [
                {"role": "system", "content": self.get_system_prompt()},
                {"role": "user", "content": self._format_integration_request(task)}
            ]
            
            response = await self.call_llm(messages=messages, max_tokens=6000)
            playbook = self._parse_playbook(response["content"])
            self.cache.set("integration_playbook", integration_name, playbook)
            
            return {"success": True, "session_id": self.session_id, "playbook": playbook, "cached": False}
        except Exception as e:
            logger.error(f"Integration agent failed: {str(e)}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    def get_system_prompt(self) -> str:
        return """You are a senior integration architect. Create comprehensive integration playbooks with installation, code examples, and testing."""
    
    def _format_integration_request(self, task: Dict) -> str:
        return f"""Create integration playbook for: {task.get('integration_name')}. Tech: FastAPI + React + MongoDB"""
    
    def _parse_playbook(self, content: str) -> Dict:
        return {"content": content, "format": "markdown"}
