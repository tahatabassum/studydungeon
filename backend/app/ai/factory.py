from app.ai.gemini_provider import GeminiProvider
from app.ai.mock_provider import MockAIProvider
from app.ai.provider import AIProvider
from app.core.config import settings

_provider_instance: AIProvider | None = None


def get_ai_provider() -> AIProvider:
    global _provider_instance
    if _provider_instance is not None:
        return _provider_instance

    if settings.AI_PROVIDER == "gemini":
        _provider_instance = GeminiProvider()
    else:
        _provider_instance = MockAIProvider()
    return _provider_instance


def set_ai_provider(provider: AIProvider):
    """Used in tests to override AIProvider."""
    global _provider_instance
    _provider_instance = provider

