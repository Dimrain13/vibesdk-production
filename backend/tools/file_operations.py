import os
import aiofiles
from typing import Optional, List, Dict

async def view_file(path: str, view_range: Optional[List[int]] = None) -> Dict:
    try:
        if not os.path.exists(path):
            return {"success": False, "error": f"File not found: {path}"}
        
        if os.path.isdir(path):
            items = os.listdir(path)
            return {"success": True, "type": "directory", "path": path, "items": items}
        
        async with aiofiles.open(path, 'r', encoding='utf-8') as f:
            content = await f.read()
        
        lines = content.split('\n')
        if view_range:
            start = view_range[0] - 1
            end = view_range[1] if view_range[1] != -1 else len(lines)
            lines = lines[start:end]
        
        numbered_lines = [f"{i+1:4d} | {line}" for i, line in enumerate(lines)]
        return {"success": True, "type": "file", "path": path, "content": '\n'.join(numbered_lines)}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def create_file(path: str, content: str, overwrite: bool = False) -> Dict:
    try:
        if os.path.exists(path) and not overwrite:
            return {"success": False, "error": f"File exists: {path}"}
        os.makedirs(os.path.dirname(path), exist_ok=True)
        async with aiofiles.open(path, 'w', encoding='utf-8') as f:
            await f.write(content)
        return {"success": True, "path": path}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def search_replace(path: str, old_text: str, new_text: str, replace_all: bool = False) -> Dict:
    try:
        if not os.path.exists(path):
            return {"success": False, "error": f"File not found: {path}"}
        async with aiofiles.open(path, 'r', encoding='utf-8') as f:
            content = await f.read()
        if old_text not in content:
            return {"success": False, "error": "Text not found"}
        if replace_all:
            new_content = content.replace(old_text, new_text)
            occurrences = content.count(old_text)
        else:
            new_content = content.replace(old_text, new_text, 1)
            occurrences = 1
        async with aiofiles.open(path, 'w', encoding='utf-8') as f:
            await f.write(new_content)
        return {"success": True, "path": path, "occurrences_replaced": occurrences}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def view_bulk(paths: List[str]) -> Dict:
    results = []
    for path in paths:
        result = await view_file(path)
        results.append({"path": path, "result": result})
    return {"success": True, "files": results}

async def glob_files(pattern: str, path: Optional[str] = None) -> Dict:
    try:
        import glob
        search_path = path or "/app"
        full_pattern = os.path.join(search_path, pattern)
        matches = glob.glob(full_pattern, recursive=True)
        ignore_patterns = ['node_modules', '__pycache__', '.git']
        filtered_matches = [m for m in matches if not any(ig in m for ig in ignore_patterns)]
        return {"success": True, "pattern": pattern, "matches": filtered_matches, "count": len(filtered_matches)}
    except Exception as e:
        return {"success": False, "error": str(e)}
