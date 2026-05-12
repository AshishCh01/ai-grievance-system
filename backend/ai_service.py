from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None

try:
    from sentence_transformers import SentenceTransformer
except Exception:  # pragma: no cover
    SentenceTransformer = None

DEPARTMENTS: List[Dict[str, object]] = [
    {
        "name": "Electricity",
        "code": "ELE",
        "officer_title": "Electricity Officer",
        "keywords": ["electricity", "power", "current", "transformer", "street light", "voltage", "line fault", "load shedding"],
        "summary_hint": "power outage, transformer fault, voltage fluctuation, street light issue",
        "priority_terms": ["fire", "spark", "danger", "short circuit", "critical", "explosion", "urgent"],
        "suggested_action": "Dispatch line crew, inspect transformer, restore supply, and notify citizen with ETA.",
    },
    {
        "name": "Water Supply",
        "code": "WTR",
        "officer_title": "Water Supply Officer",
        "keywords": ["water", "tap", "pipeline", "pipe leak", "low pressure", "dirty water", "drinking water", "boring", "pump"],
        "summary_hint": "water shortage, pipeline leak, low pressure, contamination, supply interruption",
        "priority_terms": ["contaminated", "no water", "urgent", "health risk", "severe", "critical"],
        "suggested_action": "Inspect supply line, test water quality, and issue tanker or repair support.",
    },
    {
        "name": "Road & Transport",
        "code": "RDT",
        "officer_title": "Road & Transport Officer",
        "keywords": ["road", "pothole", "bridge", "traffic", "bus", "transport", "road light", "highway", "diversion"],
        "summary_hint": "road damage, potholes, traffic congestion, transport issue, broken bridge",
        "priority_terms": ["accident", "blocked", "critical", "dangerous", "major", "urgent"],
        "suggested_action": "Survey road condition, mark hazard, and forward to maintenance contractor.",
    },
    {
        "name": "Sanitation",
        "code": "SAN",
        "officer_title": "Sanitation Officer",
        "keywords": ["garbage", "trash", "waste", "drain", "drainage", "sewer", "sanitation", "cleanliness", "smell"],
        "summary_hint": "garbage accumulation, drainage clogging, sewage overflow, garbage pickup delay",
        "priority_terms": ["sewage", "flood", "infection", "urgent", "foul", "critical"],
        "suggested_action": "Schedule cleaning crew, unblock drains, and confirm sanitation pickup.",
    },
    {
        "name": "Police",
        "code": "POL",
        "officer_title": "Police Officer",
        "keywords": ["police", "theft", "crime", "harassment", "assault", "security", "fir", "robbery", "abuse"],
        "summary_hint": "law and order, safety threat, theft, harassment, criminal incident",
        "priority_terms": ["emergency", "attack", "danger", "violent", "urgent", "critical"],
        "suggested_action": "Create emergency response case and inform the duty officer immediately.",
    },
    {
        "name": "Health",
        "code": "HLT",
        "officer_title": "Health Officer",
        "keywords": ["hospital", "doctor", "medicine", "ambulance", "health", "clinic", "patient", "treatment", "nurse"],
        "summary_hint": "hospital issue, medicine shortage, ambulance delay, treatment concern",
        "priority_terms": ["ambulance", "life", "critical", "emergency", "urgent", "deadly"],
        "suggested_action": "Escalate to health center, verify availability, and arrange medical assistance.",
    },
    {
        "name": "Education",
        "code": "EDU",
        "officer_title": "Education Officer",
        "keywords": ["school", "teacher", "college", "exam", "scholarship", "admission", "education", "fees", "class"],
        "summary_hint": "school complaint, teacher absence, scholarship issue, admission or exam concern",
        "priority_terms": ["exam", "urgent", "critical", "midterm", "deadline"],
        "suggested_action": "Forward to the education cell and request school-level verification.",
    },
    {
        "name": "Agriculture",
        "code": "AGR",
        "officer_title": "Agriculture Officer",
        "keywords": ["crop", "farmer", "seed", "fertilizer", "irrigation", "loan", "agriculture", "farming", "pesticide"],
        "summary_hint": "crop damage, fertilizer shortage, irrigation problem, farmer support",
        "priority_terms": ["crop loss", "drought", "flood", "urgent", "critical"],
        "suggested_action": "Route to agriculture extension officer and inspect field support needs.",
    },
    {
        "name": "Municipal Corporation",
        "code": "MUN",
        "officer_title": "Municipal Officer",
        "keywords": ["municipal", "street", "building", "encroachment", "park", "public area", "drain", "garbage"],
        "summary_hint": "public infrastructure, street services, ward-level civic issue",
        "priority_terms": ["collapsed", "unsafe", "urgent", "major"],
        "suggested_action": "Log the ward complaint and assign field inspection.",
    },
    {
        "name": "Public Works Department",
        "code": "PWD",
        "officer_title": "PWD Officer",
        "keywords": ["pwd", "construction", "bridge", "road work", "building", "damaged", "drain", "culvert"],
        "summary_hint": "public works issue, construction delay, drainage or bridge maintenance",
        "priority_terms": ["collapse", "danger", "urgent", "critical"],
        "suggested_action": "Send maintenance notice and schedule engineering inspection.",
    },
    {
        "name": "Women & Child Safety",
        "code": "WCS",
        "officer_title": "Women & Child Safety Officer",
        "keywords": ["women", "child", "harassment", "abuse", "safety", "girl", "domestic", "molestation"],
        "summary_hint": "safety issue involving women or children, abuse, harassment, domestic concern",
        "priority_terms": ["danger", "abuse", "urgent", "critical", "immediate"],
        "suggested_action": "Escalate to the women and child protection cell immediately.",
    },
    {
        "name": "Environment",
        "code": "ENV",
        "officer_title": "Environment Officer",
        "keywords": ["pollution", "smoke", "river", "air", "environment", "dumping", "waste", "noise"],
        "summary_hint": "pollution, illegal dumping, environmental hazard, noise issue",
        "priority_terms": ["toxic", "hazard", "urgent", "critical", "fire"],
        "suggested_action": "Record environmental hazard and notify inspection authority.",
    },
]

