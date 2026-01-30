import os
from .anthropic_client import AnthropicClient
from .openai_client import OpenAIClient

def get_llm_client(provider: str = None):
    if provider is None:
        if os.getenv("ANTHROPIC_API_KEY"):
            provider = "anthropic"
        elif os.getenv("OPENAI_API_KEY"):
            provider = "openai"
        else:
            raise ValueError("No LLM API keys found in environment")
    
    if provider == "anthropic":
        return AnthropicClient()
    elif provider == "openai":
        return OpenAIClient()
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")
