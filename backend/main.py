from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date

app = FastAPI()

# ----------------------------
# Data model (Game object)
# ----------------------------
class Game(BaseModel):
    id: int
    title: str
    platform: str
    status: str  # "playing", "backlog", "completed", etc.
    hours_played: float
    started_on: Optional[date] = None

    # NEW fields for your "big centered card"
    cover_art_url: Optional[str] = None

    # 0 to 100. Field(...) enforces bounds.
    completion_percent: int = Field(0, ge=0, le=100)

    # Marks which game is the "main" one
    is_current: bool = False


# ----------------------------
# Temporary in-memory "database"
# ----------------------------
GAMES: List[Game] = [
    Game(
        id=1,
        title="Elden Ring",
        platform="PC",
        status="playing",
        hours_played=42.5,
        started_on=date(2025, 12, 1),
        cover_art_url="https://upload.wikimedia.org/wikipedia/en/b/b9/Elden_Ring_Box_art.jpg",
        completion_percent=55,
        is_current=True,
    ),
    Game(
        id=2,
        title="Final Fantasy XIV",
        platform="PC",
        status="backlog",
        hours_played=0,
        cover_art_url="https://upload.wikimedia.org/wikipedia/en/5/5d/FFXIV_ARR_Cover_Art.jpg",
        completion_percent=0,
        is_current=False,
    ),
]

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/games", response_model=List[Game])
def get_games():
    return GAMES

@app.get("/games/current", response_model=Game)
def get_current_game():
    current = next((g for g in GAMES if g.is_current), None)
    if not current:
        raise HTTPException(status_code=404, detail="No current game set")
    return current

@app.post("/games", response_model=Game)
def add_game(game: Game):
    if any(g.id == game.id for g in GAMES):
        raise HTTPException(status_code=400, detail="Game with this id already exists")
    GAMES.append(game)
    return game
