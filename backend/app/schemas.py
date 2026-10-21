from datetime import datetime
from pydantic import BaseModel, Field


class TextRequest(BaseModel):
    text: str = Field(min_length=8, max_length=12000)
    language: str | None = None


class FactCheck(BaseModel):
    publisher: str
    title: str
    url: str
    rating: str | None = None
    review_date: str | None = None


class AnalysisResult(BaseModel):
    id: int
    kind: str
    label: str
    risk_score: float
    language: str | None
    summary: str
    evidence: list[dict]
    fact_checks: list[FactCheck] = []
    model_status: str
    created_at: datetime
