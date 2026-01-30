from motor.motor_asyncio import AsyncIOMotorClient
from typing import Dict, Optional
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class ContextManager:
    def __init__(self, mongo_url: str, db_name: str):
        self.client = AsyncIOMotorClient(mongo_url)
        self.db = self.client[db_name]
        self.contexts = self.db.user_contexts
        self.projects = self.db.projects
    
    async def get_user_context(self, user_id: str) -> Dict:
        context = await self.contexts.find_one({"user_id": user_id}, {"_id": 0})
        if not context:
            context = self._create_default_context(user_id)
            await self.contexts.insert_one(context)
        return context
    
    async def update_context(self, user_id: str, agent_result: Dict) -> bool:
        try:
            updates = {"last_updated": datetime.now(timezone.utc)}
            await self.contexts.update_one({"user_id": user_id}, {"$set": updates})
            return True
        except Exception as e:
            logger.error(f"Failed to update context: {str(e)}")
            return False
    
    async def get_project_context(self, user_id: str, project_id: str) -> Optional[Dict]:
        project = await self.projects.find_one({"user_id": user_id, "project_id": project_id}, {"_id": 0})
        return project
    
    async def save_project_context(self, user_id: str, project_id: str, project_data: Dict) -> bool:
        try:
            await self.projects.update_one(
                {"user_id": user_id, "project_id": project_id},
                {"$set": {**project_data, "last_updated": datetime.now(timezone.utc)}},
                upsert=True
            )
            return True
        except Exception as e:
            logger.error(f"Failed to save project context: {str(e)}")
            return False
    
    def _create_default_context(self, user_id: str) -> Dict:
        return {
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc),
            "last_updated": datetime.now(timezone.utc),
            "preferences": {},
            "projects": []
        }
