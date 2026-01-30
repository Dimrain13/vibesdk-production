import anthropic
import os
import logging
import json
from typing import List, Dict, Optional, Any

logger = logging.getLogger(__name__)

class AnthropicClient:
    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.default_model = "claude-sonnet-4-20250514"
    
    async def chat(self, messages: List[Dict], tools: Optional[List[Dict]] = None, max_tokens: int = 4096, temperature: float = 0.7, model: Optional[str] = None) -> Dict[str, Any]:
        try:
            system_message = None
            filtered_messages = []
            
            for msg in messages:
                if msg["role"] == "system":
                    system_message = msg["content"]
                else:
                    filtered_messages.append(msg)
            
            request_params = {
                "model": model or self.default_model,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": filtered_messages
            }
            
            if system_message:
                request_params["system"] = system_message
            
            if tools:
                request_params["tools"] = self._convert_tools_format(tools)
            
            response = await self.client.messages.create(**request_params)
            return self._parse_response(response)
        except Exception as e:
            logger.error(f"Anthropic API call failed: {str(e)}", exc_info=True)
            raise
    
    def _convert_tools_format(self, tools: List[Dict]) -> List[Dict]:
        anthropic_tools = []
        for tool in tools:
            if tool["type"] == "function":
                func = tool["function"]
                anthropic_tools.append({
                    "name": func["name"],
                    "description": func["description"],
                    "input_schema": func["parameters"]
                })
        return anthropic_tools
    
    def _parse_response(self, response) -> Dict[str, Any]:
        result = {
            "content": "",
            "tool_calls": [],
            "stop_reason": response.stop_reason,
            "usage": {
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens
            }
        }
        
        for block in response.content:
            if block.type == "text":
                result["content"] += block.text
            elif block.type == "tool_use":
                result["tool_calls"].append({
                    "id": block.id,
                    "type": "function",
                    "function": {
                        "name": block.name,
                        "arguments": json.dumps(block.input)
                    }
                })
        
        return result
