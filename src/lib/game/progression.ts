import type { LevelUpChoice, Hero, PassiveEffect } from "./types";

// ─── All possible level-up choices ───
const ALL_CHOICES: LevelUpChoice[] = [
  { id: "brute_force", name: "Brute Force", description: "ATK +3" },
  { id: "iron_skin", name: "Iron Skin", description: "DEF +3" },
  { id: "vitality", name: "Vitality", description: "Max HP +10, heal 10 HP" },
  { id: "quick_reflexes", name: "Quick Reflexes", description: "Dodge +5%" },
  { id: "keen_eye", name: "Keen Eye", description: "Crit chance +5%" },
  { id: "berserker", name: "Berserker", description: "ATK +4, DEF -1" },
  { id: "juggernaut", name: "Juggernaut", description: "DEF +2, Max HP +5, ATK -1" },
  { id: "energy_surge", name: "Energy Surge", description: "Max energy +2" },
  { id: "vampiric_touch", name: "Vampiric Touch", description: "Heal 3 HP on each kill" },
  { id: "poison_resistance", name: "Poison Resistance", description: "Immune to poison" },
  { id: "thick_skin", name: "Thick Skin", description: "All damage taken reduced by 1" },
  { id: "relentless", name: "Relentless", description: "Energy regen +1 per turn" },
];

// ─── Generate 3 random choices for level-up ───
export function generateLevelUpChoices(): LevelUpChoice[] {
  const shuffled = [...ALL_CHOICES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

// ─── Apply a chosen level-up to the hero ───
export function applyLevelUpChoice(hero: Hero, choiceId: string): Hero {
  const h = { ...hero };

  switch (choiceId) {
    case "brute_force":
      h.atk += 3;
      break;
    case "iron_skin":
      h.def += 3;
      break;
    case "vitality":
      h.maxHp += 10;
      h.hp = Math.min(h.hp + 10, h.maxHp);
      break;
    case "quick_reflexes":
      h.dodge += 5;
      break;
    case "keen_eye":
      h.critChance += 5;
      break;
    case "berserker":
      h.atk += 4;
      h.def = Math.max(0, h.def - 1);
      break;
    case "juggernaut":
      h.def += 2;
      h.maxHp += 5;
      h.atk = Math.max(1, h.atk - 1);
      break;
    case "energy_surge":
      h.maxEnergy += 2;
      h.energy = Math.min(h.energy + 2, h.maxEnergy);
      break;
    case "vampiric_touch":
      if (!h.passives.includes("vampiric_touch")) {
        h.passives = [...h.passives, "vampiric_touch"];
      }
      break;
    case "poison_resistance":
      if (!h.passives.includes("poison_resistance")) {
        h.passives = [...h.passives, "poison_resistance"];
        // Remove existing poison
        h.statusEffects = h.statusEffects.filter((e) => e.type !== "poison");
      }
      break;
    case "thick_skin":
      if (!h.passives.includes("thick_skin")) {
        h.passives = [...h.passives, "thick_skin"];
      }
      break;
    case "relentless":
      if (!h.passives.includes("relentless")) {
        h.passives = [...h.passives, "relentless"];
      }
      break;
  }

  return h;
}
