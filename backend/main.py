from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime, timezone

app = FastAPI()

# Allow the Next.js frontend to call the API from localhost:3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Models
# ----------------------------
class Game(BaseModel):
    id: int
    title: str
    platform: str
    status: str  # "playing", "backlog", "completed"
    hours_played: float = 0

    # For computing completion automatically:
    # Example: if estimated_hours=40 and hours_played=20 -> 50%
    estimated_hours: float = 40

    completion_percent: int = Field(0, ge=0, le=100)
    cover_art_url: Optional[str] = None
    is_current: bool = False
    started_on: Optional[date] = None
    last_now_playing_at: Optional[datetime] = None



class GameUpdate(BaseModel):
    # Use add_hours for "I just played 2.5 hours"
    add_hours: Optional[float] = None

    # Or set an absolute value if you want later
    hours_played: Optional[float] = None

    # If true, make this the main "Now Playing" game
    is_current: Optional[bool] = None

    # Optional status changes
    status: Optional[str] = None


def recalc_completion(game: Game) -> None:
    """Recalculate completion_percent based on hours_played / estimated_hours."""
    if game.estimated_hours <= 0:
        game.completion_percent = 0
        return

    percent = round((game.hours_played / game.estimated_hours) * 100)
    game.completion_percent = max(0, min(100, percent))


def set_current_game(game_id: int) -> Game:
    target = next((g for g in GAMES if g.id == game_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Game not found")

    for g in GAMES:
        g.is_current = False

    target.is_current = True
    target.status = "playing"

    # Stamp recency (used for backlog ordering)
    target.last_now_playing_at = datetime.now(timezone.utc)

    return target



# ----------------------------
# Temporary in-memory data
# ----------------------------
GAMES: List[Game] = [
    Game(
        id=1,
        title="Elden Ring",
        platform="PC",
        status="playing",
        hours_played=22,
        estimated_hours=40,
        cover_art_url="https://upload.wikimedia.org/wikipedia/en/b/b9/Elden_Ring_Box_art.jpg",
        is_current=True,
        last_now_playing_at=datetime.now(timezone.utc),
    ),
    Game(
        id=2,
        title="Final Fantasy XIV",
        platform="PC",
        status="backlog",
        hours_played=0,
        estimated_hours=200,
        cover_art_url="https://art.gametdb.com/ps3/coverHQ/US/BLUS30611.jpg?1404335232",
    ),
    Game(
        id=3,
        title="Persona 3 Reload",
        platform="PS5",
        status="backlog",
        hours_played=0,
        estimated_hours=70,
        cover_art_url="https://art.gametdb.com/switch/coverHQ/US/A4TPA.jpg?1712259737",
    ),
]

# Initialize completion for all games on boot
for g in GAMES:
    recalc_completion(g)


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
        # fallback: pick first "playing" if none marked current
        current = next((g for g in GAMES if g.status == "playing"), None)

    if not current:
        raise HTTPException(status_code=404, detail="No current game set")

    return current


@app.patch("/games/{game_id}", response_model=Game)
def update_game(game_id: int, update: GameUpdate):
    game = next((g for g in GAMES if g.id == game_id), None)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Set as now playing
    if update.is_current is True:
        game = set_current_game(game_id)

    # Update hours
    if update.hours_played is not None:
        if update.hours_played < 0:
            raise HTTPException(status_code=400, detail="hours_played cannot be negative")
        game.hours_played = update.hours_played

    if update.add_hours is not None:
        if update.add_hours < 0:
            raise HTTPException(status_code=400, detail="add_hours cannot be negative")
        game.hours_played += update.add_hours

    # Optional status update
    if update.status is not None:
        game.status = update.status

    # Recompute completion after any hours change
    recalc_completion(game)
    return game
