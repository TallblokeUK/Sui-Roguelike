import type { PassiveEffect } from "./types";

// ─── Account Progression Types ───

export interface MetaUpgrade {
  id: string;
  name: string;
  description: string;
  category: "vitae" | "shadow" | "arcane" | "fortune";
  maxTier: number;
  tiers: { cost: number; effect: string }[];
}

export type AccountUpgrades = Record<string, number>; // upgradeId → current tier

export interface AccountProgression {
  soulEmbers: number;
  totalEmbersEarned: number;
  upgrades: AccountUpgrades;
}

export interface MetaBonuses {
  bonusHp: number;
  bonusAtk: number;
  bonusDef: number;
  bonusDodge: number;
  bonusCrit: number;
  bonusEnergy: number;
  startingPassives: PassiveEffect[];
  startingGold: number;
  startingPotionRarity: "common" | "uncommon" | null;
  emberMultiplier: number;
}

// ─── Upgrade Catalog ───

export const UPGRADE_CATALOG: MetaUpgrade[] = [
  // ── Vitae (Body) ──
  {
    id: "darkblood_vigor",
    name: "Darkblood Vigor",
    description: "Max HP",
    category: "vitae",
    maxTier: 3,
    tiers: [
      { cost: 20, effect: "+3 Max HP" },
      { cost: 50, effect: "+3 Max HP" },
      { cost: 120, effect: "+4 Max HP" },
    ],
  },
  {
    id: "ironbone_marrow",
    name: "Ironbone Marrow",
    description: "DEF",
    category: "vitae",
    maxTier: 2,
    tiers: [
      { cost: 25, effect: "+1 DEF" },
      { cost: 70, effect: "+1 DEF" },
    ],
  },
  {
    id: "soulforge_sinew",
    name: "Soulforge Sinew",
    description: "ATK",
    category: "vitae",
    maxTier: 2,
    tiers: [
      { cost: 25, effect: "+1 ATK" },
      { cost: 70, effect: "+1 ATK" },
    ],
  },

  // ── Shadow (Finesse) ──
  {
    id: "wraith_step",
    name: "Wraith Step",
    description: "Dodge",
    category: "shadow",
    maxTier: 2,
    tiers: [
      { cost: 30, effect: "+2% Dodge" },
      { cost: 80, effect: "+2% Dodge" },
    ],
  },
  {
    id: "deaths_precision",
    name: "Death's Precision",
    description: "Crit",
    category: "shadow",
    maxTier: 2,
    tiers: [
      { cost: 30, effect: "+2% Crit" },
      { cost: 80, effect: "+3% Crit" },
    ],
  },
  {
    id: "soul_reservoir",
    name: "Soul Reservoir",
    description: "Max Energy",
    category: "shadow",
    maxTier: 2,
    tiers: [
      { cost: 35, effect: "+1 Max Energy" },
      { cost: 90, effect: "+1 Max Energy" },
    ],
  },

  // ── Arcane (Starting Passives) ──
  {
    id: "innate_vampirism",
    name: "Innate Vampirism",
    description: "Start with Vampiric Touch",
    category: "arcane",
    maxTier: 1,
    tiers: [{ cost: 100, effect: "Heal 3 HP on each kill" }],
  },
  {
    id: "innate_resilience",
    name: "Innate Resilience",
    description: "Start with Poison Resistance",
    category: "arcane",
    maxTier: 1,
    tiers: [{ cost: 80, effect: "Immune to poison" }],
  },
  {
    id: "innate_fortitude",
    name: "Innate Fortitude",
    description: "Start with Thick Skin",
    category: "arcane",
    maxTier: 1,
    tiers: [{ cost: 100, effect: "All damage taken reduced by 1" }],
  },
  {
    id: "innate_tenacity",
    name: "Innate Tenacity",
    description: "Start with Relentless",
    category: "arcane",
    maxTier: 1,
    tiers: [{ cost: 100, effect: "Energy regen +1 per turn" }],
  },

  // ── Fortune (Resources) ──
  {
    id: "grave_goods",
    name: "Grave Goods",
    description: "Starting potion",
    category: "fortune",
    maxTier: 2,
    tiers: [
      { cost: 15, effect: "Start with a common potion" },
      { cost: 40, effect: "Start with an uncommon potion" },
    ],
  },
  {
    id: "tomb_raider",
    name: "Tomb Raider",
    description: "Starting gold",
    category: "fortune",
    maxTier: 2,
    tiers: [
      { cost: 40, effect: "Start with 15 gold" },
      { cost: 100, effect: "Start with 30 gold" },
    ],
  },
  {
    id: "ember_tithe",
    name: "Ember Tithe",
    description: "Soul Ember earnings",
    category: "fortune",
    maxTier: 2,
    tiers: [
      { cost: 60, effect: "+15% Soul Ember earnings" },
      { cost: 150, effect: "+30% Soul Ember earnings" },
    ],
  },
];

