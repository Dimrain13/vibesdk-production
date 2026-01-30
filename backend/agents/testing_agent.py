from .base_agent import BaseAgent
from typing import Dict, Any
from datetime import datetime, timezone
import json
import logging

logger = logging.getLogger(__name__)

class TestingAgent(BaseAgent):
    async def execute(self, task: Dict) -> Dict[str, Any]:
        self.start_time = datetime.now(timezone.utc)
        
        try:
            test_results = await self._run_tests(task)
            report_path = await self._save_test_report(test_results)
            
            return {
                "success": True,
                "session_id": self.session_id,
                "test_results": test_results,
                "report_path": report_path,
                "duration_seconds": self.get_duration()
            }
        except Exception as e:
            logger.error(f"Testing agent failed: {str(e)}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    def get_system_prompt(self) -> str:
        return """You are an expert QA automation engineer. Test applications comprehensively."""
    
    async def _run_tests(self, task: Dict) -> Dict:
        features = task.get("features_or_bugs_to_test", [])
        results = []
        
        for feature in features:
            if "/api/" in feature:
                result = await self._test_api_endpoint(feature)
                results.append(result)
        
        return {"type": "integration", "tests": results, "summary": self._calculate_summary(results)}
    
    async def _test_api_endpoint(self, endpoint: str) -> Dict:
        base_url = "http://localhost:8001"
        result = await self.execute_tool("execute_bash", {
            "command": f"curl -s -w '\\n%{{http_code}}' {base_url}{endpoint}"
        })
        return {"endpoint": endpoint, "status": "passed" if result.get("success") else "failed", "result": result}
    
    def _calculate_summary(self, results) -> Dict:
        total = len(results)
        passed = sum(1 for r in results if r.get("status") == "passed")
        return {"total": total, "passed": passed, "failed": total - passed}
    
    async def _save_test_report(self, results: Dict) -> str:
        import time
        timestamp = int(time.time())
        path = f"/app/test_reports/iteration_{timestamp}.json"
        await self.execute_tool("create_file", {"path": path, "content": json.dumps(results, indent=2)})
        return path
