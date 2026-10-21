# VoiceShield

VoiceShield is a local-first dashboard for reviewing suspicious audio, claims, and forwarded screenshots. It combines an explainable analysis workflow with optional OCR, fact-check lookup, and a persistent analysis history.

## Run locally

### API

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API uses SQLite by default and creates `backend/voiceshield.db`. Set `DATABASE_URL` to a PostgreSQL SQLAlchemy URL to use PostgreSQL. Set `GOOGLE_FACT_CHECK_API_KEY` to enable Google Fact Check Tools lookups. Install Tesseract and make `tesseract` available on `PATH` to enable screenshot OCR.

### Web app

```powershell
cd frontend
npm install
npm run dev
```

Vite proxies `/api` requests to `http://localhost:8000`.

## Model status

This repository provides the application and integration seams, not pretrained or fine-tuned VoiceShield classifiers. No ASVspoof, LIAR, FakeNewsNet, or regional-language model weights are bundled. Until model adapters are configured, the API returns a clearly labelled **heuristic demo** analysis for text and a **signal-only demo** for audio. These are not factuality judgments and must not be treated as evidence that a claim is true or false, or that a voice is genuine or synthetic. OCR and external fact-check results are reported separately. The project’s model training and evaluation remain required research work.

## Main routes

- `POST /api/analyze/text` — text claim analysis, language hint, and optional fact-check lookup
- `POST /api/analyze/image` — screenshot OCR followed by the text pipeline
- `POST /api/analyze/audio` — audio metadata and signal-only demo result
- `GET /api/history` — recent saved analyses
- `GET /api/health` — service and optional integration status

The API docs are available at `/docs` while the backend is running.
