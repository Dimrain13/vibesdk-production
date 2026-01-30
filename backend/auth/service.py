from motor.motor_asyncio import AsyncIOMotorClient
from .models import UserCreate, UserLogin, User
from .utils import hash_password, verify_password, create_access_token
from datetime import datetime, timezone
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class AuthService:
    def __init__(self, mongo_url: str, db_name: str):
        self.client = AsyncIOMotorClient(mongo_url)
        self.db = self.client[db_name]
        self.users = self.db.users
    
    async def create_user(self, user_data: UserCreate) -> User:
        existing = await self.users.find_one({"email": user_data.email})
        if existing:
            raise ValueError("Email already registered")
        
        hashed_password = hash_password(user_data.password)
        user_doc = {
            "email": user_data.email,
            "name": user_data.name,
            "password": hashed_password,
            "created_at": datetime.now(timezone.utc),
            "is_active": True
        }
        
        result = await self.users.insert_one(user_doc)
        user_doc["id"] = str(result.inserted_id)
        del user_doc["password"]
        del user_doc["_id"]
        return User(**user_doc)
    
    async def authenticate_user(self, login_data: UserLogin) -> Tuple[User, str]:
        user_doc = await self.users.find_one({"email": login_data.email})
        if not user_doc:
            raise ValueError("Invalid credentials")
        if not verify_password(login_data.password, user_doc["password"]):
            raise ValueError("Invalid credentials")
        if not user_doc.get("is_active", True):
            raise ValueError("Account is disabled")
        
        token = create_access_token({"sub": str(user_doc["_id"])})
        user_doc["id"] = str(user_doc["_id"])
        del user_doc["password"]
        del user_doc["_id"]
        return User(**user_doc), token
    
    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        from bson import ObjectId
        try:
            user_doc = await self.users.find_one({"_id": ObjectId(user_id)}, {"password": 0, "_id": 0})
            if user_doc:
                user_doc["id"] = user_id
                return User(**user_doc)
            return None
        except Exception as e:
            logger.error(f"Failed to get user: {str(e)}")
            return None