CATEGORY_ALIASES = {
    "electricity": "Electricity",
    "power": "Electricity",
    "water": "Water Supply",
    "water supply": "Water Supply",
    "road": "Road & Transport",
    "transport": "Road & Transport",
    "sanitation": "Sanitation",
    "garbage": "Sanitation",
    "police": "Police",
    "security": "Police",
    "health": "Health",
    "hospital": "Health",
    "education": "Education",
    "school": "Education",
    "agriculture": "Agriculture",
    "farmer": "Agriculture",
    "municipal": "Municipal Corporation",
    "pwd": "Public Works Department",
    "public works": "Public Works Department",
    "women": "Women & Child Safety",
    "child safety": "Women & Child Safety",
    "environment": "Environment",
    "pollution": "Environment",
}

@lru_cache(maxsize=1)
def _openai_client():
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key or OpenAI is None:
        return None
    try:
        return OpenAI(api_key=api_key)
    except Exception:
        return None

@lru_cache(maxsize=1)
def _sentence_model():
    model_name = os.getenv("SENTENCE_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    if SentenceTransformer is None:
        return None
    try:
        return SentenceTransformer(model_name)
    except Exception:
        return None

@lru_cache(maxsize=1)
def _catalog_texts() -> List[str]:
    return [
        f"{dept['name']}: {dept['summary_hint']} {' '.join(dept['keywords'])}"
        for dept in DEPARTMENTS
    ]

@lru_cache(maxsize=1)
def _catalog_embeddings() -> Optional[np.ndarray]:
    model = _sentence_model()
    if model is None:
        return None
    try:
        return model.encode(_catalog_texts(), normalize_embeddings=True)
    except Exception:
        return None


def get_department_catalog() -> List[Dict[str, object]]:
    return DEPARTMENTS


def _normalize(text: str) -> str:
    text = (text or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def detect_language(text: str) -> str:
    if re.search(r"[ऀ-ॿ]", text or ""):
        return "Hindi/Indic"
    if re.search(r"[a-zA-Z]", text or ""):
        return "English"
    return "Unknown"


def _keyword_score(text: str) -> Tuple[str, float, str]:
    cleaned = _normalize(text)
    best_name = "Municipal Corporation"
    best_score = 0.0
    reason = "No strong keyword match found."

    for dept in DEPARTMENTS:
        keywords = dept["keywords"]
        score = 0.0
        matched = []
        for keyword in keywords:
            if keyword in cleaned:
                score += 1.0 + min(len(keyword) / 20.0, 0.75)
                matched.append(keyword)
        for alias, target in CATEGORY_ALIASES.items():
            if target == dept["name"] and alias in cleaned:
                score += 0.75
                matched.append(alias)
        if score > best_score:
            best_score = score
            best_name = dept["name"]
            reason = f"Matched keywords: {', '.join(matched[:4])}" if matched else reason

    confidence = min(0.42 + best_score / 4.5, 0.92)
    return best_name, confidence, reason


def _embedding_classification(text: str) -> Optional[Tuple[str, float]]:
    model = _sentence_model()
    embeddings = _catalog_embeddings()
    if model is None or embeddings is None:
        return None
    try:
        query = model.encode([text], normalize_embeddings=True)
        sims = cosine_similarity(query, embeddings)[0]
        idx = int(np.argmax(sims))
        return DEPARTMENTS[idx]["name"], float(sims[idx])
    except Exception:
        return None


def _priority_from_text(text: str, department_name: str) -> Tuple[str, float]:
    cleaned = _normalize(text)
    urgent_terms = [
        "critical", "urgent", "immediately", "emergency", "danger", "life", "severe", "hazard", "fire", "explosion", "flood", "violence",
        "no water", "no electricity", "power outage", "short circuit", "ambulance", "attack", "collapsed",
    ]
    high_terms = ["major", "serious", "blocked", "unsafe", "lost", "stuck", "delay", "stopped"]

    if any(term in cleaned for term in urgent_terms):
        return "Critical", 0.96
    if any(term in cleaned for term in high_terms):
        return "High", 0.84
    if department_name in {"Police", "Health", "Women & Child Safety"}:
        return "High", 0.76
    if department_name in {"Electricity", "Water Supply", "Sanitation"}:
        return "High", 0.72
    return "Medium", 0.64


def _suggest_summary(text: str, limit: int = 26) -> str:
    words = re.findall(r"\w+|[ऀ-ॿ]+", (text or "").strip())
    if not words:
        return "Citizen grievance submitted for review."
    snippet = " ".join(words[:limit])
    return snippet.rstrip(".,;:!") + ("..." if len(words) > limit else "")


def _openai_classification(text: str, title: str = "", location: str = "") -> Optional[Dict[str, object]]:
    client = _openai_client()
    if client is None:
        return None
    model_name = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    system = (
        "You are a government grievance routing engine. "
        "Return strict JSON with keys: department, category, priority, confidence, summary, suggested_action, sentiment, language, reason. "
        "Choose only from these departments: "
        + ", ".join([d['name'] for d in DEPARTMENTS])
        + ". Priority must be one of Low, Medium, High, Critical. "
        "Confidence must be a number between 0 and 1. "
        "Keep summary under 30 words."
    )
    user = f"Title: {title}\nLocation: {location}\nComplaint: {text}"
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        payload = response.choices[0].message.content or "{}"
        data = json.loads(payload)
        if "department" in data:
            return data
    except Exception:
        return None
    return None


def classify_grievance(text: str, title: str = "", location: str = "") -> Dict[str, object]:
    combined = f"{title}. {text}. {location}".strip()
    openai_result = _openai_classification(text=combined, title=title, location=location)
    if openai_result:
        department = openai_result.get("department") or "Municipal Corporation"
        if department not in [d["name"] for d in DEPARTMENTS]:
            department = _keyword_score(combined)[0]
        priority = str(openai_result.get("priority") or "Medium")
        confidence = float(openai_result.get("confidence") or 0.88)
        summary = str(openai_result.get("summary") or _suggest_summary(combined))
        suggested_action = str(openai_result.get("suggested_action") or next((d["suggested_action"] for d in DEPARTMENTS if d["name"] == department), "Review complaint."))
        sentiment = str(openai_result.get("sentiment") or "Neutral")
        category = str(openai_result.get("category") or department)
        language = str(openai_result.get("language") or detect_language(combined))
        reason = str(openai_result.get("reason") or "OpenAI classification used.")
    else:
        keyword_department, keyword_confidence, reason = _keyword_score(combined)
        embedding_match = _embedding_classification(combined)
        if embedding_match and embedding_match[1] > keyword_confidence:
            department = embedding_match[0]
            confidence = min(max(embedding_match[1], 0.55), 0.96)
            reason = "Semantic similarity routed this complaint."
        else:
            department = keyword_department
            confidence = keyword_confidence
        priority, priority_conf = _priority_from_text(combined, department)
        if priority == "Critical":
            confidence = max(confidence, priority_conf)
        summary = _suggest_summary(combined)
        suggested_action = next((d["suggested_action"] for d in DEPARTMENTS if d["name"] == department), "Review complaint.")
        sentiment = "Urgent" if priority in {"Critical", "High"} else "Neutral"
        category = department
        language = detect_language(combined)
    return {
        "department": department,
        "category": category,
        "priority": priority,
        "confidence": round(float(confidence), 3),
        "summary": summary,
        "suggested_action": suggested_action,
        "sentiment": sentiment,
        "language": language,
        "reason": reason,
    }


def similarity_between(text_a: str, text_b: str) -> float:
    a = (text_a or "").strip()
    b = (text_b or "").strip()
    if not a or not b:
        return 0.0

    model = _sentence_model()
    if model is not None:
        try:
            emb = model.encode([a, b], normalize_embeddings=True)
            score = float(cosine_similarity([emb[0]], [emb[1]])[0][0])
            return max(0.0, min(score, 1.0))
        except Exception:
            pass

    try:
        vectorizer = TfidfVectorizer(stop_words="english")
        matrix = vectorizer.fit_transform([a, b])
        score = float(cosine_similarity(matrix[0], matrix[1])[0][0])
        return max(0.0, min(score, 1.0))
    except Exception:
        return 0.0


def best_duplicate_match(candidate_text: str, grievances: List[Dict[str, object]], threshold: float = 0.78) -> Optional[Dict[str, object]]:
    best = None
    best_score = 0.0
    for item in grievances:
        text = f"{item.get('title', '')}. {item.get('description', '')}. {item.get('location', '')}"
        score = similarity_between(candidate_text, text)
        if score > best_score:
            best_score = score
            best = item
    if best and best_score >= threshold:
        return {
            "id": best.get("id"),
            "grievance_code": best.get("grievance_code"),
            "title": best.get("title"),
            "score": round(best_score, 3),
        }
    return None
