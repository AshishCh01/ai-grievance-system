from __future__ import annotations

import mimetypes
import os
import secrets
import shutil
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Dict, Generator, List, Optional
from sqlalchemy import Float

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, validator
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, create_engine, desc, func
from sqlalchemy.orm import declarative_base, relationship, Session, sessionmaker


from ai_service import best_duplicate_match, classify_grievance, get_department_catalog

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
SECRET_KEY = os.getenv("SECRET_KEY", "change_this").strip()
ALGORITHM = os.getenv("ALGORITHM", "HS256").strip()
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").strip()
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000").strip()
UPLOAD_DIR = str(Path(__file__).resolve().parent / "uploads")
LOCAL_DEFAULT_OFFICER_PASSWORD = os.getenv("DEFAULT_OFFICER_PASSWORD", "Officer@12345")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@12345")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing in the environment.")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
api_router = APIRouter()

os.makedirs(UPLOAD_DIR, exist_ok=True)

try:
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME", "").strip() or None,
        api_key=os.getenv("CLOUDINARY_API_KEY", "").strip() or None,
        api_secret=os.getenv("CLOUDINARY_API_SECRET", "").strip() or None,
        secure=True,
    )
except Exception:
    pass

class UserRole(str, Enum):
    user = "user"
    officer = "officer"
    admin = "admin"

class GrievanceStatus(str, Enum):
    submitted = "Submitted"
    assigned = "Assigned"
    in_review = "In Review"
    action_taken = "Action Taken"
    resolved = "Resolved"
    rejected = "Rejected"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(30), nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default=UserRole.user.value)
    department = Column(String(120), nullable=True, index=True)
    is_active = Column(String(10), nullable=False, default="true")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    grievances = relationship("Grievance", back_populates="creator", foreign_keys="Grievance.user_id")
    assigned_grievances = relationship("Grievance", back_populates="assigned_officer", foreign_keys="Grievance.officer_id")

class Grievance(Base):
    __tablename__ = "grievances"

    id = Column(Integer, primary_key=True, index=True)
    grievance_code = Column(String(32), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    officer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String(255), nullable=True)
    category = Column(String(120), nullable=False)
    department = Column(String(180), nullable=False, index=True)
    priority = Column(String(30), nullable=False)
    sentiment = Column(String(30), nullable=False, default="Neutral")
    status = Column(String(30), nullable=False, default=GrievanceStatus.submitted.value)
    attachment_url = Column(Text, nullable=True)
    attachment_type = Column(String(80), nullable=True)
    ai_summary = Column(Text, nullable=True)
    ai_reason = Column(Text, nullable=True)
    suggested_action = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    duplicate_score = Column(Float, nullable=True)
    duplicate_of_id = Column(Integer, nullable=True)
    officer_remarks = Column(Text, nullable=True)
    citizen_phone = Column(String(30), nullable=True)
    citizen_email = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

######################
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
######################
    creator = relationship("User", back_populates="grievances", foreign_keys=[user_id])
    assigned_officer = relationship("User", back_populates="assigned_grievances", foreign_keys=[officer_id])

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    grievance_id = Column(Integer, ForeignKey("grievances.id", ondelete="CASCADE"), nullable=True)
    channel = Column(String(20), nullable=False, default="sms")
    message = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="queued")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")
    grievance = relationship("Grievance")

class RegisterPayload(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str

    @validator("name")
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name is too short")
        return value

    @validator("password")
    def validate_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters")
        return value

class LoginPayload(BaseModel):
    email: EmailStr
    password: str
    role: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, object]

class PreviewRequest(BaseModel):
    title: str
    description: str
    location: Optional[str] = ""

class StatusUpdatePayload(BaseModel):
    status: str
    officer_remarks: Optional[str] = ""

class OfficerCreatePayload(BaseModel):
    name: str
    email: EmailStr
    department: str
    phone: Optional[str] = None
    password: Optional[str] = None


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        _seed_system_accounts(db)
        db.commit()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def _serialize_user(user: User) -> Dict[str, object]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "department": user.department,
        "created_at": user.created_at.isoformat(),
    }


