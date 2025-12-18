"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

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
  last_now_playing_at: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const HEADER_H = 64;

const PLATFORMS = [
  "PC",
  "PS5",
  "PS4",
  "Xbox Series X|S",
  "Xbox One",
  "Switch",
  "Switch 2",
  "Other",
] as const;

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

/**
 * Cover component that ALWAYS preserves layout space.
 * - If url exists: shows image
 * - If no url: shows dark placeholder with "?" icon
 */
function Cover({
  url,
  alt,
  className,
  imgClassName = "object-cover",
  style,
}: {
  url: string | null;
  alt: string;
  className: string;
  imgClassName?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>

      {url ? (
        <img
          src={url}
          alt={alt}
          className={`absolute inset-0 w-full h-full ${imgClassName}`}
        />
      ) : (
        <div className="absolute inset-0 bg-zinc-800 border border-white/10 flex items-center justify-center">
          <span className="text-3xl text-white/30 font-bold">?</span>
        </div>
      )}
    </div>
  );
}

function Modal({
  game,
  onClose,
  onSetNowPlaying,
  onAddHours,
  loading,
  onSaveEdits,
  onSaveMeta,
  onDelete,
}: {
  game: Game;
  onClose: () => void;
  onSetNowPlaying: () => void;
  onAddHours: (hoursToAdd: number) => void;
  loading: boolean;
  onSaveEdits: (payload: { hours_played: number; estimated_hours: number }) => void;
  onSaveMeta: (payload: { title: string; platform: string; cover_art_url: string | null }) => void;
  onDelete: () => void;
}) {
  const [hours, setHours] = useState<string>("1");

  // Edit progress / length
  const [editOpen, setEditOpen] = useState(false);
  const [hoursPlayed, setHoursPlayed] = useState<string>(String(game.hours_played ?? 0));
  const [estimatedHours, setEstimatedHours] = useState<string>(String(game.estimated_hours ?? 40));

  // Edit game info
  const [metaOpen, setMetaOpen] = useState(false);
  const [editTitle, setEditTitle] = useState<string>(game.title ?? "");
  const [editPlatform, setEditPlatform] = useState<string>(game.platform ?? "PC");
  const [editCoverArtUrl, setEditCoverArtUrl] = useState<string>(game.cover_art_url ?? "");

  useEffect(() => {
    // Reset modal-local state whenever you open a different game
    setHours("1");

    setEditOpen(false);
    setHoursPlayed(String(game.hours_played ?? 0));
    setEstimatedHours(String(game.estimated_hours ?? 40));

    setMetaOpen(false);
    setEditTitle(game.title ?? "");
    setEditPlatform(game.platform ?? "PC");
    setEditCoverArtUrl(game.cover_art_url ?? "");
  }, [game.id]);

  const canSaveProgress =
    !loading &&
    !Number.isNaN(Number(hoursPlayed)) &&
    Number(hoursPlayed) >= 0 &&
    !Number.isNaN(Number(estimatedHours)) &&
    Number(estimatedHours) > 0;

  const titleOk = editTitle.trim().length > 0;
  const platformOk = editPlatform.trim().length > 0;
  const canSaveMeta = !loading && titleOk && platformOk;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-white/10 p-4">
        <div className="flex items-start gap-3">
          <Cover
            url={game.cover_art_url}
            alt={`${game.title} cover`}
            className="w-20 h-28 rounded-lg border border-white/10"
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
            className="w-full rounded-xl bg-white text-black py-2 font-semibold disabled:opacity-50 cursor-pointer"
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
                className="rounded-lg bg-green-600 px-4 py-2 font-semibold disabled:opacity-50 cursor-pointer"
                onClick={() => onAddHours(Number(hours))}
                disabled={loading || Number(hours) <= 0 || Number.isNaN(Number(hours))}
              >
                Add
              </button>
            </div>
          </div>

          {/* Collapsible: Edit progress/length */}
          <div className="rounded-xl border border-white/10">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/5 rounded-xl"
              onClick={() => setEditOpen((v) => !v)}
            >
              <span className="text-sm font-semibold">Edit progress / length</span>
              <span className="text-white/60 text-sm">{editOpen ? "▲" : "▼"}</span>
            </button>

            {editOpen && (
              <div className="px-3 pb-3 pt-1 space-y-3">
                <div>
                  <label className="text-xs text-white/60">Hours played (absolute)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={hoursPlayed}
                    onChange={(e) => setHoursPlayed(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-white/10 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60">Estimated total hours</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-white/10 px-3 py-2"
                  />
                </div>

                <button
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold disabled:opacity-50 cursor-pointer"
                  disabled={!canSaveProgress}
                  onClick={() =>
                    onSaveEdits({
                      hours_played: Number(hoursPlayed),
                      estimated_hours: Number(estimatedHours),
                    })
                  }
                >
                  Save
                </button>

                <div className="text-xs text-white/50">Completion % recalculates automatically.</div>
              </div>
            )}
          </div>

          {/* Collapsible: Edit game info (NEW) */}
          <div className="rounded-xl border border-white/10">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/5 rounded-xl"
              onClick={() => setMetaOpen((v) => !v)}
            >
              <span className="text-sm font-semibold">Edit game info</span>
              <span className="text-white/60 text-sm">{metaOpen ? "▲" : "▼"}</span>
            </button>

            {metaOpen && (
              <div className="px-3 pb-3 pt-1 space-y-3">
                <div>
                  <label className="text-xs text-white/60">Game name</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-white/10 px-3 py-2"
                    placeholder="Game title"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60">Platform</label>
                  <select
                    value={editPlatform}
                    onChange={(e) => setEditPlatform(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-white/10 px-3 py-2 cursor-pointer"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-white/60">Cover art URL</label>
                  <input
                    value={editCoverArtUrl}
                    onChange={(e) => setEditCoverArtUrl(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-white/10 px-3 py-2"
                    placeholder="https://..."
                  />
                  <div className="text-[11px] text-white/45 mt-1">
                    Leave blank to clear cover art.
                  </div>
                </div>

                <button
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold disabled:opacity-50 cursor-pointer"
                  disabled={!canSaveMeta}
                  onClick={() =>
                    onSaveMeta({
                      title: editTitle.trim(),
                      platform: editPlatform,
                      cover_art_url: editCoverArtUrl.trim() ? editCoverArtUrl.trim() : null,
                    })
                  }
                >
                  Save
                </button>
              </div>
            )}
          </div>

          <button
            className="w-full rounded-xl border border-red-500/30 bg-red-500/10 py-2 text-red-200 cursor-pointer disabled:opacity-50"
            disabled={loading}
            onClick={() => {
              const ok = window.confirm(`Delete "${game.title}"? This cannot be undone.`);
              if (ok) onDelete();
            }}
          >
            Delete Game
          </button>

          <button
            className="w-full rounded-xl border border-white/10 py-2 text-white/80 cursor-pointer disabled:opacity-50"
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

function AddGameModal({
  onClose,
  onCreate,
  loading,
}: {
  onClose: () => void;
  onCreate: (payload: {
    title: string;
    platform: string;
    cover_art_url?: string | null;
    estimated_hours?: number;
  }) => void;
  loading: boolean;
}) {
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("PC");
  const [coverArtUrl, setCoverArtUrl] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("40");

  const canSubmit =
    title.trim().length > 0 && Number(estimatedHours) > 0 && !Number.isNaN(Number(estimatedHours));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-white/10 p-4">
        <div className="text-lg font-bold">Add Game</div>
        <div className="text-sm text-white/60 mt-1">Add a game to your backlog.</div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm text-white/70">Title</label>
            <input
              className="mt-1 w-full rounded-lg bg-zinc-950 border border-white/10 px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Elden Ring"
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Platform</label>
            <select
              className="mt-1 w-full rounded-lg bg-zinc-950 border border-white/10 px-3 py-2 cursor-pointer"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as any)}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-white/70">Cover Art URL (optional)</label>
            <input
              className="mt-1 w-full rounded-lg bg-zinc-950 border border-white/10 px-3 py-2"
              value={coverArtUrl}
              onChange={(e) => setCoverArtUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Game Length (Hrs)</label>
            <input
              type="number"
              min="1"
              className="mt-1 w-full rounded-lg bg-zinc-950 border border-white/10 px-3 py-2"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
            />
          </div>

          <button
            className="w-full rounded-xl bg-white text-black py-2 font-semibold disabled:opacity-50 cursor-pointer"
            disabled={!canSubmit || loading}
            onClick={() =>
              onCreate({
                title: title.trim(),
                platform,
                cover_art_url: coverArtUrl.trim() ? coverArtUrl.trim() : null,
                estimated_hours: Number(estimatedHours),
              })
            }
          >
            Create
          </button>

          <button
            className="w-full rounded-xl border border-white/10 py-2 text-white/80 cursor-pointer disabled:opacity-50"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
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
  const [addOpen, setAddOpen] = useState(false);

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const token = session?.access_token ?? null;

  // Auth bootstrap
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setAuthLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const apiJson = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      if (!token) throw new Error("Not authenticated");

      const url = path.startsWith("http")
        ? path
        : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);

      const res = await fetch(url, {
        ...init,
        headers,
        cache: init.cache ?? "no-store",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText} — ${text}`);
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        // @ts-expect-error allow void-ish
        return undefined;
      }
      return (await res.json()) as T;
    },
    [token]
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiJson<unknown>("/games");
      if (!Array.isArray(data)) {
        console.error("GET /games expected array, got:", data);
        setGames([]);
        return;
      }
      setGames(data as Game[]);
    } catch (e) {
      console.error("refresh failed:", e);
      setGames([]);
    }
  }, [apiJson, token]);

  useEffect(() => {
    if (!token) {
      setGames([]);
      return;
    }
    refresh();
  }, [token, refresh]);

  // CRUD
  async function createGame(payload: {
    title: string;
    platform: string;
    cover_art_url?: string | null;
    estimated_hours?: number;
  }) {
    setLoading(true);
    try {
      await apiJson("/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.title,
          platform: payload.platform,
          cover_art_url: payload.cover_art_url ?? null,
          estimated_hours: payload.estimated_hours ?? 40,
          status: "backlog",
        }),
      });
      await refresh();
      setAddOpen(false);
    } catch (e: any) {
      alert(`Create failed: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }

  async function setNowPlaying(game: Game) {
    setLoading(true);
    try {
      await apiJson(`/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_current: true }),
      });
      await refresh();
      setSelected(null);
    } catch (e: any) {
      alert(`Update failed: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }

  async function addHours(game: Game, hoursToAdd: number) {
    setLoading(true);
    try {
      await apiJson(`/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add_hours: hoursToAdd }),
      });
      await refresh();
    } catch (e: any) {
      alert(`Update failed: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveEdits(game: Game, payload: { hours_played: number; estimated_hours: number }) {
    setLoading(true);
    try {
      await apiJson(`/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await refresh();
      setSelected(null);
    } catch (e: any) {
      alert(`Save failed: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveMeta(game: Game, payload: { title: string; platform: string; cover_art_url: string | null }) {
    setLoading(true);
    try {
      await apiJson(`/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await refresh();
      setSelected(null);
    } catch (e: any) {
      alert(`Save failed: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteGame(game: Game) {
    setLoading(true);
    try {
      await apiJson(`/games/${game.id}`, { method: "DELETE" });
      await refresh();
      setSelected(null);
    } catch (e: any) {
      alert(`Delete failed: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }

  // Auth actions
  async function signUp() {
    // basic client-side validation (still rely on Supabase server validation too)
    if (!email.trim()) return alert("Email required.");
    if (password.length < 6) return alert("Password must be at least 6 characters.");

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      // ex: weak password, invalid email
      return alert(error.message);
    }

    // IMPORTANT: Supabase can return a user with empty identities when the email already exists
    const identities = (data.user as any)?.identities;
    if (data.user && Array.isArray(identities) && identities.length === 0) {
      return alert("An account with this email already exists. Please sign in instead.");
    }

    // If email confirmation is enabled, session is typically null here
    if (!data.session) {
      alert("Check your email to confirm your account (if confirmations are enabled).");
    }
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setGames([]);
  }

  // Derived
  const currentGame = useMemo(() => games.find((g) => g.is_current) ?? null, [games]);

  const backlog = useMemo(() => {
    const notCurrent = games.filter((g) => !g.is_current);
    return notCurrent.sort((a, b) => {
      const aTime = a.last_now_playing_at ? Date.parse(a.last_now_playing_at) : 0;
      const bTime = b.last_now_playing_at ? Date.parse(b.last_now_playing_at) : 0;
      return bTime - aTime;
    });
  }, [games]);

  // Auth/loading screens
  if (authLoading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-6">
        <div className="text-white/60">Loading…</div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <div className="text-xl font-bold">GameLog</div>
          <div className="text-sm text-white/60 mt-1">Sign in to save your games.</div>

          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-lg bg-zinc-950 border border-white/10 px-3 py-2"
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full rounded-lg bg-zinc-950 border border-white/10 px-3 py-2"
              placeholder="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") signIn();
              }}
            />

            <button className="w-full rounded-xl bg-white text-black py-2 font-semibold" onClick={signIn}>
              Sign in
            </button>
            <button className="w-full rounded-xl border border-white/10 py-2 text-white/80" onClick={signUp}>
              Sign up
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Main app
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <header
        className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/90 backdrop-blur"
        style={{ height: HEADER_H }}
      >
        <div className="h-full max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-3 items-center">

          <div className="justify-self-start text-xs text-white/60 truncate">
            {session.user.email ?? session.user.id}
          </div>

          <button
            className="text-xl sm:text-2xl font-bold cursor-pointer justify-self-center"
            onClick={() => window.location.reload()}
            title="Refresh"
          >
            GameLog
          </button>

          <div className="justify-self-end flex gap-2">
            <button
              className="justify-self-end rounded-xl border border-white/10
                        px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm
                        font-semibold whitespace-nowrap hover:bg-white/10 cursor-pointer"
              onClick={() => setAddOpen(true)}
              title="Add a game"
            >
              <span className="sm:hidden">+ Add</span>
              <span className="hidden sm:inline">+ Add Game</span>
          </button>


            <button
              className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/10 cursor-pointer"
              onClick={signOut}
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-4" style={{ minHeight: `calc(100vh - ${HEADER_H}px)` }}>
        <div className="flex flex-col items-center">
          {!currentGame ? (
            <div className="text-white/70 mt-10">No “Now Playing” game set yet.</div>
          ) : (
            <div className="w-full max-w-md">
              <div className="rounded-2xl overflow-hidden bg-zinc-900/60 border border-white/10 shadow-lg">
                <button
                  className="relative w-full text-left block cursor-pointer"
                  onClick={() => setSelected(currentGame)}
                  title="Click to manage this game"
                >
                  {/* Ensures consistent cover area even when no URL */}
                  <Cover
                    url={currentGame.cover_art_url}
                    alt={`${currentGame.title} cover`}
                    className="w-full"
                    imgClassName="object-cover"
                    style={{ height: "clamp(260px, 52vh, 540px)" }}
                  />

                  {/* Overlay for readability */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
                    <div
                      className="text-xl font-bold"
                      style={{ textShadow: "0 2px 6px rgba(0,0,0,0.9)" }}
                    >
                      {currentGame.title}
                    </div>
                    <div
                      className="text-sm text-white/80"
                      style={{ textShadow: "0 2px 6px rgba(0,0,0,0.9)" }}
                    >
                      {currentGame.platform} • {currentGame.status} • {currentGame.hours_played.toFixed(1)} hrs
                    </div>
                  </div>
                </button>

                <div className="p-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-white/70">Completion</span>
                    <span className="font-semibold">{currentGame.completion_percent}%</span>
                  </div>
                  <ProgressBar percent={currentGame.completion_percent} />
                </div>
              </div>
            </div>
          )}

          <div className="h-6" />

          {backlog.length > 0 && (
            <div className="w-full">
              <div className="text-center leading-tight">
                <div className="font-semibold">Backlog Queue</div>
                <div className="text-sm text-white/60 -mt-0.5">{backlog.length} games</div>
              </div>

              <div className="mt-3 flex gap-4 overflow-x-auto pb-2 w-full
                justify-start sm:flex-wrap sm:justify-center sm:overflow-visible">

                {backlog.map((g) => (
                  <button
                    key={g.id}
                    className="w-28 flex-none cursor-pointer text-left flex flex-col rounded-xl"
                    onClick={() => setSelected(g)}
                    title="Click to manage"
                  >
                    <Cover
                      url={g.cover_art_url}
                      alt={`${g.title} cover`}
                      className="w-28 h-24 rounded-xl border border-white/10"
                      imgClassName="object-cover"
                    />

                    <div className="mt-1 text-xs text-white/80 line-clamp-2">{g.title}</div>

                    <div className="mt-auto pt-2">
                      <div className="flex justify-between text-[10px] text-white/60 mb-1">
                        <span>{g.completion_percent}%</span>
                        <span className="text-white/40">{g.hours_played.toFixed(0)}h</span>
                      </div>
                      <ProgressBar percent={g.completion_percent} heightClass="h-2" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {selected && (
        <Modal
          game={selected}
          loading={loading}
          onClose={() => setSelected(null)}
          onSetNowPlaying={() => setNowPlaying(selected)}
          onAddHours={(h) => addHours(selected, h)}
          onSaveEdits={(payload) => saveEdits(selected, payload)}
          onSaveMeta={(payload) => saveMeta(selected, payload)}
          onDelete={() => deleteGame(selected)}
        />
      )}

      {addOpen && (
        <AddGameModal loading={loading} onClose={() => setAddOpen(false)} onCreate={createGame} />
      )}
    </main>
  );
}
