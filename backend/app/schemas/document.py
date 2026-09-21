from typing import Dict, List, Literal, Optional, Any, Union
from pydantic import BaseModel, Field


class ExtractedField(BaseModel):
    value: Union[str, int, float, bool] = Field(..., description="The extracted field value")
    confidence: float = Field(default=0.9, ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")
    category: str = Field(default="General", description="Category grouping for the field")


class AnomalyItem(BaseModel):
    type: Literal["warning", "error", "info"] = Field(default="info", description="Severity classification type")
    description: str = Field(..., description="Clear explanation of the detected anomaly or risk")
    severity: Literal["low", "medium", "high"] = Field(default="low", description="Severity rating")


class SpecificAnalysis(BaseModel):
    insights: List[str] = Field(default_factory=list, description="Key strategic insights from the document")
    verification_status: Literal["verified", "partial", "suspicious", "failed"] = Field(
        default="verified", description="Document authenticity status"
    )
    recommendations: List[str] = Field(default_factory=list, description="Actionable recommendations for human auditors")


class DocumentReport(BaseModel):
    document_type: str = Field(default="Unknown", description="Primary document classification (e.g. Invoice, CV/Resume, Contract, ID Card)")
    document_subtype: Optional[str] = Field(default=None, description="Granular subtype if applicable")
    confidence: float = Field(default=0.85, ge=0.0, le=1.0, description="Overall document classification confidence")
    extracted_fields: Dict[str, ExtractedField] = Field(default_factory=dict, description="Key-value fields extracted with confidence")
    detected_entities: List[str] = Field(default_factory=list, description="Named entities detected (names, orgs, dates, amounts)")
    anomalies: List[AnomalyItem] = Field(default_factory=list, description="Risk flags, discrepancies or missing mandatory clauses")
    document_specific_analysis: SpecificAnalysis = Field(
        default_factory=SpecificAnalysis, description="Domain specific insights and verification status"
    )
    summary: str = Field(default="", description="Executive summary of the document")


class AuditResponse(BaseModel):
    report: DocumentReport
    latency_ms: float
    pages_analyzed: int = 1
    model_used: str
    status: Literal["success", "partial", "failed"] = "success"
