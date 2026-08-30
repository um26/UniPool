import { storage } from "@/src/utils/storage";
import { gamesV3Api } from "@/src/api/gamesV3";

const KEY = "unipool.games.progress.v1";
export type GameProfile = { xp: number; level: number; gamesPlayed: number; currentStreak: number; bestStreak: number; perfectRounds: number; lastPlayedDate: string | null; recent: { game: string; result: string; xp: number; at: string }[] };
const EMPTY: GameProfile = { xp: 0, level: 1, gamesPlayed: 0, currentStreak: 0, bestStreak: 0, perfectRounds: 0, lastPlayedDate: null, recent: [] };

function dayKey(date = new Date()) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
  catch { return date.toISOString().slice(0, 10); }
}
function previousDay(key: string) { const d = new Date(`${key}T12:00:00+05:30`); d.setDate(d.getDate() - 1); return dayKey(d); }
function parse(raw: any): GameProfile { try { const data = typeof raw === "string" ? JSON.parse(raw) : raw; return data && typeof data === "object" ? { ...EMPTY, ...data, recent: Array.isArray(data.recent) ? data.recent : [] } : { ...EMPTY }; } catch { return { ...EMPTY }; } }
function gameKey(game: string) { return game.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "time-pass"; }

export async function getGameProfile(): Promise<GameProfile> {
  const local = parse(await storage.secureGet(KEY, ""));
  try {
    const remote = await gamesV3Api.summary();
    if (remote && Number(remote.total_xp || 0) >= local.xp) {
      return { ...local, xp: Number(remote.total_xp || local.xp), level: Number(remote.level || local.level) };
    }
  } catch {}
  return local;
}

export async function recordGameResult(game: string, result: string): Promise<GameProfile> {
  const profile = await getGameProfile();
  const scoreMatch = result.match(/(\d+)\s*\/\s*(\d+)/);
  const score = scoreMatch ? Number(scoreMatch[1]) : 0;
  const max = scoreMatch ? Math.max(1, Number(scoreMatch[2])) : 0;
  const perfect = Boolean(max && score >= max);
  const ratioBonus = max ? Math.round((score / max) * 30) : 15;
  const earned = 20 + ratioBonus + (perfect ? 20 : 0);
  const today = dayKey();
  let streak = profile.currentStreak;
  if (profile.lastPlayedDate !== today) streak = profile.lastPlayedDate === previousDay(today) ? Math.max(1, streak + 1) : 1;
  const xp = profile.xp + earned;
  const next: GameProfile = {
    xp,
    level: Math.floor(xp / 250) + 1,
    gamesPlayed: profile.gamesPlayed + 1,
    currentStreak: streak,
    bestStreak: Math.max(profile.bestStreak, streak),
    perfectRounds: profile.perfectRounds + (perfect ? 1 : 0),
    lastPlayedDate: today,
    recent: [{ game, result, xp: earned, at: new Date().toISOString() }, ...profile.recent].slice(0, 12),
  };
  await storage.secureSet(KEY, JSON.stringify(next));
  gamesV3Api.record(gameKey(game), score, true).catch(() => {});
  return next;
}
