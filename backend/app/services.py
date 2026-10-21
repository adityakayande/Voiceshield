import os
import re
import shutil
import tempfile
from pathlib import Path

import httpx


DEMO_CUES = {
    "Urgency language": (r"\b(urgent|immediately|right now|within minutes|act now)\b", 15),
    "Unverified sourcing": (r"\b(share this|they don't want you to know|forwarded as received|source: whatsapp)\b", 20),
    "Absolute claim wording": (r"\b(always|never|100% proven|everyone knows|guaranteed)\b", 10),
    "Financial or credential request": (r"\b(send money|transfer funds|one.time password|\botp\b|bank details)\b", 20),
}


def detect_language(text: str, hint: str | None = None) -> str:
    if hint and hint.lower() in {"en", "hi", "mr"}:
        return hint.lower()
    devanagari = len(re.findall(r"[\u0900-\u097f]", text))
    latin = len(re.findall(r"[A-Za-z]", text))
    if devanagari > latin * 0.45:
        return "hi/mr"  # Devanagari alone cannot distinguish Hindi from Marathi.
    return "en"


def analyze_text(text: str, language: str | None = None) -> tuple[float, list[dict], str]:
    detected = detect_language(text, language)
    evidence = []
    score = 12
    for name, (pattern, weight) in DEMO_CUES.items():
        for match in list(re.finditer(pattern, text, flags=re.IGNORECASE))[:2]:
            score += weight
            evidence.append({"type": "demo_signal", "title": name, "quote": match.group(0), "start": match.start(), "end": match.end()})
    score = min(score, 88)
    evidence.append({"type": "limitation", "title": "Demo mode", "quote": "This is a wording-signal demo, not a trained fact-checking model."})
    return float(score), evidence, detected


async def lookup_fact_checks(query: str) -> list[dict]:
    key = os.getenv("GOOGLE_FACT_CHECK_API_KEY")
    if not key:
        return []
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            response = await client.get(
                "https://factchecktools.googleapis.com/v1alpha1/claims:search",
                params={"query": query[:500], "key": key, "pageSize": 5},
            )
            response.raise_for_status()
            claims = response.json().get("claims", [])
    except (httpx.HTTPError, ValueError):
        return []
    results = []
    for claim in claims:
        for review in claim.get("claimReview", []):
            results.append({
                "publisher": review.get("publisher", {}).get("name", "Fact checker"),
                "title": review.get("title", claim.get("text", "Published review")),
                "url": review.get("url", ""),
                "rating": review.get("textualRating"),
                "review_date": review.get("reviewDate"),
            })
    return results[:8]


def extract_image_text(data: bytes) -> str:
    try:
        from PIL import Image
        import pytesseract
    except ImportError as exc:
        raise RuntimeError("OCR dependencies are not installed. Install Pillow and pytesseract, then Tesseract OCR.") from exc
    if not shutil.which(os.getenv("TESSERACT_CMD", "tesseract")):
        raise RuntimeError("Tesseract OCR is not installed or not on PATH.")
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as handle:
        handle.write(data)
        path = Path(handle.name)
    try:
        with Image.open(path) as image:
            return pytesseract.image_to_string(image, lang="eng+hin")[:12000].strip()
    finally:
        path.unlink(missing_ok=True)
