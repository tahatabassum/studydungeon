import base64
from unittest.mock import AsyncMock, patch

import pytest

from app.ai.gemini_provider import GeminiProvider
from app.core.config import settings


@pytest.mark.asyncio
async def test_gemini_vision_ocr_image_payload():
    """
    TDD Red test: GeminiProvider.ocr_image must send base64 inlineData with image/png or image/jpeg
    to the Gemini API and parse structured OCR text.
    """
    fake_png = b"\x89PNG\r\n\x1a\nfakeimagebytes"
    expected_b64 = base64.b64encode(fake_png).decode("utf-8")

    with patch.object(settings, "GEMINI_API_KEY", "test-key-123"):
        with patch.object(settings, "GEMINI_MODEL", "gemini-2.0-flash"):
            provider = GeminiProvider()

            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.json = lambda: {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"text": "Transcribed notes from textbook page."}
                            ]
                        }
                    }
                ]
            }
            mock_response.raise_for_status = lambda: None

            with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
                mock_post.return_value = mock_response

                extracted_text = await provider.ocr_image(fake_png, mime_type="image/png")

                assert extracted_text == "Transcribed notes from textbook page."
                assert mock_post.called

                # Inspect payload sent to Gemini
                call_kwargs = mock_post.call_args.kwargs
                payload = call_kwargs.get("json", {})
                parts = payload["contents"][0]["parts"]

                # Verify inlineData part structure
                inline_part = next((p for p in parts if "inlineData" in p), None)
                assert inline_part is not None, "inlineData part must be present in Gemini vision request"
                assert inline_part["inlineData"]["mimeType"] == "image/png"
                assert inline_part["inlineData"]["data"] == expected_b64