def _serialize_grievance(g: Grievance) -> Dict[str, object]:
    creator = g.creator
    assigned = g.assigned_officer
    return {
        "id": g.id,
        "grievance_code": g.grievance_code,
        "user_id": g.user_id,
        "officer_id": g.officer_id,
        "title": g.title,
        "description": g.description,
        "location": g.location,
        "category": g.category,
        "department": g.department,
        "priority": g.priority,
        "sentiment": g.sentiment,
        "status": g.status,
        "attachment_url": g.attachment_url,
        "attachment_type": g.attachment_type,
        "ai_summary": g.ai_summary,
        "ai_reason": g.ai_reason,
        "suggested_action": g.suggested_action,
        "confidence": g.confidence,
        "duplicate_score": g.duplicate_score,
        "duplicate_of_id": g.duplicate_of_id,
        "officer_remarks": g.officer_remarks,
        "citizen_phone": g.citizen_phone,
        "citizen_email": g.citizen_email,
        "creator_name": creator.name if creator else None,
        "creator_email": creator.email if creator else None,
        "officer_name": assigned.name if assigned else None,
        "officer_email": assigned.email if assigned else None,
        "latitude": g.latitude,
        "longitude": g.longitude,
        "created_at": g.created_at.isoformat(),
        "updated_at": g.updated_at.isoformat(),
        "resolved_at": g.resolved_at.isoformat() if g.resolved_at else None,
    }


def _serialize_notification(n: Notification) -> Dict[str, object]:
    return {
        "id": n.id,
        "user_id": n.user_id,
        "grievance_id": n.grievance_id,
        "channel": n.channel,
        "message": n.message,
        "status": n.status,
        "created_at": n.created_at.isoformat(),
    }


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or user.is_active != "true":
        raise credentials_exception
    return user


def _require_role(current_user: User, allowed: List[str]) -> None:
    if current_user.role not in allowed:
        raise HTTPException(status_code=403, detail="You do not have access to this resource")


def _find_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(func.lower(User.email) == email.lower()).first()


def _ensure_seed_user(db: Session, name: str, email: str, role: str, department: Optional[str], password: str, phone: Optional[str] = None) -> User:
    user = _find_user_by_email(db, email)
    if user:
        user.name = name
        user.role = role
        user.department = department
        user.password_hash = hash_password(password)
        if phone:
            user.phone = phone
        return user
    user = User(
        name=name,
        email=email,
        phone=phone,
        password_hash=hash_password(password),
        role=role,
        department=department,
    )
    db.add(user)
    db.flush()
    return user


def _seed_system_accounts(db: Session) -> None:
    _ensure_seed_user(
        db,
        name="System Admin",
        email=ADMIN_EMAIL,
        role=UserRole.admin.value,
        department="Administration",
        password=ADMIN_PASSWORD,
        phone=None,
    )
    for dept in get_department_catalog():
        dept_name = str(dept["name"])
        code = str(dept["code"])
        email = f"{code.lower()}.officer@example.com"
        display = f"{dept_name} Officer"
        _ensure_seed_user(
            db,
            name=display,
            email=email,
            role=UserRole.officer.value,
            department=dept_name,
            password=LOCAL_DEFAULT_OFFICER_PASSWORD,
            phone=None,
        )


def _generate_grievance_code(db: Session, grievance_id: int, department: str) -> str:
    dept = next((d for d in get_department_catalog() if d["name"] == department), None)
    code = str(dept["code"]) if dept else "GEN"
    return f"GRV-{code}-{grievance_id:05d}"


def _upload_file(file: Optional[UploadFile]) -> tuple[Optional[str], Optional[str]]:
    if not file:
        return None, None

    filename = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{secrets.token_hex(8)}_{file.filename or 'attachment'}"
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"

    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()
    if cloud_name and api_key and api_secret:
        try:
            result = cloudinary.uploader.upload(
                file.file,
                resource_type="auto",
                folder="grievance_system",
            )
            return result.get("secure_url"), content_type
        except Exception:
            file.file.seek(0)

    target = Path(UPLOAD_DIR) / filename
    with target.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return f"{BACKEND_URL}/uploads/{target.name}", content_type


def _send_sms(phone: Optional[str], message: str) -> bool:
    sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    from_number = os.getenv("TWILIO_PHONE_NUMBER", "").strip()
    if not (phone and sid and token and from_number):
        return False
    try:
        from twilio.rest import Client
        client = Client(sid, token)
        client.messages.create(body=message[:1500], from_=from_number, to=phone)
        return True
    except Exception as e:
        print("Twilio SMS Error:", e)
        return False


