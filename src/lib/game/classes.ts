import type { HeroClass, Ability } from "./types";

// ─── Class stat offsets (relative to base 30/5/2/3/5/5) ───
export interface ClassDefinition {
  id: HeroClass;
  name: string;
  description: string;
  glyph: string;
  passive: string;
  passiveDesc: string;
  // Stat offsets from base
  hpOffset: number;
  atkOffset: number;
  defOffset: number;
  dodgeOffset: number;
  critOffset: number;
  energyOffset: number;
}

export const CLASS_DEFINITIONS: Record<HeroClass, ClassDefinition> = {
  warden: {
    id: "warden",
    name: "Warden",
    description: "A stalwart protector. High HP and DEF, lower damage.",
    glyph: "\u2655", // chess queen
    passive: "Iron Resolve",
    passiveDesc: "Take 1 less damage from all sources",
    hpOffset: 8, atkOffset: -1, defOffset: 2,
    dodgeOffset: -1, critOffset: -2, energyOffset: -1,
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    description: "A deadly shadow. High evasion and crits, fragile.",
    glyph: "\u2694", // crossed swords
    passive: "Shadow Step",
    passiveDesc: "After dodging, next attack deals +50% damage",
    hpOffset: -6, atkOffset: 1, defOffset: -1,
    dodgeOffset: 5, critOffset: 5, energyOffset: 1,
  },
  arcanist: {
    id: "arcanist",
    name: "Arcanist",
    description: "A wielder of arcane power. Ranged abilities, high energy.",
    glyph: "\u2726", // four club spoked asterisk
    passive: "Mana Siphon",
    passiveDesc: "+1 energy on each kill",
    hpOffset: -8, atkOffset: -2, defOffset: -1,
    dodgeOffset: 0, critOffset: 0, energyOffset: 3,
  },
  reaver: {
    id: "reaver",
    name: "Reaver",
    description: "A bloodthirsty warrior. High ATK, heals through violence.",
    glyph: "\u2620", // skull and crossbones
    passive: "Bloodthirst",
    passiveDesc: "Heal 2 HP on each kill",
    hpOffset: -2, atkOffset: 2, defOffset: -1,
    dodgeOffset: 0, critOffset: 2, energyOffset: 0,
  },
};

// ─── Class-specific starting abilities ───
export function getClassAbilities(heroClass: HeroClass): Ability[] {
  switch (heroClass) {
    case "warden":
      return [
        {
          id: "shield_slam",
          name: "Shield Slam",
          description: "Melee attack with 40% chance to stun",
          energyCost: 1, cooldown: 0, currentCooldown: 0, range: 1,
        },
        {
          id: "fortify",
          name: "Fortify",
          description: "Gain +3 DEF for 3 turns",
          energyCost: 2, cooldown: 4, currentCooldown: 0, range: 0,
        },
        {
          id: "cleave",
          name: "Cleave",
          description: "Hit all adjacent monsters for 75% damage",
          energyCost: 2, cooldown: 4, currentCooldown: 0, range: 0,
        },
      ];

    case "rogue":
      return [
        {
          id: "backstab",
          name: "Backstab",
          description: "150% damage vs debuffed targets",
          energyCost: 1, cooldown: 0, currentCooldown: 0, range: 1,
        },
        {
          id: "smoke_bomb",
          name: "Smoke Bomb",
          description: "+20% dodge for 3 turns, stun adjacent foes",
          energyCost: 2, cooldown: 5, currentCooldown: 0, range: 0,
        },
        {
          id: "lunge",
          name: "Lunge",
          description: "Strike up to 2 tiles away and close the gap",
          energyCost: 1, cooldown: 0, currentCooldown: 0, range: 2,
        },
      ];

    case "arcanist":
      return [
        {
          id: "arcane_bolt",
          name: "Arcane Bolt",
          description: "Ranged attack up to 3 tiles away",
          energyCost: 1, cooldown: 0, currentCooldown: 0, range: 3,
        },
        {
          id: "frost_nova",
          name: "Frost Nova",
          description: "60% damage + stun all adjacent monsters",
          energyCost: 2, cooldown: 4, currentCooldown: 0, range: 0,
        },
        {
          id: "flame_pillar",
          name: "Flame Pillar",
          description: "Ranged attack + burning (3 dmg/turn, 3 turns)",
          energyCost: 2, cooldown: 3, currentCooldown: 0, range: 2,
        },
      ];

    case "reaver":
      return [
        {
          id: "rend",
          name: "Rend",
          description: "Melee attack + guaranteed bleed (2 dmg/turn, 3 turns)",
          energyCost: 1, cooldown: 0, currentCooldown: 0, range: 1,
        },
        {
          id: "blood_frenzy",
          name: "Blood Frenzy",
          description: "+3 ATK and heal 1 HP per hit for 4 turns",
          energyCost: 2, cooldown: 5, currentCooldown: 0, range: 0,
        },
        {
          id: "cleave",
          name: "Cleave",
          description: "Hit all adjacent monsters for 75% damage",
          energyCost: 2, cooldown: 4, currentCooldown: 0, range: 0,
        },
      ];
  }
}

