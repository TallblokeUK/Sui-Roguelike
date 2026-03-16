import type { LeaderboardEntry, GameState } from "./types";

const STORAGE_KEY = "crypts-of-sui-leaderboard";
const MAX_ENTRIES = 20;

export function loadLeaderboard(): LeaderboardEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LeaderboardEntry[];
  } catch {
    return [];
  }
}

export function saveRun(state: GameState): LeaderboardEntry[] {
  const entry: LeaderboardEntry = {
    heroName: state.hero.name,
    level: state.hero.level,
    floor: state.floor,
    kills: state.killCount,
    turns: state.turnsElapsed,
    causeOfDeath: state.causeOfDeath,
    date: new Date().toISOString(),
  };

  const board = loadLeaderboard();
  board.push(entry);

  // Sort by floor (desc), then level (desc), then kills (desc)
  board.sort((a, b) => {
    if (b.floor !== a.floor) return b.floor - a.floor;
    if (b.level !== a.level) return b.level - a.level;
    return b.kills - a.kills;
  });

  // Keep top entries
  const trimmed = board.slice(0, MAX_ENTRIES);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable — silently fail
  }

  return trimmed;
}