// ─── Compute bonuses from owned upgrades ───

export function computeMetaBonuses(upgrades: AccountUpgrades): MetaBonuses {
  const tier = (id: string) => upgrades[id] ?? 0;

  // Darkblood Vigor: +3, +3, +4
  const hpTier = tier("darkblood_vigor");
  const bonusHp = hpTier >= 3 ? 10 : hpTier >= 2 ? 6 : hpTier >= 1 ? 3 : 0;

  // Ironbone Marrow: +1, +1
  const bonusDef = tier("ironbone_marrow");

  // Soulforge Sinew: +1, +1
  const bonusAtk = tier("soulforge_sinew");

  // Wraith Step: +2%, +2%
  const bonusDodge = tier("wraith_step") * 2;

  // Death's Precision: +2%, +3%
  const critTier = tier("deaths_precision");
  const bonusCrit = critTier >= 2 ? 5 : critTier >= 1 ? 2 : 0;

  // Soul Reservoir: +1, +1
  const bonusEnergy = tier("soul_reservoir");

  // Passives
  const startingPassives: PassiveEffect[] = [];
  if (tier("innate_vampirism") >= 1) startingPassives.push("vampiric_touch");
  if (tier("innate_resilience") >= 1) startingPassives.push("poison_resistance");
  if (tier("innate_fortitude") >= 1) startingPassives.push("thick_skin");
  if (tier("innate_tenacity") >= 1) startingPassives.push("relentless");

  // Grave Goods
  const potionTier = tier("grave_goods");
  const startingPotionRarity: "common" | "uncommon" | null =
    potionTier >= 2 ? "uncommon" : potionTier >= 1 ? "common" : null;

  // Tomb Raider: 15, 30
  const goldTier = tier("tomb_raider");
  const startingGold = goldTier >= 2 ? 30 : goldTier >= 1 ? 15 : 0;

  // Ember Tithe: 1.15, 1.30
  const embTier = tier("ember_tithe");
  const emberMultiplier = embTier >= 2 ? 1.3 : embTier >= 1 ? 1.15 : 1.0;

  return {
    bonusHp,
    bonusAtk,
    bonusDef,
    bonusDodge,
    bonusCrit,
    bonusEnergy,
    startingPassives,
    startingGold,
    startingPotionRarity,
    emberMultiplier,
  };
}

// ─── Calculate Soul Embers earned from a run ───

export function calculateSoulEmbers(
  floor: number,
  level: number,
  kills: number,
  multiplier: number,
): { total: number; breakdown: { label: string; value: number }[] } {
  const floorEmbers = floor * 3;
  const killEmbers = kills;
  const levelEmbers = (level - 1) * 5;
  const bossFloorsCleared = Math.floor((floor - 1) / 5); // floor 6 means boss 5 cleared
  const bossEmbers = bossFloorsCleared * 10;

  const base = floorEmbers + killEmbers + levelEmbers + bossEmbers;
  const bonus = multiplier > 1 ? Math.floor(base * (multiplier - 1)) : 0;
  const total = base + bonus;

  const breakdown: { label: string; value: number }[] = [
    { label: `Floor ${floor}`, value: floorEmbers },
    { label: `${kills} Kills`, value: killEmbers },
    { label: `Level ${level}`, value: levelEmbers },
  ];
  if (bossEmbers > 0) {
    breakdown.push({ label: `${bossFloorsCleared} Boss${bossFloorsCleared > 1 ? "es" : ""} cleared`, value: bossEmbers });
  }
  if (bonus > 0) {
    const pct = Math.round((multiplier - 1) * 100);
    breakdown.push({ label: `Ember Tithe (${pct}%)`, value: bonus });
  }

  return { total, breakdown };
}

// ─── Default empty progression ───

export function emptyProgression(): AccountProgression {
  return { soulEmbers: 0, totalEmbersEarned: 0, upgrades: {} };
}

// ─── Get cost for the next tier of an upgrade ───

export function getNextTierCost(upgrade: MetaUpgrade, currentTier: number): number | null {
  if (currentTier >= upgrade.maxTier) return null;
  return upgrade.tiers[currentTier].cost;
}

// ─── Category display names ───

export const CATEGORY_NAMES: Record<string, string> = {
  vitae: "Vitae",
  shadow: "Shadow",
  arcane: "Arcane",
  fortune: "Fortune",
};
