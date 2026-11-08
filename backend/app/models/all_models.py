import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    is_guest: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    session_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    documents: Mapped[List["Document"]] = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    dungeons: Mapped[List["Dungeon"]] = relationship("Dungeon", back_populates="user", cascade="all, delete-orphan")
    runs: Mapped[List["GameRun"]] = relationship("GameRun", back_populates="user", cascade="all, delete-orphan")
    attempts: Mapped[List["Attempt"]] = relationship("Attempt", back_populates="user", cascade="all, delete-orphan")
    review_items: Mapped[List["ReviewItem"]] = relationship("ReviewItem", back_populates="user", cascade="all, delete-orphan")
    progress: Mapped[Optional["UserProgress"]] = relationship("UserProgress", back_populates="user", uselist=False, cascade="all, delete-orphan")


class RateLimitRecord(Base):
    __tablename__ = "rate_limit_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    key: Mapped[str] = mapped_column(String(128), index=True, nullable=False)  # e.g., "login:203.0.113.195"
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True, nullable=False)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="processing")
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    relevance_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    readability_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="documents")
    chunks: Mapped[List["DocumentChunk"]] = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    topics: Mapped[List["Topic"]] = relationship("Topic", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    slide_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    source_meta: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    document: Mapped["Document"] = relationship("Document", back_populates="chunks")
    questions: Mapped[List["Question"]] = relationship("Question", back_populates="source_chunk")


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    document: Mapped["Document"] = relationship("Document", back_populates="topics")
    questions: Mapped[List["Question"]] = relationship("Question", back_populates="topic", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, index=True)
    source_chunk_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("document_chunks.id", ondelete="SET NULL"), nullable=True)
    question_type: Mapped[str] = mapped_column(String(20), default="mcq")
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list] = mapped_column(JSON, nullable=False)
    correct_option: Mapped[int] = mapped_column(Integer, nullable=False)
    evidence_quote: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    topic: Mapped["Topic"] = relationship("Topic", back_populates="questions")
    source_chunk: Mapped[Optional["DocumentChunk"]] = relationship("DocumentChunk", back_populates="questions")


class Dungeon(Base):
    __tablename__ = "dungeons"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    document_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    is_public_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="dungeons")
    rooms: Mapped[List["DungeonRoom"]] = relationship("DungeonRoom", back_populates="dungeon", cascade="all, delete-orphan")


class DungeonRoom(Base):
    __tablename__ = "dungeon_rooms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dungeon_id: Mapped[str] = mapped_column(String(36), ForeignKey("dungeons.id", ondelete="CASCADE"), nullable=False, index=True)
    topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    room_order: Mapped[int] = mapped_column(Integer, nullable=False)
    monster_type: Mapped[str] = mapped_column(String(64), nullable=False)
    monster_hp: Mapped[int] = mapped_column(Integer, nullable=False)

    dungeon: Mapped["Dungeon"] = relationship("Dungeon", back_populates="rooms")


class GameRun(Base):
    __tablename__ = "game_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    dungeon_id: Mapped[str] = mapped_column(String(36), ForeignKey("dungeons.id", ondelete="CASCADE"), nullable=False, index=True)
    current_hp: Mapped[int] = mapped_column(Integer, default=100)
    current_score: Mapped[int] = mapped_column(Integer, default=0)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    xp_earned: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="active")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="runs")
    attempts: Mapped[List["Attempt"]] = relationship("Attempt", back_populates="run", cascade="all, delete-orphan")


class Attempt(Base):
    __tablename__ = "attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("game_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id: Mapped[str] = mapped_column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    selected_option: Mapped[int] = mapped_column(Integer, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    damage_dealt: Mapped[int] = mapped_column(Integer, default=0)
    player_hp_snapshot: Mapped[int] = mapped_column(Integer, default=100)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="attempts")
    run: Mapped["GameRun"] = relationship("GameRun", back_populates="attempts")


class ReviewItem(Base):
    __tablename__ = "review_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id: Mapped[str] = mapped_column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    repetition: Mapped[int] = mapped_column(Integer, default=0)
    interval_days: Mapped[float] = mapped_column(Float, default=0.0)
    due_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    last_result: Mapped[str] = mapped_column(String(20), default="unseen")

    user: Mapped["User"] = relationship("User", back_populates="review_items")


class UserProgress(Base):
    __tablename__ = "user_progress"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    total_xp: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    coins: Mapped[int] = mapped_column(Integer, default=0)
    unlocked_weapons: Mapped[list] = mapped_column(JSON, default=lambda: ["Rusty Dagger"])
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="progress")
