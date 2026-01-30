from fastapi import APIRouter
from pydantic import BaseModel
from tools.bash_execution import execute_bash

router = APIRouter(prefix="/api/terminal", tags=["Terminal"])

class CommandRequest(BaseModel):
    command: str

@router.post("/execute")
async def execute_command(request: CommandRequest):
    result = await execute_bash(request.command)
    return result