def _create_notification(db: Session, user_id: int, grievance_id: Optional[int], message: str, channel: str = "sms", status: str = "sent") -> Notification:
    notification = Notification(
        user_id=user_id,
        grievance_id=grievance_id,
        channel=channel,
        message=message,
        status=status,
    )
    db.add(notification)
    db.flush()
    return notification


def _notify_user(db: Session, user: User, grievance: Grievance, message: str) -> None:
    sent = _send_sms(user.phone, message)
    _create_notification(db, user.id, grievance.id, message, status="sent" if sent else "queued")


def _auto_assign_officer(db: Session, department: str) -> Optional[User]:
    officer = db.query(User).filter(User.role == UserRole.officer.value, User.department == department).first()
    if officer:
        return officer
    return db.query(User).filter(User.role == UserRole.officer.value).order_by(User.id.asc()).first()


@api_router.get("/departments")
def departments() -> Dict[str, object]:
    return {"departments": get_department_catalog()}


@api_router.post("/auth/register", response_model=TokenResponse)
def register(payload: RegisterPayload, db: Session = Depends(get_db)):
    existing = _find_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    phone = (payload.phone or "").strip()

    if phone and not phone.startswith("+91"):
        phone = "+91" + phone

    user = User(
        name=payload.name.strip(),
        email=str(payload.email).lower(),
        phone=phone or None,
        password_hash=hash_password(payload.password),
        role=UserRole.user.value,
        department=None,
    )

    db.add(user)
    db.flush()
    token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email, "name": user.name})
    db.commit()
    return {"access_token": token, "user": _serialize_user(user)}


@api_router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    user = _find_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    expected_role = payload.role.strip().lower()
    if expected_role not in {UserRole.user.value, UserRole.officer.value, UserRole.admin.value}:
        raise HTTPException(status_code=400, detail="Invalid role")
    if user.role != expected_role:
        raise HTTPException(status_code=403, detail=f"This account is registered as {user.role}")

    token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email, "name": user.name})
    return {"access_token": token, "user": _serialize_user(user)}


@api_router.get("/auth/me")
def me(current_user: User = Depends(get_current_user)):
    return {"user": _serialize_user(current_user)}


@api_router.post("/ai/preview")
def ai_preview(payload: PreviewRequest):
    complaint = f"{payload.title}. {payload.description}. {payload.location or ''}".strip()
    result = classify_grievance(complaint, title=payload.title, location=payload.location or "")
    return {"preview": result}