// ─── Unlockable abilities (via Dark Forge mastery) ───
export const UNLOCKABLE_ABILITIES: Record<string, { heroClass: HeroClass; ability: Ability }> = {
  warden_ability_4: {
    heroClass: "warden",
    ability: {
      id: "rallying_cry",
      name: "Rallying Cry",
      description: "Heal 15% max HP and cleanse 1 debuff",
      energyCost: 3, cooldown: 6, currentCooldown: 0, range: 0,
    },
  },
  warden_ability_5: {
    heroClass: "warden",
    ability: {
      id: "earthquake",
      name: "Earthquake",
      description: "Damage + stun all visible monsters",
      energyCost: 3, cooldown: 8, currentCooldown: 0, range: 0,
    },
  },
  rogue_ability_4: {
    heroClass: "rogue",
    ability: {
      id: "envenom",
      name: "Envenom",
      description: "Melee attack + guaranteed 4-turn poison (3 dmg/turn)",
      energyCost: 2, cooldown: 3, currentCooldown: 0, range: 1,
    },
  },
  rogue_ability_5: {
    heroClass: "rogue",
    ability: {
      id: "shadow_dance",
      name: "Shadow Dance",
      description: "Become untargetable for 2 turns",
      energyCost: 3, cooldown: 7, currentCooldown: 0, range: 0,
    },
  },
  arcanist_ability_4: {
    heroClass: "arcanist",
    ability: {
      id: "chain_lightning",
      name: "Chain Lightning",
      description: "Ranged attack that bounces to 2 nearby enemies",
      energyCost: 3, cooldown: 5, currentCooldown: 0, range: 3,
    },
  },
  arcanist_ability_5: {
    heroClass: "arcanist",
    ability: {
      id: "voidrift",
      name: "Voidrift",
      description: "Teleport to a random visible floor tile",
      energyCost: 2, cooldown: 6, currentCooldown: 0, range: 0,
    },
  },
  reaver_ability_4: {
    heroClass: "reaver",
    ability: {
      id: "deathstrike",
      name: "Deathstrike",
      description: "200% damage. Kill = heal 25% max HP",
      energyCost: 3, cooldown: 6, currentCooldown: 0, range: 1,
    },
  },
  reaver_ability_5: {
    heroClass: "reaver",
    ability: {
      id: "howl_of_fury",
      name: "Howl of Fury",
      description: "All visible monsters flee for 2 turns",
      energyCost: 2, cooldown: 5, currentCooldown: 0, range: 0,
    },
  },
};

// ─── Class display info for UI ───
export const CLASS_LIST: HeroClass[] = ["warden", "rogue", "arcanist", "reaver"];
