import type { StatusEffectType } from "./types";

// Monster templates — base stats before floor scaling
export interface MonsterTemplate {
  name: string;
  glyph: string;
  hp: number;
  atk: number;
  def: number;
  xpReward: number;
  color: string;
  minFloor: number;
  behavior: "melee" | "ranged";
  rangedRange?: number;
  statusOnHit?: {
    type: StatusEffectType;
    chance: number; // 0-100
    duration: number;
    damage: number;
  };
  special?: "pack" | "regenerate" | "summoner" | "mimic";
}

export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  {
    name: "Crypt Rat",
    glyph: "r",
    hp: 8,
    atk: 3,
    def: 0,
    xpReward: 3,
    color: "text-stone-400",
    minFloor: 1,
    behavior: "melee",
  },
  {
    name: "Skeleton",
    glyph: "s",
    hp: 12,
    atk: 4,
    def: 1,
    xpReward: 5,
    color: "text-stone-300",
    minFloor: 1,
    behavior: "melee",
  },
  {
    name: "Crypt Spider",
    glyph: "S",
    hp: 10,
    atk: 5,
    def: 0,
    xpReward: 6,
    color: "text-mana",
    minFloor: 2,
    behavior: "melee",
    statusOnHit: {
      type: "poison",
      chance: 30,
      duration: 3,
      damage: 2,
    },
  },
  {
    name: "Goblin Archer",
    glyph: "g",
    hp: 8,
    atk: 4,
    def: 0,
    xpReward: 7,
    color: "text-heal",
    minFloor: 2,
    behavior: "ranged",
    rangedRange: 4,
  },
  {
    name: "Bone Swarm",
    glyph: "b",
    hp: 6,
    atk: 2,
    def: 0,
    xpReward: 4,
    color: "text-stone-300",
    minFloor: 3,
    behavior: "melee",
    special: "pack",
  },
  {
    name: "Tomb Guardian",
    glyph: "G",
    hp: 14,
    atk: 5,
    def: 3,
    xpReward: 10,
    color: "text-gold",
    minFloor: 3,
    behavior: "melee",
  },
  {
    name: "Mimic",
    glyph: "!",
    hp: 16,
    atk: 7,
    def: 2,
    xpReward: 15,
    color: "text-gold-bright",
    minFloor: 4,
    behavior: "melee",
    special: "mimic",
  },
  {
    name: "Troll",
    glyph: "T",
    hp: 25,
    atk: 6,
    def: 3,
    xpReward: 12,
    color: "text-heal",
    minFloor: 5,
    behavior: "melee",
    special: "regenerate",
  },
  {
    name: "Shadow Wraith",
    glyph: "W",
    hp: 10,
    atk: 7,
    def: 1,
    xpReward: 12,
    color: "text-ice",
    minFloor: 5,
    behavior: "ranged",
    rangedRange: 3,
  },
  {
    name: "Orc Berserker",
    glyph: "O",
    hp: 18,
    atk: 6,
    def: 4,
    xpReward: 14,
    color: "text-heal",
    minFloor: 6,
    behavior: "melee",
    statusOnHit: {
      type: "bleed",
      chance: 25,
      duration: 5,
      damage: 1,
    },
  },
  {
    name: "Basilisk",
    glyph: "B",
    hp: 18,
    atk: 5,
    def: 4,
    xpReward: 15,
    color: "text-gold",
    minFloor: 7,
    behavior: "melee",
    statusOnHit: {
      type: "stun",
      chance: 25,
      duration: 2,
      damage: 0,
    },
  },
  {
    name: "Lich",
    glyph: "L",
    hp: 22,
    atk: 9,
    def: 5,
    xpReward: 20,
    color: "text-mana",
    minFloor: 8,
    behavior: "ranged",
    rangedRange: 4,
    statusOnHit: {
      type: "burning",
      chance: 30,
      duration: 2,
      damage: 3,
    },
  },
  {
    name: "Necromancer",
    glyph: "N",
    hp: 14,
    atk: 6,
    def: 2,
    xpReward: 18,
    color: "text-mana",
    minFloor: 8,
    behavior: "ranged",
    rangedRange: 4,
    special: "summoner",
  },
  {
    name: "Shadowflame Wyrm",
    glyph: "D",
    hp: 35,
    atk: 12,
    def: 7,
    xpReward: 30,
    color: "text-blood",
    minFloor: 10,
    behavior: "melee",
    statusOnHit: {
      type: "burning",
      chance: 40,
      duration: 3,
      damage: 3,
    },
  },
];

