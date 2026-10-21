from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os
import shutil
import wave
from io import BytesIO

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine
from .models import Analysis
from .schemas import AnalysisResult, TextRequest
from .services import analyze_text, extract_image_text, lookup_fact_checks


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="VoiceShield API", description="Explainable voice and claim review workflow", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def save_analysis(db: Session, *, kind: str, label: str, score: float, language: str | None, summary: str, evidence: list[dict], fact_checks: list[dict] | None = None) -> dict:
    row = Analysis(kind=kind, label=label, risk_score=score, language=language, summary=summary, evidence=evidence)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "kind": kind, "label": label, "risk_score": score, "language": language, "summary": summary, "evidence": evidence, "fact_checks": fact_checks or [], "model_status": "heuristic_demo", "created_at": row.created_at or datetime.now(timezone.utc)}


async def process_text(text: str, language: str | None, db: Session, kind: str = "text", leading_evidence: list[dict] | None = None) -> dict:
    score, evidence, detected = analyze_text(text, language)
    evidence = (leading_evidence or []) + evidence
    checks = await lookup_fact_checks(text) if score >= 30 else []
    label = "Review recommended" if score >= 30 else "No strong demo signals"
    summary = "A wording-signal demo found patterns to review. This is not a truth verdict." if score >= 30 else "Few configured wording signals were found. This does not establish that the claim is true."
    return save_analysis(db, kind=kind, label=label, score=score, language=detected, summary=summary, evidence=evidence, fact_checks=checks)


@app.get("/api/health")
def health():
    return {"status": "ok", "text_model": "heuristic_demo", "audio_model": "signal_demo", "ocr_available": bool(shutil.which(os.getenv("TESSERACT_CMD", "tesseract"))), "fact_check_configured": bool(os.getenv("GOOGLE_FACT_CHECK_API_KEY"))}


@app.post("/api/analyze/text", response_model=AnalysisResult)
async def analyze_text_route(payload: TextRequest, db: Session = Depends(get_db)):
    return await process_text(payload.text, payload.language, db)


@app.post("/api/analyze/image", response_model=AnalysisResult)
async def analyze_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if file.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(415, "Upload a PNG, JPEG, or WebP screenshot.")
    data = await file.read(8_000_001)
    if len(data) > 8_000_000:
        raise HTTPException(413, "Image is larger than 8 MB.")
    try:
        text = extract_image_text(data)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    if len(text) < 8:
        raise HTTPException(422, "OCR could not find enough readable text in the image.")
    return await process_text(text, None, db, kind="image", leading_evidence=[{"type": "ocr", "title": "Text extracted from screenshot", "quote": text[:400]}])


@app.post("/api/analyze/audio", response_model=AnalysisResult)
async def analyze_audio(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if file.content_type not in {"audio/wav", "audio/x-wav", "audio/wave", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/webm", "audio/ogg", "audio/flac"}:
        raise HTTPException(415, "Upload WAV, MP3, M4A, WebM, OGG, or FLAC audio.")
    data = await file.read(20_000_001)
    if len(data) > 20_000_000:
        raise HTTPException(413, "Audio is larger than 20 MB.")
    details = []
    if file.filename and file.filename.lower().endswith(".wav"):
        try:
            with wave.open(BytesIO(data)) as wav:
                duration = wav.getnframes() / wav.getframerate()
                details.append({"type": "audio_signal", "title": "WAV properties", "quote": f"{wav.getnchannels()} channel(s), {wav.getframerate()} Hz, {duration:.1f} seconds"})
        except (wave.Error, ZeroDivisionError):
            raise HTTPException(422, "The WAV file could not be decoded.")
    details.append({"type": "limitation", "title": "Detector not configured", "quote": "No fine-tuned voice model is installed. File properties are not evidence of a real or synthetic voice."})
    return save_analysis(db, kind="audio", label="Model required", score=0, language=None, summary="Audio received. Voice authenticity was not classified because model weights are not configured.", evidence=details, fact_checks=[])


@app.get("/api/history", response_model=list[AnalysisResult])
def history(limit: int = 25, db: Session = Depends(get_db)):
    rows = db.query(Analysis).order_by(Analysis.created_at.desc()).limit(max(1, min(limit, 100))).all()
    return [{"id": r.id, "kind": r.kind, "label": r.label, "risk_score": r.risk_score, "language": r.language, "summary": r.summary, "evidence": r.evidence, "fact_checks": [], "model_status": "heuristic_demo" if r.kind != "audio" else "signal_demo", "created_at": r.created_at} for r in rows]
