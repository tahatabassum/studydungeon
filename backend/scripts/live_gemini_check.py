"""
Live Gemini API verification script (manual opt-in check).
Never run automatically by pytest. Never logs/prints the raw API key or full document text.
"""
import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ai.gemini_provider import GeminiProvider
from app.core.config import settings


async def main():
    print("=== StudyDungeon: Live Gemini Check (Manual Opt-In) ===")

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("[SKIP] GEMINI_API_KEY environment variable is not set. Skipping live test.")
        return 0

    masked_key = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else "***"
    print(f"[INFO] Found GEMINI_API_KEY: {masked_key}")
    print(f"[INFO] Configured AI model: {settings.GEMINI_MODEL}")

    try:
        provider = GeminiProvider()

        # 1. Test Text Classification
        print("[RUN] Testing document classification...")
        sample_text = (
            "Newton's Second Law of Motion states that the acceleration of an object is directly "
            "proportional to the net force acting upon it and inversely proportional to its mass (F = ma)."
        )
        check = await provider.classify_document(sample_text)
        print(f"[PASS] Classification completed: is_study_material={check.is_study_material}, "
              f"subject={check.subject}, educational_score={check.educational_content_score:.2f}")

        # 2. Test Vision OCR with 1x1 test PNG
        print("[RUN] Testing vision OCR payload...")
        # Tiny 1x1 transparent PNG bytes
        tiny_png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
            b"\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        ocr_result = await provider.ocr_image(tiny_png, mime_type="image/png")
        print(f"[PASS] Vision OCR completed successfully (response length: {len(ocr_result)} chars).")

        print("=== Live Gemini Check PASSED ===")
        return 0

    except Exception as e:
        print(f"[ERROR] Live Gemini check failed: {type(e).__name__}: {str(e)}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
