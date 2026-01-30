from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import os
import aiofiles

router = APIRouter(prefix="/api/files", tags=["Files"])

class FileSave(BaseModel):
    path: str
    content: str

@router.get("/list")
async def list_files(path: str = "/app"):
    try:
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Path not found")
        items = []
        for item in os.listdir(path):
            item_path = os.path.join(path, item)
            items.append({
                "name": item,
                "path": item_path,
                "type": "directory" if os.path.isdir(item_path) else "file"
            })
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/content")
async def get_file_content(path: str):
    try:
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="File not found")
        if os.path.isdir(path):
            raise HTTPException(status_code=400, detail="Path is a directory")
        async with aiofiles.open(path, 'r', encoding='utf-8') as f:
            content = await f.read()
        return {"content": content, "path": path}
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Binary file cannot be read as text")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save")
async def save_file(file_data: FileSave):
    try:
        os.makedirs(os.path.dirname(file_data.path), exist_ok=True)
        async with aiofiles.open(file_data.path, 'w', encoding='utf-8') as f:
            await f.write(file_data.content)
        return {"success": True, "path": file_data.path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
