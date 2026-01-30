import redis
import json
import hashlib
from typing import Optional, Any
import logging

logger = logging.getLogger(__name__)

class CacheManager:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url, decode_responses=True)
        self.ttls = {
            "integration_playbook": 2592000,
            "design_guidelines": 86400,
            "web_search_results": 3600,
            "agent_context": 1800
        }
    
    def get(self, cache_type: str, key: str) -> Optional[Any]:
        try:
            cache_key = self._build_cache_key(cache_type, key)
            value = self.redis.get(cache_key)
            if value:
                logger.debug(f"Cache hit: {cache_key}")
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Cache get error: {str(e)}")
            return None
    
    def set(self, cache_type: str, key: str, value: Any) -> bool:
        try:
            cache_key = self._build_cache_key(cache_type, key)
            ttl = self.ttls.get(cache_type, 3600)
            self.redis.setex(cache_key, ttl, json.dumps(value))
            return True
        except Exception as e:
            logger.error(f"Cache set error: {str(e)}")
            return False
    
    def _build_cache_key(self, cache_type: str, key: str) -> str:
        if len(key) > 100:
            key_hash = hashlib.md5(key.encode()).hexdigest()
            return f"emergent:{cache_type}:{key_hash}"
        return f"emergent:{cache_type}:{key}"
    
    def get_stats(self) -> Dict:
        try:
            info = self.redis.info("stats")
            hits = info.get("keyspace_hits", 0)
            misses = info.get("keyspace_misses", 0)
            total = hits + misses
            hit_rate = round((hits / total) * 100, 2) if total > 0 else 0.0
            return {"hits": hits, "misses": misses, "hit_rate": hit_rate}
        except Exception as e:
            logger.error(f"Failed to get cache stats: {str(e)}")
            return {}