@api_router.post("/grievances")
async def create_grievance(
    title: str = Form(...),
    description: str = Form(...),
    location: str = Form(""),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    force_submit: Optional[bool] = Form(False),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_role(current_user, [UserRole.user.value])

    ai = classify_grievance(description, title=title, location=location)
    attachment_url, attachment_type = _upload_file(file)

    grievance = Grievance(
        grievance_code="TEMP",
        user_id=current_user.id,
        title=title.strip(),
        description=description.strip(),
        location=location.strip() or None,
        latitude=latitude,
        longitude=longitude,
        category=str(ai["category"]),
        department=str(ai["department"]),
        priority=str(ai["priority"]),
        sentiment=str(ai["sentiment"]),
        status=GrievanceStatus.submitted.value,
        attachment_url=attachment_url,
        attachment_type=attachment_type,
        ai_summary=str(ai["summary"]),
        ai_reason=str(ai["reason"]),
        suggested_action=str(ai["suggested_action"]),
        confidence=float(ai["confidence"]),
        citizen_phone=current_user.phone,
        citizen_email=current_user.email,
    )
    db.add(grievance)
    db.flush()
    grievance.grievance_code = _generate_grievance_code(db, grievance.id, grievance.department)

    duplicate_grievances = db.query(Grievance).order_by(desc(Grievance.id)).limit(250).all()
    duplicate_match = best_duplicate_match(f"{title}. {description}. {location}", [
        {
            "id": g.id,
            "grievance_code": g.grievance_code,
            "title": g.title,
            "description": g.description,
            "location": g.location or "",
        }
        for g in duplicate_grievances if g.id != grievance.id
    ])
    if duplicate_match:
        grievance.duplicate_score = float(duplicate_match["score"])
        grievance.duplicate_of_id = int(duplicate_match["id"])

    #####
    if (
        duplicate_match
        and duplicate_match["score"] > 0.85
        and not force_submit
    ):
        return {
            "duplicate_detected": True,
            "similarity": round(duplicate_match["score"] * 100, 2),
            "existing_grievance_id": duplicate_match["id"],
            "grievance_code": duplicate_match["grievance_code"],
            "message": "Similar grievance already exists"
        }
    
    #####

    officer = _auto_assign_officer(db, grievance.department)
    if officer:
        grievance.officer_id = officer.id
        grievance.status = GrievanceStatus.assigned.value

    db.commit()
    db.refresh(grievance)

    confirmation = f"Your grievance {grievance.grievance_code} has been registered under {grievance.department}. Priority: {grievance.priority}."
    _notify_user(db, current_user, grievance, confirmation)
    db.commit()

    return {
        "message": "Grievance submitted successfully",
        "grievance": _serialize_grievance(grievance),
        "ai_preview": ai,
        "duplicate_match": duplicate_match,
    }


@api_router.get("/grievances/my")
def my_grievances(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_role(current_user, [UserRole.user.value])
    items = (
        db.query(Grievance)
        .filter(Grievance.user_id == current_user.id)
        .order_by(desc(Grievance.id))
        .all()
    )
    return {"items": [_serialize_grievance(g) for g in items]}


@api_router.get("/officer/grievances")
def officer_grievances(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_role(current_user, [UserRole.officer.value])
    query = db.query(Grievance).order_by(desc(Grievance.id))
    if current_user.department:
        query = query.filter(Grievance.department == current_user.department)
    items = query.all()
    return {"items": [_serialize_grievance(g) for g in items]}


@api_router.patch("/officer/grievances/{grievance_id}")
def update_grievance_status(
    grievance_id: int,
    payload: StatusUpdatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_role(current_user, [UserRole.officer.value])
    grievance = db.query(Grievance).filter(Grievance.id == grievance_id).first()
    if not grievance:
        raise HTTPException(status_code=404, detail="Grievance not found")
    if current_user.department and grievance.department != current_user.department:
        raise HTTPException(status_code=403, detail="You cannot edit grievances outside your department")

    valid_statuses = {s.value for s in GrievanceStatus}
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")

    grievance.status = payload.status
    grievance.officer_remarks = (payload.officer_remarks or "").strip() or grievance.officer_remarks
    if payload.status == GrievanceStatus.resolved.value:
        grievance.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(grievance)

    citizen = grievance.creator
    if citizen:
        message = f"Your grievance {grievance.grievance_code} is now {grievance.status}. Officer note: {grievance.officer_remarks or 'No remarks'}"
        _notify_user(db, citizen, grievance, message)
        db.commit()

    return {"message": "Grievance updated", "grievance": _serialize_grievance(grievance)}


@api_router.get("/notifications/my")
def my_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(desc(Notification.id))
        .limit(30)
        .all()
    )
    return {"items": [_serialize_notification(n) for n in items]}


@api_router.get("/dashboard/user")
def user_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_role(current_user, [UserRole.user.value])
    total = db.query(Grievance).filter(Grievance.user_id == current_user.id).count()
    resolved = db.query(Grievance).filter(Grievance.user_id == current_user.id, Grievance.status == GrievanceStatus.resolved.value).count()
    open_count = db.query(Grievance).filter(
        Grievance.user_id == current_user.id,
        Grievance.status.in_([GrievanceStatus.submitted.value, GrievanceStatus.assigned.value, GrievanceStatus.in_review.value, GrievanceStatus.action_taken.value]),
    ).count()
    urgent = db.query(Grievance).filter(Grievance.user_id == current_user.id, Grievance.priority.in_(["High", "Critical"])).count()
    notifications = db.query(Notification).filter(Notification.user_id == current_user.id).count()
    by_status = [
        {"name": "Submitted", "value": db.query(Grievance).filter(Grievance.user_id == current_user.id, Grievance.status == GrievanceStatus.submitted.value).count()},
        {"name": "Assigned", "value": db.query(Grievance).filter(Grievance.user_id == current_user.id, Grievance.status == GrievanceStatus.assigned.value).count()},
        {"name": "In Review", "value": db.query(Grievance).filter(Grievance.user_id == current_user.id, Grievance.status == GrievanceStatus.in_review.value).count()},
        {"name": "Resolved", "value": resolved},
    ]
    return {
        "user": _serialize_user(current_user),
        "total": total,
        "open": open_count,
        "resolved": resolved,
        "urgent": urgent,
        "notifications": notifications,
        "by_status": by_status,
    }


@api_router.get("/dashboard/officer")
def officer_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_role(current_user, [UserRole.officer.value])
    query = db.query(Grievance)
    if current_user.department:
        query = query.filter(Grievance.department == current_user.department)
    total = query.count()
    pending = query.filter(Grievance.status.in_([GrievanceStatus.submitted.value, GrievanceStatus.assigned.value, GrievanceStatus.in_review.value, GrievanceStatus.action_taken.value])).count()
    resolved = query.filter(Grievance.status == GrievanceStatus.resolved.value).count()
    urgent = query.filter(Grievance.priority == "Critical").count()
    by_status = [
        {"name": "Submitted", "value": query.filter(Grievance.status == GrievanceStatus.submitted.value).count()},
        {"name": "Assigned", "value": query.filter(Grievance.status == GrievanceStatus.assigned.value).count()},
        {"name": "In Review", "value": query.filter(Grievance.status == GrievanceStatus.in_review.value).count()},
        {"name": "Action Taken", "value": query.filter(Grievance.status == GrievanceStatus.action_taken.value).count()},
        {"name": "Resolved", "value": resolved},
    ]
    by_priority = [
        {"name": "Low", "value": query.filter(Grievance.priority == "Low").count()},
        {"name": "Medium", "value": query.filter(Grievance.priority == "Medium").count()},
        {"name": "High", "value": query.filter(Grievance.priority == "High").count()},
        {"name": "Critical", "value": query.filter(Grievance.priority == "Critical").count()},
    ]
    return {
        "officer": _serialize_user(current_user),
        "total": total,
        "pending": pending,
        "resolved": resolved,
        "urgent": urgent,
        "by_status": by_status,
        "by_priority": by_priority,
    }


@api_router.get("/dashboard/admin")
def admin_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_role(current_user, [UserRole.admin.value])
    total_users = db.query(User).filter(User.role == UserRole.user.value).count()
    total_officers = db.query(User).filter(User.role == UserRole.officer.value).count()
    total_grievances = db.query(Grievance).count()
    resolved = db.query(Grievance).filter(Grievance.status == GrievanceStatus.resolved.value).count()
    departments = []
    for dept in get_department_catalog():
        dept_name = str(dept["name"])
        count = db.query(Grievance).filter(Grievance.department == dept_name).count()
        officer = db.query(User).filter(User.role == UserRole.officer.value, User.department == dept_name).first()
        departments.append({
            "name": dept_name,
            "code": dept["code"],
            "grievances": count,
            "officer": officer.name if officer else None,
            "officer_email": officer.email if officer else None,
        })
    officers = db.query(User).filter(User.role == UserRole.officer.value).order_by(User.department.asc()).all()
    return {
        "total_users": total_users,
        "total_officers": total_officers,
        "total_grievances": total_grievances,
        "resolved": resolved,
        "departments": departments,
        "officers": [_serialize_user(o) for o in officers],
    }


@api_router.get("/admin/officers")
def list_officers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_role(current_user, [UserRole.admin.value])
    officers = db.query(User).filter(User.role == UserRole.officer.value).order_by(User.department.asc(), User.name.asc()).all()
    return {"items": [_serialize_user(o) for o in officers]}


@api_router.post("/admin/officers")
def create_officer(payload: OfficerCreatePayload, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_role(current_user, [UserRole.admin.value])
    if _find_user_by_email(db, str(payload.email)):
        raise HTTPException(status_code=400, detail="Officer email already exists")
    password = payload.password or LOCAL_DEFAULT_OFFICER_PASSWORD
    officer = User(
        name=payload.name.strip(),
        email=str(payload.email).lower(),
        phone=(payload.phone or "").strip() or None,
        password_hash=hash_password(password),
        role=UserRole.officer.value,
        department=payload.department.strip(),
    )
    db.add(officer)
    db.commit()
    db.refresh(officer)
    return {"message": "Officer created", "officer": _serialize_user(officer), "password": password}


@api_router.get("/debug/grievances")
def debug_grievances(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_role(current_user, [UserRole.admin.value])
    items = db.query(Grievance).order_by(desc(Grievance.id)).limit(200).all()
    return {"items": [_serialize_grievance(g) for g in items]}
