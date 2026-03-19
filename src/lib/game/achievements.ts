import type { HeroClass } from "./types";

// ─── Achievement Definitions ───

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: "depth" | "combat" | "class" | "challenge" | "legendary";
  emberReward: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Depth ──
  { id: "first_steps", name: "First Steps", description: "Reach floor 5", category: "depth", emberReward: 10 },
  { id: "into_the_deep", name: "Into the Deep", description: "Reach floor 10", category: "depth", emberReward: 25 },
  { id: "no_turning_back", name: "No Turning Back", description: "Reach floor 15", category: "depth", emberReward: 40 },
  { id: "abyssal_depths", name: "Abyssal Depths", description: "Reach floor 20", category: "depth", emberReward: 60 },
  { id: "endless_descent", name: "Endless Descent", description: "Reach floor 30", category: "depth", emberReward: 100 },

  // ── Combat ──
  { id: "bloodied", name: "Bloodied", description: "50 total kills across all runs", category: "combat", emberReward: 15 },
  { id: "slayer", name: "Slayer", description: "200 total kills across all runs", category: "combat", emberReward: 30 },
  { id: "massacre", name: "Massacre", description: "500 total kills across all runs", category: "combat", emberReward: 50 },
  { id: "death_incarnate", name: "Death Incarnate", description: "1000 total kills across all runs", category: "combat", emberReward: 80 },

  // ── Class Mastery ──
  { id: "shield_bearer", name: "Shield Bearer", description: "Reach floor 10 as Warden", category: "class", emberReward: 30 },
  { id: "shadow_walker", name: "Shadow Walker", description: "Reach floor 10 as Rogue", category: "class", emberReward: 30 },
  { id: "arcane_adept", name: "Arcane Adept", description: "Reach floor 10 as Arcanist", category: "class", emberReward: 30 },
  { id: "blood_reaver", name: "Blood Reaver", description: "Reach floor 10 as Reaver", category: "class", emberReward: 30 },

  // ── Challenge ──
  { id: "close_call", name: "Close Call", description: "Defeat a boss with less than 10 HP", category: "challenge", emberReward: 40 },
  { id: "speed_runner", name: "Speed Runner", description: "Reach floor 10 in under 300 turns", category: "challenge", emberReward: 50 },
  { id: "boss_slayer", name: "Boss Slayer", description: "Kill 5 bosses across all runs", category: "challenge", emberReward: 35 },
  { id: "jack_of_all_trades", name: "Jack of All Trades", description: "Play all 4 classes", category: "challenge", emberReward: 50 },
  { id: "deep_delver", name: "Deep Delver", description: "Reach floor 50", category: "challenge", emberReward: 150 },

  // ── Legendary ──
  { id: "abyssal_legend", name: "Abyssal Legend", description: "Reach floor 75", category: "legendary", emberReward: 200 },
  { id: "eternal_champion", name: "Eternal Champion", description: "Reach floor 100", category: "legendary", emberReward: 300 },
];

// ─── Check which achievements are newly earned ───

export interface RunStats {
  floor: number;
  kills: number;
  bossKills: number;
  turns: number;
  heroClass: HeroClass;
  heroHp: number;
  heroMaxHp: number;
}

export interface LifetimeStats {
  totalKills: number;
  totalBossKills: number;
  classesPlayed: string[];
  maxFloor: number;
}

export function checkAchievements(
  run: RunStats,
  lifetime: LifetimeStats,
  alreadyEarned: string[],
): AchievementDef[] {
  const earned: AchievementDef[] = [];
  const has = (id: string) => alreadyEarned.includes(id);

  for (const ach of ACHIEVEMENTS) {
    if (has(ach.id)) continue;

    let unlocked = false;
    switch (ach.id) {
      // Depth
      case "first_steps": unlocked = run.floor >= 5; break;
      case "into_the_deep": unlocked = run.floor >= 10; break;
      case "no_turning_back": unlocked = run.floor >= 15; break;
      case "abyssal_depths": unlocked = run.floor >= 20; break;
      case "endless_descent": unlocked = run.floor >= 30; break;

      // Combat (lifetime)
      case "bloodied": unlocked = lifetime.totalKills >= 50; break;
      case "slayer": unlocked = lifetime.totalKills >= 200; break;
      case "massacre": unlocked = lifetime.totalKills >= 500; break;
      case "death_incarnate": unlocked = lifetime.totalKills >= 1000; break;

      // Class mastery
      case "shield_bearer": unlocked = run.heroClass === "warden" && run.floor >= 10; break;
      case "shadow_walker": unlocked = run.heroClass === "rogue" && run.floor >= 10; break;
      case "arcane_adept": unlocked = run.heroClass === "arcanist" && run.floor >= 10; break;
      case "blood_reaver": unlocked = run.heroClass === "reaver" && run.floor >= 10; break;

      // Challenge
      case "close_call": unlocked = run.bossKills > 0 && run.heroHp < 10 && run.heroHp > 0; break;
      case "speed_runner": unlocked = run.floor >= 10 && run.turns < 300; break;
      case "boss_slayer": unlocked = lifetime.totalBossKills >= 5; break;
      case "jack_of_all_trades": unlocked = lifetime.classesPlayed.length >= 4; break;
      case "deep_delver": unlocked = run.floor >= 50; break;

      // Legendary
      case "abyssal_legend": unlocked = run.floor >= 75; break;
      case "eternal_champion": unlocked = run.floor >= 100; break;
    }

    if (unlocked) earned.push(ach);
  }

  return earned;
}
