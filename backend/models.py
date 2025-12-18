from typing import Optional
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class GameDB(SQLModel, table=True):
    """
    Database table.
    owner_id ties every row to a Supabase user (JWT sub).
    """
    __tablename__ = "games"

    id: Optional[int] = Field(default=None, primary_key=True)

    owner_id: str = Field(index=True)

    title: str
    platform: str
    status: str = "backlog"

    cover_art_url: Optional[str] = None

    hours_played: float = 0
    estimated_hours: float = 40

    completion_percent: int = 0

    is_current: bool = False
    last_now_playing_at: Optional[datetime] = Field(default=None, index=True)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
