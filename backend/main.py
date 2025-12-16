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

    estimated_hours: Optional[float] = None
    cover_art_url: Optional[str] = None  # optional, but handy
    title: Optional[str] = None          # optional, but handy
    platform: Optional[str] = None       # optional, but handy


class GameCreate(BaseModel):
    title: str
    platform: str
    cover_art_url: Optional[str] = None

    # optional inputs with sensible defaults
    status: str = "backlog"
    hours_played: float = 0
    estimated_hours: float = 40

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

def next_game_id() -> int:
    if not GAMES:
        return 1
    return max(g.id for g in GAMES) + 1




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

    # Update estimated game length
    if update.estimated_hours is not None:
        if update.estimated_hours <= 0:
            raise HTTPException(status_code=400, detail="estimated_hours must be > 0")
        game.estimated_hours = update.estimated_hours

    # Optional metadata edits
    if update.cover_art_url is not None:
        game.cover_art_url = update.cover_art_url

    if update.title is not None:
        game.title = update.title

    if update.platform is not None:
        game.platform = update.platform


    # Recompute completion after any hours change
    recalc_completion(game)
    return game

@app.post("/games", response_model=Game)
def create_game(payload: GameCreate):
    new_game = Game(
        id=next_game_id(),
        title=payload.title,
        platform=payload.platform,
        status=payload.status,
        hours_played=payload.hours_played,
        estimated_hours=payload.estimated_hours,
        cover_art_url=payload.cover_art_url,
        is_current=False,
        started_on=None,
        last_now_playing_at=None,
        completion_percent=0,
    )

    recalc_completion(new_game)
    GAMES.append(new_game)
    return new_game

@app.delete("/games/{game_id}")
def delete_game(game_id: int):
    idx = next((i for i, g in enumerate(GAMES) if g.id == game_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Game not found")

    was_current = GAMES[idx].is_current
    del GAMES[idx]

    # If we deleted the current game, pick a new one if any remain
    if was_current and GAMES:
        # choose the most recently "now playing" among remaining, else first game
        candidate = max(
            GAMES,
            key=lambda g: g.last_now_playing_at.timestamp() if g.last_now_playing_at else 0
        )
        set_current_game(candidate.id)

    return {"deleted": game_id}
