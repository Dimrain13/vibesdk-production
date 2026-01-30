import asyncio
from typing import Dict, Optional, Any
from datetime import datetime, timezone
import logging
from enum import Enum
import uuid

logger = logging.getLogger(__name__)

class AgentTier(Enum):
    E1 = "e1"
    E1_5 = "e1_5"
    E2 = "e2"

class AgentType(Enum):
    MAIN = "main"
    DESIGN = "design"
    TESTING = "testing"
    INTEGRATION = "integration"

class AgentManager:
    def __init__(self, cache_manager, context_manager, tools_registry, llm_client):
        self.cache = cache_manager
        self.context = context_manager
        self.tools = tools_registry
        self.llm = llm_client
        self.active_agents: Dict[str, Any] = {}
        self.agent_history = []
        
    async def handle_user_request(self, user_id: str, request: str, tier: AgentTier = AgentTier.E1) -> Dict[str, Any]:
        try:
            session_id = self._generate_session_id(user_id)
            context = await self.context.get_user_context(user_id)
            result = await self._execute_main_agent(session_id, request, tier, context)
            await self.context.update_context(user_id, result)
            self._log_execution(session_id, AgentType.MAIN, tier, result)
            return result
        except Exception as e:
            logger.error(f"Agent execution failed: {str(e)}", exc_info=True)
            raise
    
    async def _execute_main_agent(self, session_id: str, request: str, tier: AgentTier, context: Dict) -> Dict[str, Any]:
        if tier == AgentTier.E1:
            from agents.main_agent import E1Agent
            agent_class = E1Agent
        elif tier == AgentTier.E1_5:
            from agents.main_agent import E1_5Agent
            agent_class = E1_5Agent
        else:
            from agents.main_agent import E2Agent
            agent_class = E2Agent
        
        agent = agent_class(session_id=session_id, context=context, cache=self.cache, llm_client=self.llm, tools_registry=self.tools)
        self.active_agents[session_id] = {"agent": agent, "type": AgentType.MAIN, "tier": tier, "started_at": datetime.now(timezone.utc)}
        
        try:
            result = await agent.execute({"request": request})
            return result
        finally:
            if session_id in self.active_agents:
                del self.active_agents[session_id]
    
    def _generate_session_id(self, user_id: str) -> str:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        return f"{user_id}_{timestamp}_{uuid.uuid4().hex[:8]}"
    
    def _log_execution(self, session_id, agent_type, tier, result):
        log_entry = {
            "session_id": session_id,
            "agent_type": agent_type.value,
            "tier": tier.value if tier else None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "success": result.get("success", False),
            "duration_seconds": result.get("duration_seconds")
        }
        self.agent_history.append(log_entry)
        logger.info(f"Agent execution: {log_entry}")
    
    def get_active_agents(self) -> Dict:
        return {
            session_id: {
                "type": info["type"].value,
                "tier": info["tier"].value if info.get("tier") else None,
                "started_at": info["started_at"].isoformat()
            }
            for session_id, info in self.active_agents.items()
        }
