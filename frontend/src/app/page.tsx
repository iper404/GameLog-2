type Game = {
  id: number;
  title: string;
  platform: string;
  status: string;
  hours_played: number;
  started_on: string | null;

  cover_art_url: string | null;
  completion_percent: number; // 0..100
  is_current: boolean;
};

function ProgressBar({ percent }: { percent: number }) {
  const safe = Math.max(0, Math.min(100, percent));
  const remaining = 100 - safe;

  return (
    <div className="w-full h-4 rounded overflow-hidden flex border border-white/10">
      {/* Completed (green, left) */}
      <div style={{ width: `${safe}%` }} className="h-full bg-green-500" />

      {/* Remaining (red, right) */}
      <div style={{ width: `${remaining}%` }} className="h-full bg-red-500" />
    </div>
  );
}

export default async function Home() {
  const res = await fetch("http://127.0.0.1:8000/games/current", {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">GameLog 2.0</h1>
          <p className="mt-3 text-white/70">
            No current game found. (Backend returned {res.status})
          </p>
        </div>
      </main>
    );
  }

  const game: Game = await res.json();

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-zinc-50">
      {/* Big centered object */}
      <div className="w-full max-w-md">
        <div className="rounded-2xl overflow-hidden bg-zinc-900/60 border border-white/10 shadow-lg">
          {/* Cover art */}
          <div className="relative">
            {/* Using <img> for simplicity (Next/Image config comes later) */}
            <img
              src={game.cover_art_url ?? ""}
              alt={`${game.title} cover art`}
              className="w-full aspect-[3/4] object-cover"
            />
            {/* Title overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="text-xl font-bold">{game.title}</div>
              <div className="text-sm text-white/70">
                {game.platform} • {game.status} • {game.hours_played} hrs
              </div>
            </div>
          </div>

          {/* Progress area */}
          <div className="p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-white/70">Completion</span>
              <span className="font-semibold">{game.completion_percent}%</span>
            </div>

            <ProgressBar percent={game.completion_percent} />

            <div className="mt-2 text-xs text-white/50">
              Green = completed • Red = remaining
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
