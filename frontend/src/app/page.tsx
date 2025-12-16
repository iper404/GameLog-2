"use client";

import { useEffect, useMemo, useState } from "react";

type Game = {
  id: number;
  title: string;
  platform: string;
  status: string;
  hours_played: number;
  estimated_hours: number;
  completion_percent: number;
  cover_art_url: string | null;
  is_current: boolean;

  // NEW: used for backlog ordering (ISO string or null)
  last_now_playing_at: string | null;
};

const API = "http://127.0.0.1:8000";

function ProgressBar({
  percent,
  heightClass = "h-4",
}: {
  percent: number;
  heightClass?: string;
}) {
  const safe = Math.max(0, Math.min(100, percent));
  const remaining = 100 - safe;

  return (
    <div className={`w-full ${heightClass} rounded overflow-hidden flex border border-white/10`}>
      <div style={{ width: `${safe}%` }} className="h-full bg-green-500" />
      <div style={{ width: `${remaining}%` }} className="h-full bg-red-500" />
    </div>
  );
}

function Modal({
  game,
  onClose,
  onSetNowPlaying,
  onAddHours,
  loading,
}: {
  game: Game;
  onClose: () => void;
  onSetNowPlaying: () => void;
  onAddHours: (hoursToAdd: number) => void;
  loading: boolean;
}) {
  const [hours, setHours] = useState<string>("1");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-white/10 p-4">
        <div className="flex items-start gap-3">
          <img
            src={game.cover_art_url ?? ""}
            alt={`${game.title} cover`}
            className="w-20 h-28 object-cover rounded-lg border border-white/10"
          />
          <div className="flex-1">
            <div className="text-lg font-bold">{game.title}</div>
            <div className="text-sm text-white/70">
              {game.platform} • {game.status}
            </div>
            <div className="text-sm text-white/70 mt-1">
              {game.hours_played.toFixed(1)} hrs • {game.completion_percent}%
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <button
            className="w-full rounded-xl bg-white text-black py-2 font-semibold disabled:opacity-50"
            onClick={onSetNowPlaying}
            disabled={loading}
          >
            Set as Now Playing
          </button>

          <div className="rounded-xl border border-white/10 p-3">
            <div className="text-sm font-semibold mb-2">Add hours played</div>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.5"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="flex-1 rounded-lg bg-zinc-950 border border-white/10 px-3 py-2"
              />
              <button
                className="rounded-lg bg-green-600 px-4 py-2 font-semibold disabled:opacity-50"
                onClick={() => onAddHours(Number(hours))}
                disabled={loading || Number(hours) <= 0 || Number.isNaN(Number(hours))}
              >
                Add
              </button>
            </div>
            <div className="text-xs text-white/50 mt-2">
              Completion updates automatically from hours / estimated hours.
            </div>
          </div>

          <button
            className="w-full rounded-xl border border-white/10 py-2 text-white/80"
            onClick={onClose}
            disabled={loading}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [selected, setSelected] = useState<Game | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const res = await fetch(`${API}/games`, { cache: "no-store" });
    const data: Game[] = await res.json();
    setGames(data);
  }

  useEffect(() => {
    refresh();
  }, []);

  const currentGame = useMemo(() => {
    return games.find((g) => g.is_current) ?? null;
  }, [games]);

  // ✅ Sort backlog by "most recently was Now Playing"
  const backlog = useMemo(() => {
    const notCurrent = games.filter((g) => !g.is_current);

    return notCurrent.sort((a, b) => {
      const aTime = a.last_now_playing_at ? Date.parse(a.last_now_playing_at) : 0;
      const bTime = b.last_now_playing_at ? Date.parse(b.last_now_playing_at) : 0;
      return bTime - aTime; // newest first
    });
  }, [games]);

  async function setNowPlaying(game: Game) {
    setLoading(true);
    try {
      await fetch(`${API}/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_current: true }),
      });
      await refresh();
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  async function addHours(game: Game, hoursToAdd: number) {
    setLoading(true);
    try {
      await fetch(`${API}/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add_hours: hoursToAdd }),
      });
      await refresh();
      // keep modal open; selected will be close-enough after refresh
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      {/* ✅ Centered header, title only */}
      <header className="w-full px-6 py-4 border-b border-white/10">
        <div className="max-w-5xl mx-auto text-center">
          <div className="text-2xl font-bold">GameLog</div>
        </div>
      </header>

      {/* Main Now Playing area */}
      <section className="flex-1 flex items-center justify-center p-6">
        {!currentGame ? (
          <div className="text-white/70">No “Now Playing” game set yet.</div>
        ) : (
          <div className="w-full max-w-md">
            <div className="rounded-2xl overflow-hidden bg-zinc-900/60 border border-white/10 shadow-lg">
              <button
                className="relative w-full text-left"
                onClick={() => setSelected(currentGame)}
                title="Click to manage this game"
              >
                <img
                  src={currentGame.cover_art_url ?? ""}
                  alt={`${currentGame.title} cover`}
                  className="w-full aspect-[3/4] object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="text-xl font-bold">{currentGame.title}</div>
                  <div className="text-sm text-white/70">
                    {currentGame.platform} • {currentGame.status} •{" "}
                    {currentGame.hours_played.toFixed(1)} hrs
                  </div>
                </div>
              </button>

              <div className="p-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-white/70">Completion</span>
                  <span className="font-semibold">
                    {currentGame.completion_percent}%
                  </span>
                </div>
                <ProgressBar percent={currentGame.completion_percent} />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ✅ Centered footer + backlog sorted by recent "now playing" */}
      <footer className="border-t border-white/10 p-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="font-semibold">Backlog Queue</div>
          <div className="text-sm text-white/60 mt-1">{backlog.length} games</div>
        </div>

        {/* Scroll container */}
        <div className="mt-4 overflow-x-auto">
          {/* Inner row centers when it fits; becomes scrollable when it doesn't */}
          <div className="w-max mx-auto flex gap-4 pb-2 px-2">
            {backlog.map((g) => (
              <button
                key={g.id}
                className="shrink-0 w-28 text-left"
                onClick={() => setSelected(g)}
                title="Click to manage"
              >
                <img
                  src={g.cover_art_url ?? ""}
                  alt={`${g.title} cover`}
                  className="w-28 h-40 object-cover rounded-xl border border-white/10"
                />

                <div className="mt-2 text-xs text-white/80 line-clamp-2">
                  {g.title}
                </div>

                {/* ✅ Progress bar + percent under backlog games */}
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-white/60 mb-1">
                    <span>Progress</span>
                    <span className="text-white/80">{g.completion_percent}%</span>
                  </div>
                  <ProgressBar percent={g.completion_percent} heightClass="h-2" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </footer>

      {selected && (
        <Modal
          game={selected}
          loading={loading}
          onClose={() => setSelected(null)}
          onSetNowPlaying={() => setNowPlaying(selected)}
          onAddHours={(h) => addHours(selected, h)}
        />
      )}
    </main>
  );
}
