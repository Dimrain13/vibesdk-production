from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import os
import logging
import json

from core.agent_manager import AgentManager, AgentTier
from core.cache import CacheManager
from core.context_manager import ContextManager
from tools.registry import ToolsRegistry
from llm.factory import get_llm_client
from auth.routes import router as auth_router
from auth.service import AuthService
from auth.middleware import get_current_user, security
from auth.models import User
from api.files import router as files_router
from api.terminal import router as terminal_router

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Emergent Clone API",
    version="1.0.0",
    description="AI-powered development agent platform"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cache_manager = CacheManager(os.getenv("REDIS_URL", "redis://localhost:6379"))
context_manager = ContextManager(
    os.getenv("MONGO_URL", "mongodb://localhost:27017"),
    os.getenv("DB_NAME", "emergent_dev")
)
tools_registry = ToolsRegistry()
llm_client = get_llm_client()

agent_manager = AgentManager(
    cache_manager,
    context_manager,
    tools_registry,
    llm_client
)

auth_service = AuthService(
    os.getenv("MONGO_URL", "mongodb://localhost:27017"),
    os.getenv("DB_NAME", "emergent_dev")
)

app.include_router(auth_router)
app.include_router(files_router)
app.include_router(terminal_router)

class AgentRequest(BaseModel):
    user_id: str
    request: str
    tier: Optional[str] = "e1"
    project_id: Optional[str] = None

class AgentResponse(BaseModel):
    success: bool
    session_id: str
    result: Any
    duration_seconds: float
    tokens_used: Optional[int] = None
    error: Optional[str] = None

@app.get("/health")
async def health_check():
    try:
        cache_manager.redis.ping()
        redis_status = "up"
    except:
        redis_status = "down"
    
    try:
        await context_manager.client.admin.command('ping')
        mongo_status = "up"
    except:
        mongo_status = "down"
    
    overall_status = "healthy" if (redis_status == "up" and mongo_status == "up") else "degraded"
    
    return {
        "status": overall_status,
        "services": {
            "api": "up",
            "cache": redis_status,
            "database": mongo_status
        },
        "version": "1.0.0"
    }

@app.post("/api/agent/execute", response_model=AgentResponse)
async def execute_agent(request: AgentRequest):
    try:
        tier_map = {
            "e1": AgentTier.E1,
            "e1_5": AgentTier.E1_5,
            "e1.5": AgentTier.E1_5,
            "e2": AgentTier.E2
        }
        tier = tier_map.get(request.tier.lower(), AgentTier.E1)
        
        result = await agent_manager.handle_user_request(
            user_id=request.user_id,
            request=request.request,
            tier=tier
        )
        
        return AgentResponse(
            success=result["success"],
            session_id=result["session_id"],
            result=result.get("result", {}),
            duration_seconds=result.get("duration_seconds", 0),
            tokens_used=result.get("tokens_used")
        )
        
    except Exception as e:
        logger.error(f"Agent execution failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/agent/active")
async def get_active_agents():
    return {
        "active_agents": agent_manager.get_active_agents(),
        "count": len(agent_manager.active_agents)
    }

@app.get("/api/context/{user_id}")
async def get_user_context(user_id: str):
    context = await context_manager.get_user_context(user_id)
    return context

@app.get("/api/stats/cache")
async def get_cache_stats():
    return cache_manager.get_stats()

@app.get("/api/agent/history")
async def get_agent_history(limit: int = 50):
    return {
        "history": agent_manager.agent_history[-limit:],
        "total": len(agent_manager.agent_history)
    }

@app.get("/api/tools")
async def list_tools():
    return {"tools": tools_registry.list_tools()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)