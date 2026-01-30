from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPAuthorizationCredentials
from .models import UserCreate, UserLogin, Token, User
from .service import AuthService
from .middleware import get_current_user, security
from .utils import create_access_token
import os

auth_service = AuthService(
    os.getenv("MONGO_URL", "mongodb://localhost:27017"),
    os.getenv("DB_NAME", "emergent_dev")
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/signup", response_model=Token)
async def signup(user_data: UserCreate):
    try:
        user = await auth_service.create_user(user_data)
        token = create_access_token({"sub": user.id})
        return Token(access_token=token, user=user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user")

@router.post("/login", response_model=Token)
async def login(login_data: UserLogin):
    try:
        user, token = await auth_service.authenticate_user(login_data)
        return Token(access_token=token, user=user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Authentication failed")

@router.get("/me", response_model=User)
async def get_current_user_info(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials, auth_service)
    return user

@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}
