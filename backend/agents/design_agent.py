from .base_agent import BaseAgent
from typing import Dict, Any
from datetime import datetime, timezone
import json
import logging

logger = logging.getLogger(__name__)

class DesignAgent(BaseAgent):
    async def execute(self, task: Dict) -> Dict[str, Any]:
        self.start_time = datetime.now(timezone.utc)
        
        try:
            messages = [
                {"role": "system", "content": self.get_system_prompt()},
                {"role": "user", "content": self._format_design_request(task)}
            ]
            
            response = await self.call_llm(messages=messages, max_tokens=8000)
            guidelines = self._parse_design_response(response["content"])
            await self._save_guidelines(guidelines)
            
            return {
                "success": True,
                "session_id": self.session_id,
                "guidelines": guidelines,
                "guidelines_path": "/app/design_guidelines.json",
                "duration_seconds": self.get_duration(),
                "tokens_used": self.tokens_used
            }
        except Exception as e:
            logger.error(f"Design agent failed: {str(e)}", exc_info=True)
            return {"success": False, "error": str(e), "duration_seconds": self.get_duration()}
    
    def get_system_prompt(self) -> str:
        return """You are an elite UI/UX design architect. Create comprehensive design guidelines for web applications. Return JSON format with: colors, typography, spacing, components, layout."""
    
    def _format_design_request(self, task: Dict) -> str:
        return f"""Create design guidelines for: {task.get('problem_statement')}"""
    
    def _parse_design_response(self, content: str) -> Dict:
        try:
            start = content.find('{')
            end = content.rfind('}') + 1
            if start >= 0 and end > start:
                return json.loads(content[start:end])
            return {"raw_response": content}
        except:
            return {"raw_response": content}
    
    async def _save_guidelines(self, guidelines: Dict):
        await self.execute_tool("create_file", {
            "path": "/app/design_guidelines.json",
            "content": json.dumps(guidelines, indent=2)
        })
