from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import asyncio
import logging
import json

logger = logging.getLogger(__name__)

class BaseAgent(ABC):
    """
    Base class for all agents
    """
    
    def __init__(
        self,
        session_id: str,
        context: Dict,
        cache: Any,
        llm_client: Any,
        tools_registry: Any
    ):
        self.session_id = session_id
        self.context = context
        self.cache = cache
        self.llm = llm_client
        self.tools = tools_registry
        self.conversation_history = []
        self.tokens_used = 0
        self.start_time = None
        
    @abstractmethod
    async def execute(self, task: Dict) -> Dict[str, Any]:
        """Execute agent task"""
        pass
    
    @abstractmethod
    def get_system_prompt(self) -> str:
        """Get agent's system prompt"""
        pass
    
    async def think(self, thought: str):
        """Internal reasoning"""
        logger.info(f"[{self.session_id}] THINK: {thought}")
        self.conversation_history.append({
            "type": "thought",
            "content": thought,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def call_llm(
        self,
        messages: List[Dict],
        tools: Optional[List[Dict]] = None,
        max_tokens: int = 4096
    ) -> Dict:
        """Call LLM with messages"""
        try:
            response = await self.llm.chat(
                messages=messages,
                tools=tools,
                max_tokens=max_tokens,
                temperature=self.get_temperature()
            )
            
            self.tokens_used += response.get("usage", {}).get("total_tokens", 0)
            return response
            
        except Exception as e:
            logger.error(f"LLM call failed: {str(e)}", exc_info=True)
            raise
    
    async def execute_tool(self, tool_name: str, tool_input: Dict) -> Dict:
        """Execute a tool"""
        try:
            tool_func = self.tools.get_tool(tool_name)
            if not tool_func:
                raise ValueError(f"Tool not found: {tool_name}")
            
            result = await tool_func(**tool_input)
            return result
            
        except Exception as e:
            logger.error(f"Tool execution failed: {tool_name} - {str(e)}")
            return {"success": False, "error": str(e)}
    
    def get_temperature(self) -> float:
        """Default temperature"""
        return 0.7
    
    def get_duration(self) -> float:
        """Get execution duration in seconds"""
        if self.start_time:
            return (datetime.now(timezone.utc) - self.start_time).total_seconds()
        return 0.0