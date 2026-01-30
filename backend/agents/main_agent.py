from .base_agent import BaseAgent
from typing import Dict, Any, List
from datetime import datetime, timezone
import logging
import json

logger = logging.getLogger(__name__)

class E1Agent(BaseAgent):
    """E1 - Standard development agent"""
    
    def __init__(self, session_id, context, cache, llm_client, tools_registry):
        super().__init__(session_id, context, cache, llm_client, tools_registry)
        self.agent_tier = "E1"
        self.max_iterations = 10
    
    async def execute(self, task: Dict) -> Dict[str, Any]:
        self.start_time = datetime.now(timezone.utc)
        
        try:
            messages = [
                {"role": "system", "content": self.get_system_prompt()},
                {"role": "user", "content": self._format_user_request(task)}
            ]
            
            iteration = 0
            final_response = None
            
            while iteration < self.max_iterations:
                iteration += 1
                logger.info(f"[{self.session_id}] Iteration {iteration}/{self.max_iterations}")
                
                response = await self.call_llm(
                    messages=messages,
                    tools=self._get_available_tools()
                )
                
                if response.get("stop_reason") == "end_turn":
                    final_response = response
                    break
                
                if response.get("tool_calls"):
                    tool_results = await self._execute_tool_calls(response["tool_calls"])
                    
                    messages.append({
                        "role": "assistant",
                        "content": response.get("content"),
                        "tool_calls": response["tool_calls"]
                    })
                    
                    for tool_result in tool_results:
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_result["tool_call_id"],
                            "content": tool_result["content"]
                        })
                else:
                    final_response = response
                    break
            
            final_content = final_response.get("content", "Task completed")
            
            return {
                "success": True,
                "session_id": self.session_id,
                "result": final_content,
                "iterations": iteration,
                "duration_seconds": self.get_duration(),
                "tokens_used": self.tokens_used,
                "conversation_history": self.conversation_history
            }
            
        except Exception as e:
            logger.error(f"E1 execution failed: {str(e)}", exc_info=True)
            return {
                "success": False,
                "session_id": self.session_id,
                "error": str(e),
                "duration_seconds": self.get_duration(),
                "tokens_used": self.tokens_used
            }
    
    def get_system_prompt(self) -> str:
        return """You are E1, a capable autonomous development agent.

You help users build full-stack applications using FastAPI (backend) + React (frontend) + MongoDB.

CAPABILITIES:
- Read/write files
- Execute bash commands
- Search web for latest information
- Take screenshots to verify UI

ENVIRONMENT:
- Backend: FastAPI on port 8001, MongoDB
- Frontend: React on port 3000
- All backend routes must have /api prefix
- Use environment variables for config

Available tools:
- view_file: Read file contents
- create_file: Create new file
- search_replace: Edit existing file
- execute_bash: Run bash commands
- web_search: Search for information
- screenshot: Take screenshot of webpage

Current task: Assist the user with their development needs."""
    
    def _format_user_request(self, task: Dict) -> str:
        request = task.get("request", "")
        if self.context.get("projects"):
            request += f"\n\nCurrent project context: {self.context['projects']}"
        return request
    
    def _get_available_tools(self) -> List[Dict]:
        return [
            {
                "type": "function",
                "function": {
                    "name": "view_file",
                    "description": "Read contents of a file",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string", "description": "Absolute path to file"}
                        },
                        "required": ["path"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "create_file",
                    "description": "Create a new file with content",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string"},
                            "content": {"type": "string"}
                        },
                        "required": ["path", "content"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "execute_bash",
                    "description": "Execute bash command",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "command": {"type": "string"}
                        },
                        "required": ["command"]
                    }
                }
            }
        ]
    
    async def _execute_tool_calls(self, tool_calls: List[Dict]) -> List[Dict]:
        results = []
        for tool_call in tool_calls:
            tool_name = tool_call["function"]["name"]
            tool_input = json.loads(tool_call["function"]["arguments"])
            
            logger.info(f"Executing tool: {tool_name}")
            result = await self.execute_tool(tool_name, tool_input)
            
            results.append({
                "tool_call_id": tool_call["id"],
                "content": json.dumps(result)
            })
        return results
    
    def get_temperature(self) -> float:
        return 0.7


class E1_5Agent(E1Agent):
    """E1.5 - Extended focus for complex tasks"""
    
    def __init__(self, session_id, context, cache, llm_client, tools_registry):
        super().__init__(session_id, context, cache, llm_client, tools_registry)
        self.agent_tier = "E1.5"
        self.max_iterations = 20
    
    def get_temperature(self) -> float:
        return 0.6


class E2Agent(E1Agent):
    """E2 - Expert-level problem solving"""
    
    def __init__(self, session_id, context, cache, llm_client, tools_registry):
        super().__init__(session_id, context, cache, llm_client, tools_registry)
        self.agent_tier = "E2"
        self.max_iterations = 50
    
    def get_temperature(self) -> float:
        return 0.5
