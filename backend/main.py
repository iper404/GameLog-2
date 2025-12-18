from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, select, Session

from db import engine, get_session
from models import GameDB
from schemas import GameCreate, GameUpdate, GameRead
from auth import get_user_id


app = FastAPI()

import os

origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.on_event("startup")
def on_startup():
    # For now we auto-create tables. Later we’ll switch to Alembic migrations.
    SQLModel.metadata.create_all(engine)


def recalc_completion(game: GameDB) -> None:
    """Compute completion_percent from hours_played / estimated_hours."""
    if game.estimated_hours <= 0:
        game.completion_percent = 0
        return
    pct = round((game.hours_played / game.estimated_hours) * 100)
    game.completion_percent = max(0, min(100, pct))


def make_now_playing(session: Session, owner_id: str, game: GameDB) -> None:
    """Ensure only ONE now-playing game per user."""
    # unset current for this user
    others = session.exec(
        select(GameDB).where(GameDB.owner_id == owner_id, GameDB.is_current == True)
    ).all()

    for g in others:
        g.is_current = False
        g.updated_at = datetime.now(timezone.utc)
        session.add(g)

    # set target current
    game.is_current = True
    game.status = "playing"
    game.last_now_playing_at = datetime.now(timezone.utc)
    game.updated_at = datetime.now(timezone.utc)
    session.add(game)


@app.get("/health")
def health():
    return {"status": "ok"}


# ✅ GET /games returns only your games
@app.get("/games", response_model=List[GameRead])
def get_games(
    user_id: str = Depends(get_user_id),
    session: Session = Depends(get_session),
):
    statement = (
        select(GameDB)
        .where(GameDB.owner_id == user_id)
        .order_by(
            GameDB.is_current.desc(),
            GameDB.last_now_playing_at.desc().nullslast(),
            GameDB.id.desc(),
        )
    )
    games = session.exec(statement).all()
    return games


@app.get("/games/current", response_model=GameRead)
def get_current_game(
    user_id: str = Depends(get_user_id),
    session: Session = Depends(get_session),
):
    current = session.exec(
        select(GameDB).where(GameDB.owner_id == user_id, GameDB.is_current == True)
    ).first()

    if current:
        return current

    # fallback: most recent last_now_playing
    fallback = session.exec(
        select(GameDB)
        .where(GameDB.owner_id == user_id)
        .order_by(GameDB.last_now_playing_at.desc().nullslast(), GameDB.id.desc())
    ).first()

    if not fallback:
        raise HTTPException(status_code=404, detail="No games found for this user")

    return fallback


# ✅ POST /games creates under your user
@app.post("/games", response_model=GameRead)
def create_game(
    payload: GameCreate,
    user_id: str = Depends(get_user_id),
    session: Session = Depends(get_session),
):
    game = GameDB(
        owner_id=user_id,
        title=payload.title,
        platform=payload.platform,
        status=payload.status,
        cover_art_url=payload.cover_art_url,
        hours_played=0,
        estimated_hours=payload.estimated_hours,
        completion_percent=0,
        is_current=False,
        last_now_playing_at=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    recalc_completion(game)
    session.add(game)
    session.commit()
    session.refresh(game)
    return game


# ✅ PATCH only works on your own games
@app.patch("/games/{game_id}", response_model=GameRead)
def update_game(
    game_id: int,
    update: GameUpdate,
    user_id: str = Depends(get_user_id),
    session: Session = Depends(get_session),
):
    game = session.exec(
        select(GameDB).where(GameDB.id == game_id, GameDB.owner_id == user_id)
    ).first()

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # metadata edits
    if update.title is not None:
        game.title = update.title
    if update.platform is not None:
        game.platform = update.platform
    if update.cover_art_url is not None:
        game.cover_art_url = update.cover_art_url

    # status
    if update.status is not None:
        game.status = update.status

    # hours changes
    if update.hours_played is not None:
        if update.hours_played < 0:
            raise HTTPException(status_code=400, detail="hours_played cannot be negative")
        game.hours_played = update.hours_played

    if update.add_hours is not None:
        if update.add_hours < 0:
            raise HTTPException(status_code=400, detail="add_hours cannot be negative")
        game.hours_played += update.add_hours

    # estimated length changes
    if update.estimated_hours is not None:
        if update.estimated_hours <= 0:
            raise HTTPException(status_code=400, detail="estimated_hours must be > 0")
        game.estimated_hours = update.estimated_hours

    # set now playing
    if update.is_current is True:
        make_now_playing(session, user_id, game)

    # always recalc + update timestamp
    recalc_completion(game)
    game.updated_at = datetime.now(timezone.utc)

    session.add(game)
    session.commit()
    session.refresh(game)
    return game


# ✅ DELETE only works on your own games
@app.delete("/games/{game_id}")
def delete_game(
    game_id: int,
    user_id: str = Depends(get_user_id),
    session: Session = Depends(get_session),
):
    game = session.exec(
        select(GameDB).where(GameDB.id == game_id, GameDB.owner_id == user_id)
    ).first()

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    was_current = game.is_current

    session.delete(game)
    session.commit()

    # If we deleted the current game, choose the most recent remaining one as current
    if was_current:
        replacement = session.exec(
            select(GameDB)
            .where(GameDB.owner_id == user_id)
            .order_by(GameDB.last_now_playing_at.desc().nullslast(), GameDB.id.desc())
        ).first()

        if replacement:
            make_now_playing(session, user_id, replacement)
            session.commit()

    return {"deleted": game_id}
