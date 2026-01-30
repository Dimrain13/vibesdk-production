import aiohttp
import os
import logging
from typing import Dict

logger = logging.getLogger(__name__)

async def web_search(query: str, num_results: int = 5) -> Dict:
    try:
        api_key = os.getenv("BRAVE_SEARCH_API_KEY")
        if not api_key:
            return {"success": False, "error": "BRAVE_SEARCH_API_KEY not configured"}
        
        url = "https://api.search.brave.com/res/v1/web/search"
        headers = {"X-Subscription-Token": api_key, "Accept": "application/json"}
        params = {"q": query, "count": num_results}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    results = []
                    for item in data.get("web", {}).get("results", []):
                        results.append({
                            "title": item.get("title"),
                            "url": item.get("url"),
                            "description": item.get("description")
                        })
                    return {"success": True, "query": query, "results": results}
                else:
                    return {"success": False, "error": f"Search API returned status {response.status}"}
    except Exception as e:
        logger.error(f"web_search failed: {str(e)}")
        return {"success": False, "error": str(e)}