// ─── Boss templates (8 bosses, rotate every 40 floors) ───
export interface BossTemplate extends MonsterTemplate {
  title: string;
}

export const BOSS_TEMPLATES: BossTemplate[] = [
  {
    name: "The Warden",
    glyph: "W",
    hp: 60,
    atk: 8,
    def: 5,
    xpReward: 50,
    color: "text-gold-bright",
    minFloor: 5,
    behavior: "melee",
    title: "The Warden",
    statusOnHit: { type: "bleed", chance: 40, duration: 4, damage: 2 },
  },
  {
    name: "The Lich King",
    glyph: "K",
    hp: 80,
    atk: 12,
    def: 6,
    xpReward: 80,
    color: "text-mana",
    minFloor: 10,
    behavior: "ranged",
    rangedRange: 5,
    title: "The Lich King",
    statusOnHit: { type: "burning", chance: 40, duration: 3, damage: 4 },
    special: "summoner",
  },
  {
    name: "The Wyrm Lord",
    glyph: "D",
    hp: 120,
    atk: 16,
    def: 8,
    xpReward: 120,
    color: "text-blood",
    minFloor: 15,
    behavior: "melee",
    title: "The Wyrm Lord",
    statusOnHit: { type: "burning", chance: 50, duration: 3, damage: 5 },
  },
  {
    name: "The Abyss Stalker",
    glyph: "A",
    hp: 100,
    atk: 14,
    def: 4,
    xpReward: 100,
    color: "text-mana",
    minFloor: 20,
    behavior: "melee",
    title: "The Abyss Stalker",
    statusOnHit: { type: "poison", chance: 50, duration: 5, damage: 3 },
  },
  {
    name: "The Iron Colossus",
    glyph: "C",
    hp: 160,
    atk: 10,
    def: 14,
    xpReward: 130,
    color: "text-stone-300",
    minFloor: 25,
    behavior: "melee",
    title: "The Iron Colossus",
    statusOnHit: { type: "stun", chance: 35, duration: 2, damage: 0 },
    special: "regenerate",
  },
  {
    name: "The Plague Mother",
    glyph: "P",
    hp: 110,
    atk: 13,
    def: 6,
    xpReward: 110,
    color: "text-heal",
    minFloor: 30,
    behavior: "ranged",
    rangedRange: 4,
    title: "The Plague Mother",
    statusOnHit: { type: "poison", chance: 45, duration: 4, damage: 4 },
    special: "summoner",
  },
  {
    name: "The Void Reaper",
    glyph: "V",
    hp: 140,
    atk: 18,
    def: 8,
    xpReward: 150,
    color: "text-ice",
    minFloor: 35,
    behavior: "melee",
    title: "The Void Reaper",
    statusOnHit: { type: "bleed", chance: 50, duration: 5, damage: 4 },
  },
  {
    name: "The Eternal Flame",
    glyph: "F",
    hp: 180,
    atk: 20,
    def: 10,
    xpReward: 180,
    color: "text-blood",
    minFloor: 40,
    behavior: "ranged",
    rangedRange: 5,
    title: "The Eternal Flame",
    statusOnHit: { type: "burning", chance: 60, duration: 4, damage: 5 },
  },
];

// ─── Get boss for a given floor (rotation + scaling) ───
export function getBossForFloor(floor: number): BossTemplate | undefined {
  if (floor % 5 !== 0) return undefined;
  const bossIndex = (floor / 5 - 1) % BOSS_TEMPLATES.length;
  const cycle = Math.floor((floor / 5 - 1) / BOSS_TEMPLATES.length);
  const template = BOSS_TEMPLATES[bossIndex];

  // Scale stats by +40% per cycle
  const scale = 1 + cycle * 0.4;
  const suffix = cycle >= 1 ? ` Ascended ${"I".repeat(Math.min(cycle, 5))}` : "";

  return {
    ...template,
    name: `${template.title}${suffix}`,
    hp: Math.round(template.hp * scale),
    atk: Math.round(template.atk * scale),
    def: Math.round(template.def * scale),
    xpReward: Math.round(template.xpReward * scale),
  };
}
