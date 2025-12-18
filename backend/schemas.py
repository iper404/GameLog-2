from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class GameCreate(BaseModel):
    title: str
    platform: str
    cover_art_url: Optional[str] = None

    status: str = "backlog"
    estimated_hours: float = 40


class GameUpdate(BaseModel):
    # progress controls
    add_hours: Optional[float] = None
    hours_played: Optional[float] = None
    estimated_hours: Optional[float] = None

    # state controls
    is_current: Optional[bool] = None
    status: Optional[str] = None

    # optional metadata edits
    title: Optional[str] = None
    platform: Optional[str] = None
    cover_art_url: Optional[str] = None


class GameRead(BaseModel):
    id: int
    title: str
    platform: str
    status: str

    cover_art_url: Optional[str] = None

    hours_played: float
    estimated_hours: float
    completion_percent: int

    is_current: bool
    last_now_playing_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime
