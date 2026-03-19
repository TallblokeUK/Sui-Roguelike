import type { Item, ItemRarity, ItemType, ScrollEffect } from "./types";

interface ItemTemplate {
  name: string;
  type: ItemType;
  glyph: string;
  baseValue: number;
  description: string;
  setId?: string;
}

// ─── Weapons ───
const WEAPONS: ItemTemplate[] = [
  // Daggers (low ATK, early game)
  { name: "Rusty Dagger", type: "weapon", glyph: "†", baseValue: 2, description: "A corroded blade. Better than fists." },
  { name: "Iron Dagger", type: "weapon", glyph: "†", baseValue: 3, description: "Small but reliable." },
  { name: "Stiletto", type: "weapon", glyph: "†", baseValue: 4, description: "Thin blade for precise strikes." },
  { name: "Venom Fang", type: "weapon", glyph: "†", baseValue: 5, description: "Drips with green ichor." },
  // Swords (balanced)
  { name: "Short Sword", type: "weapon", glyph: "†", baseValue: 3, description: "Quick and dependable." },
  { name: "Iron Sword", type: "weapon", glyph: "†", baseValue: 4, description: "Reliable and sharp." },
  { name: "Broadsword", type: "weapon", glyph: "†", baseValue: 5, description: "Wide blade, strong swings." },
  { name: "Longsword", type: "weapon", glyph: "†", baseValue: 6, description: "Reach and power combined." },
  { name: "Bastard Sword", type: "weapon", glyph: "†", baseValue: 7, description: "One hand or two, always deadly." },
  { name: "Cursed Scimitar", type: "weapon", glyph: "†", baseValue: 7, description: "Whispers of its former owner." },
  { name: "Flamebrand", type: "weapon", glyph: "†", baseValue: 8, description: "The blade flickers with inner fire." },
  { name: "Runesword", type: "weapon", glyph: "†", baseValue: 9, description: "Ancient glyphs pulse along the edge." },
  { name: "Soulshard Blade", type: "weapon", glyph: "†", baseValue: 13, description: "Hums with captured souls." },
  // Axes (high ATK)
  { name: "Hatchet", type: "weapon", glyph: "¶", baseValue: 3, description: "Simple but effective." },
  { name: "War Axe", type: "weapon", glyph: "¶", baseValue: 5, description: "Cleaves through bone." },
  { name: "Battleaxe", type: "weapon", glyph: "¶", baseValue: 6, description: "Heavy, devastating strikes." },
  { name: "Greataxe", type: "weapon", glyph: "¶", baseValue: 8, description: "Requires two hands and raw strength." },
  { name: "Executioner's Axe", type: "weapon", glyph: "¶", baseValue: 11, description: "Built for one purpose only." },
  // Maces & Hammers
  { name: "Wooden Club", type: "weapon", glyph: "T", baseValue: 2, description: "Blunt but functional." },
  { name: "Iron Mace", type: "weapon", glyph: "T", baseValue: 4, description: "Cracks skulls efficiently." },
  { name: "Warhammer", type: "weapon", glyph: "T", baseValue: 5, description: "Crushes bone and armor alike." },
  { name: "Morningstar", type: "weapon", glyph: "T", baseValue: 6, description: "Spiked ball on a chain." },
  { name: "Maul of Ruin", type: "weapon", glyph: "T", baseValue: 10, description: "Sunders everything it touches." },
  // Spears & Polearms
  { name: "Wooden Spear", type: "weapon", glyph: "/", baseValue: 3, description: "Sharpened wood, surprisingly effective." },
  { name: "Iron Spear", type: "weapon", glyph: "/", baseValue: 4, description: "Standard infantry issue." },
  { name: "Pike", type: "weapon", glyph: "/", baseValue: 6, description: "Keeps enemies at bay." },
  { name: "Halberd", type: "weapon", glyph: "/", baseValue: 7, description: "Axe and spear in one." },
  { name: "Frostbite Spear", type: "weapon", glyph: "/", baseValue: 9, description: "Piercing cold radiates from the tip." },
  { name: "Trident of the Deep", type: "weapon", glyph: "/", baseValue: 11, description: "Pulled from a drowned temple." },
  // Staves
  { name: "Gnarled Staff", type: "weapon", glyph: "|", baseValue: 2, description: "A mage's walking stick." },
  { name: "Oak Staff", type: "weapon", glyph: "|", baseValue: 4, description: "Sturdy and balanced." },
  { name: "Staff of Sparks", type: "weapon", glyph: "|", baseValue: 6, description: "Crackles with static." },
  { name: "Necromancer's Staff", type: "weapon", glyph: "|", baseValue: 8, description: "The skull atop it watches you." },
  { name: "Staff of the Archmage", type: "weapon", glyph: "|", baseValue: 12, description: "Reality bends around it." },
  // Bows (ranged flavor text)
  { name: "Short Bow", type: "weapon", glyph: ")", baseValue: 3, description: "Simple ranged weapon." },
  { name: "Longbow", type: "weapon", glyph: ")", baseValue: 5, description: "Greater range and power." },
  { name: "Composite Bow", type: "weapon", glyph: ")", baseValue: 7, description: "Layered wood and horn." },
  { name: "Elven Bow", type: "weapon", glyph: ")", baseValue: 9, description: "Impossibly light, deadly accurate." },
  // Exotic/Legendary
  { name: "Voidcleaver", type: "weapon", glyph: "†", baseValue: 11, description: "Cuts through reality itself." },
  { name: "Sunfire Blade", type: "weapon", glyph: "†", baseValue: 14, description: "Burns with the fury of a star." },
  { name: "Deathwhisper", type: "weapon", glyph: "†", baseValue: 15, description: "Its edge sings a funeral dirge." },
  { name: "Worldbreaker", type: "weapon", glyph: "T", baseValue: 16, description: "The ground trembles at each swing." },
];

// ─── Helmets ───
const HELMETS: ItemTemplate[] = [
  { name: "Leather Cap", type: "helmet", glyph: "^", baseValue: 1, description: "Basic head protection." },
  { name: "Iron Helm", type: "helmet", glyph: "^", baseValue: 2, description: "Dented but serviceable." },
  { name: "Steel Helm", type: "helmet", glyph: "^", baseValue: 3, description: "Polished and sturdy." },
  { name: "Horned Helm", type: "helmet", glyph: "^", baseValue: 3, description: "Intimidating horns jut outward." },
  { name: "Visored Helm", type: "helmet", glyph: "^", baseValue: 4, description: "Full face protection." },
  { name: "Crown of Thorns", type: "helmet", glyph: "^", baseValue: 5, description: "Pain grants clarity." },
  { name: "Skull Helm", type: "helmet", glyph: "^", baseValue: 5, description: "Carved from a giant's skull." },
  { name: "Mage's Circlet", type: "helmet", glyph: "^", baseValue: 4, description: "Enhances mental focus." },
  { name: "Dragonbone Crown", type: "helmet", glyph: "^", baseValue: 7, description: "Forged from wyrm bone." },
  { name: "Helm of the Undying", type: "helmet", glyph: "^", baseValue: 9, description: "Worn by the last to fall." },
];

// ─── Chest Armor ───
const CHESTS: ItemTemplate[] = [
  { name: "Cloth Tunic", type: "chest", glyph: "[", baseValue: 1, description: "Barely counts as armor." },
  { name: "Leather Vest", type: "chest", glyph: "[", baseValue: 2, description: "Basic protection." },
  { name: "Studded Leather", type: "chest", glyph: "[", baseValue: 3, description: "Reinforced with iron rivets." },
  { name: "Chain Mail", type: "chest", glyph: "[", baseValue: 4, description: "Interlinked iron rings." },
  { name: "Scale Mail", type: "chest", glyph: "[", baseValue: 5, description: "Overlapping metal scales." },
  { name: "Brigandine", type: "chest", glyph: "[", baseValue: 5, description: "Plates riveted to cloth." },
  { name: "Plate Armor", type: "chest", glyph: "[", baseValue: 6, description: "Heavy but resilient." },
  { name: "Shadow Cloak", type: "chest", glyph: "(", baseValue: 5, description: "Woven from darkness itself." },
  { name: "Mithril Shirt", type: "chest", glyph: "[", baseValue: 7, description: "Light as silk, tough as steel." },
  { name: "Dragonhide Vest", type: "chest", glyph: "[", baseValue: 8, description: "Scales of a fallen wyrm." },
  { name: "Ethereal Plate", type: "chest", glyph: "[", baseValue: 10, description: "Phase-shifts to deflect blows." },
  { name: "Demonplate", type: "chest", glyph: "[", baseValue: 12, description: "Forged in the abyss." },
];

// ─── Leg Armor ───
const LEGS: ItemTemplate[] = [
  { name: "Cloth Leggings", type: "legs", glyph: "=", baseValue: 1, description: "Thin fabric over your legs." },
  { name: "Leather Greaves", type: "legs", glyph: "=", baseValue: 2, description: "Supple leather leg guards." },
  { name: "Chain Leggings", type: "legs", glyph: "=", baseValue: 3, description: "Jingling mail leg protection." },
  { name: "Plate Greaves", type: "legs", glyph: "=", baseValue: 4, description: "Heavy metal leg plates." },
  { name: "Reinforced Tassets", type: "legs", glyph: "=", baseValue: 5, description: "Layered thigh guards." },
  { name: "Shadow Leggings", type: "legs", glyph: "=", baseValue: 5, description: "Move silently in darkness." },
  { name: "Dragonscale Chausses", type: "legs", glyph: "=", baseValue: 7, description: "Flexible draconic scales." },
  { name: "Legplates of the Colossus", type: "legs", glyph: "=", baseValue: 9, description: "Unmovable. Unbreakable." },
];

// ─── Boots ───
const BOOTS: ItemTemplate[] = [
  { name: "Worn Sandals", type: "boots", glyph: "}", baseValue: 1, description: "Better than barefoot." },
  { name: "Leather Boots", type: "boots", glyph: "}", baseValue: 1, description: "Standard footwear." },
  { name: "Iron Sabatons", type: "boots", glyph: "}", baseValue: 2, description: "Heavy metal boots." },
  { name: "Boots of Silence", type: "boots", glyph: "}", baseValue: 3, description: "Your footsteps make no sound." },
  { name: "Strider's Boots", type: "boots", glyph: "}", baseValue: 3, description: "Made for long journeys." },
  { name: "Winged Boots", type: "boots", glyph: "}", baseValue: 4, description: "Feather-light, impossibly fast." },
  { name: "Magma Treads", type: "boots", glyph: "}", baseValue: 5, description: "Leave scorch marks where you walk." },
  { name: "Boots of the Phantom", type: "boots", glyph: "}", baseValue: 6, description: "Walk between worlds." },
];

// ─── Gloves ───
const GLOVES: ItemTemplate[] = [
  { name: "Cloth Wraps", type: "gloves", glyph: "{", baseValue: 1, description: "Basic hand wraps." },
  { name: "Leather Gloves", type: "gloves", glyph: "{", baseValue: 1, description: "Grip and protection." },
  { name: "Chain Gauntlets", type: "gloves", glyph: "{", baseValue: 2, description: "Mail-linked hand armor." },
  { name: "Spiked Gauntlets", type: "gloves", glyph: "{", baseValue: 3, description: "Punches that bite back." },
  { name: "Plate Gauntlets", type: "gloves", glyph: "{", baseValue: 3, description: "Full metal hand protection." },
  { name: "Gloves of Precision", type: "gloves", glyph: "{", baseValue: 4, description: "Enhances fine motor control." },
  { name: "Vampiric Grips", type: "gloves", glyph: "{", baseValue: 5, description: "Drain warmth from the living." },
  { name: "Gauntlets of the Titan", type: "gloves", glyph: "{", baseValue: 7, description: "Crush stone with bare hands." },
];

// ─── Rings ───
const RINGS: ItemTemplate[] = [
  { name: "Copper Ring", type: "ring", glyph: "°", baseValue: 1, description: "Simple copper band. +ATK." },
  { name: "Ring of Strength", type: "ring", glyph: "°", baseValue: 2, description: "+ATK while worn." },
  { name: "Ring of Protection", type: "ring", glyph: "°", baseValue: 2, description: "+DEF while worn." },
  { name: "Ring of Vitality", type: "ring", glyph: "°", baseValue: 8, description: "+Max HP while worn." },
  { name: "Ring of the Berserker", type: "ring", glyph: "°", baseValue: 4, description: "+ATK while worn." },
  { name: "Ring of the Sentinel", type: "ring", glyph: "°", baseValue: 4, description: "+DEF while worn." },
  { name: "Ring of Regeneration", type: "ring", glyph: "°", baseValue: 15, description: "+Max HP while worn." },
  { name: "Ring of Evasion", type: "ring", glyph: "°", baseValue: 3, description: "Dodge chance increased." },
  { name: "Bloodstone Ring", type: "ring", glyph: "°", baseValue: 5, description: "Pulses with crimson light. +ATK." },
  { name: "Ring of the Phoenix", type: "ring", glyph: "°", baseValue: 10, description: "Warm to the touch, refuses to dim. +ATK." },
];

// ─── Amulets ───
const AMULETS: ItemTemplate[] = [
  { name: "Bone Pendant", type: "amulet", glyph: "\"", baseValue: 1, description: "Carved from unknown bone. +ATK." },
  { name: "Silver Amulet", type: "amulet", glyph: "\"", baseValue: 2, description: "Wards against evil. +ATK." },
  { name: "Amulet of Fortitude", type: "amulet", glyph: "\"", baseValue: 3, description: "+Max HP while worn." },
  { name: "Amulet of Wrath", type: "amulet", glyph: "\"", baseValue: 3, description: "+ATK while worn." },
  { name: "Amulet of the Bulwark", type: "amulet", glyph: "\"", baseValue: 3, description: "+DEF while worn." },
  { name: "Talisman of Focus", type: "amulet", glyph: "\"", baseValue: 4, description: "Enhances combat precision. +ATK." },
  { name: "Medallion of the Undying", type: "amulet", glyph: "\"", baseValue: 6, description: "Death finds it hard to claim you." },
  { name: "Amulet of the Void", type: "amulet", glyph: "\"", baseValue: 5, description: "A black gem that absorbs light. +ATK." },
  { name: "Heart of the Mountain", type: "amulet", glyph: "\"", baseValue: 8, description: "Stone-forged resilience." },
  { name: "Soultrap Pendant", type: "amulet", glyph: "\"", baseValue: 10, description: "Traps defeated spirits within. +ATK." },
];

// ─── Bracelets ───
const BRACELETS: ItemTemplate[] = [
  { name: "Leather Wristband", type: "bracelet", glyph: "~", baseValue: 1, description: "Simple wrist guard. +ATK." },
  { name: "Iron Bangle", type: "bracelet", glyph: "~", baseValue: 2, description: "Heavy iron bracelet. +ATK." },
  { name: "Bracelet of Might", type: "bracelet", glyph: "~", baseValue: 3, description: "+ATK while worn." },
  { name: "Bracelet of Warding", type: "bracelet", glyph: "~", baseValue: 3, description: "+DEF while worn." },
  { name: "Charm Bracelet", type: "bracelet", glyph: "~", baseValue: 4, description: "Tiny charms clink together. +ATK." },
  { name: "Viper's Coil", type: "bracelet", glyph: "~", baseValue: 4, description: "A serpent-shaped bracelet that bites. +ATK." },
  { name: "Shackle of Power", type: "bracelet", glyph: "~", baseValue: 6, description: "Chains that grant, not bind. +ATK." },
  { name: "Bracelet of the Cosmos", type: "bracelet", glyph: "~", baseValue: 8, description: "Stars orbit within the gems. +ATK." },
];

// ─── Potions ───
const POTIONS: ItemTemplate[] = [
  { name: "Healing Vial", type: "potion", glyph: "!", baseValue: 10, description: "Restores a little health." },
  { name: "Healing Potion", type: "potion", glyph: "!", baseValue: 18, description: "A reliable restorative brew." },
  { name: "Greater Healing Potion", type: "potion", glyph: "!", baseValue: 28, description: "Potent restorative elixir." },
  { name: "Elixir of Vitality", type: "potion", glyph: "!", baseValue: 40, description: "Fully mends grievous wounds." },
  { name: "Phoenix Tears", type: "potion", glyph: "!", baseValue: 55, description: "Liquid fire that heals all." },
  { name: "Elixir of Iron Skin", type: "potion", glyph: "!", baseValue: 20, description: "Temporarily hardens your skin." },
  { name: "Draught of Fury", type: "potion", glyph: "!", baseValue: 22, description: "Boils your blood with rage." },
  { name: "Antidote", type: "potion", glyph: "!", baseValue: 12, description: "Cures all poisons." },
];

// ─── Scrolls ───
interface ScrollTemplate {
  name: string;
  effect: ScrollEffect;
  description: string;
  minFloor: number;
}

const SCROLLS: ScrollTemplate[] = [
  { name: "Scroll of Teleport", effect: "teleport", description: "Teleport to a random location.", minFloor: 1 },
  { name: "Scroll of Mapping", effect: "mapping", description: "Reveals the entire floor.", minFloor: 2 },
  { name: "Scroll of Fire", effect: "fire", description: "Burns all visible monsters.", minFloor: 3 },
  { name: "Scroll of Frost", effect: "frost", description: "Freezes all visible monsters.", minFloor: 3 },
  { name: "Scroll of Enchant", effect: "enchant", description: "Enhances your equipped weapon.", minFloor: 4 },
  { name: "Scroll of Remove Curse", effect: "remove_curse", description: "Lifts all curses from your gear.", minFloor: 5 },
];

// ─── Set items (expanded for new slots) ───
const SET_ITEMS: ItemTemplate[] = [
  // Shadowsteel (4 pieces)
  { name: "Shadowsteel Blade", type: "weapon", glyph: "†", baseValue: 6, description: "Dark metal that drinks blood. (Shadowsteel 1/4)", setId: "shadowsteel" },
  { name: "Shadowsteel Mail", type: "chest", glyph: "[", baseValue: 4, description: "Armor that hungers. (Shadowsteel 2/4)", setId: "shadowsteel" },
  { name: "Shadowsteel Ring", type: "ring", glyph: "°", baseValue: 3, description: "Pulses with dark energy. (Shadowsteel 3/4)", setId: "shadowsteel" },
  { name: "Shadowsteel Helm", type: "helmet", glyph: "^", baseValue: 3, description: "Shadows veil your face. (Shadowsteel 4/4)", setId: "shadowsteel" },
  // Dragonfire (4 pieces)
  { name: "Dragonfire Sword", type: "weapon", glyph: "†", baseValue: 7, description: "Forged in dragon's breath. (Dragonfire 1/4)", setId: "dragonfire" },
  { name: "Dragonfire Plate", type: "chest", glyph: "[", baseValue: 5, description: "Scales still smolder. (Dragonfire 2/4)", setId: "dragonfire" },
  { name: "Dragonfire Band", type: "ring", glyph: "°", baseValue: 3, description: "Warm to the touch. (Dragonfire 3/4)", setId: "dragonfire" },
  { name: "Dragonfire Greaves", type: "legs", glyph: "=", baseValue: 4, description: "Ember trails follow your steps. (Dragonfire 4/4)", setId: "dragonfire" },
  // Guardian (4 pieces)
  { name: "Guardian Mace", type: "weapon", glyph: "T", baseValue: 5, description: "The protector's weapon. (Guardian 1/4)", setId: "guardian" },
  { name: "Guardian Shield", type: "chest", glyph: "[", baseValue: 6, description: "An immovable wall. (Guardian 2/4)", setId: "guardian" },
  { name: "Guardian Signet", type: "ring", glyph: "°", baseValue: 10, description: "Hallmark of the sworn. (Guardian 3/4)", setId: "guardian" },
  { name: "Guardian Boots", type: "boots", glyph: "}", baseValue: 4, description: "Stand firm, never retreat. (Guardian 4/4)", setId: "guardian" },
  // Wraith (4 pieces — new set)
  { name: "Wraith Blade", type: "weapon", glyph: "†", baseValue: 8, description: "Phases through armor. (Wraith 1/4)", setId: "wraith" },
  { name: "Wraith Cloak", type: "chest", glyph: "(", baseValue: 5, description: "You flicker in and out of sight. (Wraith 2/4)", setId: "wraith" },
  { name: "Wraith Amulet", type: "amulet", glyph: "\"", baseValue: 5, description: "Cold radiates from the pendant. (Wraith 3/4)", setId: "wraith" },
  { name: "Wraith Gloves", type: "gloves", glyph: "{", baseValue: 4, description: "Your touch chills to the bone. (Wraith 4/4)", setId: "wraith" },
];

const RARITY_MULTIPLIER: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 1.25,
  rare: 1.5,
  epic: 2,
  legendary: 3,
  mythic: 4,
  ancient: 5.5,
  divine: 8,
};

const RARITY_PREFIX: Record<ItemRarity, string> = {
  common: "",
  uncommon: "Sturdy ",
  rare: "Fine ",
  epic: "Masterwork ",
  legendary: "Legendary ",
  mythic: "Mythic ",
  ancient: "Ancient ",
  divine: "Divine ",
};

// All equippable template pools
const EQUIP_POOLS: ItemTemplate[][] = [
  WEAPONS, HELMETS, CHESTS, LEGS, BOOTS, GLOVES, RINGS, AMULETS, BRACELETS,
];

let itemCounter = 0;

export function generateItem(floor: number, rarity: ItemRarity): Item {
  // Chance to generate a scroll (12%)
  if (Math.random() < 0.12) {
    return generateScroll(floor, rarity);
  }

  // Chance to generate a set item (8% on epic+, floor 4+)
  const epicPlus = rarity !== "common" && rarity !== "uncommon" && rarity !== "rare";
  if (floor >= 4 && epicPlus && Math.random() < 0.08) {
    return generateSetItem(floor, rarity);
  }

  // Normal item generation — weighted distribution
  const roll = Math.random();
  let templates: ItemTemplate[];
  if (roll < 0.20) templates = POTIONS;
  else if (roll < 0.35) templates = WEAPONS;
  else if (roll < 0.45) templates = CHESTS;
  else if (roll < 0.52) templates = HELMETS;
  else if (roll < 0.59) templates = LEGS;
  else if (roll < 0.65) templates = BOOTS;
  else if (roll < 0.71) templates = GLOVES;
  else if (roll < 0.80) templates = RINGS;
  else if (roll < 0.90) templates = AMULETS;
  else templates = BRACELETS;

  const maxIdx = Math.min(templates.length - 1, Math.floor(floor / 2));
  const idx = Math.floor(Math.random() * (maxIdx + 1));
  const template = templates[idx];

  const multiplier = RARITY_MULTIPLIER[rarity];
  const prefix = RARITY_PREFIX[rarity];

  const item: Item = {
    id: `item-${++itemCounter}-${Date.now()}`,
    name: `${prefix}${template.name}`,
    type: template.type,
    rarity,
    value: Math.round(template.baseValue * multiplier) + Math.floor(floor * 0.5),
    glyph: template.glyph,
    description: template.description,
  };

  // 10% chance to be cursed on rare+ equipment
  if (
    rarity !== "common" &&
    template.type !== "potion" &&
    Math.random() < 0.10
  ) {
    item.cursed = true;
    item.value = Math.round(item.value * 1.3);
    item.name = `Cursed ${item.name}`;
    item.description = `${item.description} It radiates a dark aura.`;
  }

  return item;
}

function generateScroll(floor: number, rarity: ItemRarity): Item {
  const available = SCROLLS.filter((s) => floor >= s.minFloor);
  const scroll = available[Math.floor(Math.random() * available.length)];

  return {
    id: `scroll-${++itemCounter}-${Date.now()}`,
    name: scroll.name,
    type: "scroll",
    rarity,
    value: 0,
    glyph: "?",
    description: scroll.description,
    scrollEffect: scroll.effect,
  };
}

function generateSetItem(floor: number, rarity: ItemRarity): Item {
  const template = SET_ITEMS[Math.floor(Math.random() * SET_ITEMS.length)];
  const multiplier = RARITY_MULTIPLIER[rarity];

  return {
    id: `set-${++itemCounter}-${Date.now()}`,
    name: template.name,
    type: template.type,
    rarity,
    value: Math.round(template.baseValue * multiplier) + Math.floor(floor * 0.5),
    glyph: template.glyph,
    description: template.description,
    setId: template.setId,
  };
}

// ─── Set bonus descriptions ───
export const SET_BONUSES: Record<string, { name: string; pieces: number; description: string }> = {
  shadowsteel: { name: "Shadowsteel", pieces: 2, description: "2pc: Attacks inflict bleed. 4pc: +5 ATK" },
  dragonfire: { name: "Dragonfire", pieces: 2, description: "2pc: Crits cause burning. 4pc: +10% crit" },
  guardian: { name: "Guardian", pieces: 2, description: "2pc: Reflect 1 damage. 4pc: +15 max HP" },
  wraith: { name: "Wraith", pieces: 2, description: "2pc: +10% dodge. 4pc: Attacks ignore 3 DEF" },
};

// ─── Count equipped set pieces ───
export function countSetPieces(equipment: import("./types").Equipment, setId: string): number {
  let count = 0;
  const slots: Array<keyof import("./types").Equipment> = [
    "weapon", "helmet", "chest", "legs", "boots", "gloves", "ring", "amulet", "bracelet",
  ];
  for (const slot of slots) {
    if (equipment[slot]?.setId === setId) count++;
  }
  return count;
}

// ─── Generate shop inventory ───
export function generateShopItems(floor: number): Item[] {
  const items: Item[] = [];
  const numItems = 4 + Math.min(Math.floor(floor / 2), 4); // 4-8 items

  for (let i = 0; i < numItems; i++) {
    const roll = Math.random();
    const rarity: ItemRarity = roll < 0.3 ? "common" : roll < 0.7 ? "rare" : roll < 0.92 ? "epic" : "legendary";
    const item = generateItem(floor, rarity);
    const priceMultiplier: Record<ItemRarity, number> = { common: 3, uncommon: 4, rare: 5, epic: 8, legendary: 14, mythic: 22, ancient: 35, divine: 60 };
    item.value = Math.max(5, Math.round(item.value * priceMultiplier[item.rarity]));
    items.push(item);
  }

  // Always include at least one healing potion
  const hasPotion = items.some((i) => i.type === "potion");
  if (!hasPotion) {
    const healingPotion: Item = {
      id: `shop-potion-${Date.now()}`,
      name: "Healing Potion",
      type: "potion",
      rarity: "common",
      value: 15 + floor * 3,
      glyph: "!",
      description: "A reliable restorative brew.",
    };
    items[items.length - 1] = healingPotion;
  }

  return items;
}

// ─── Generate a starting potion (for meta-progression) ───
export function generatePotion(rarity: "common" | "uncommon"): Item {
  const template = rarity === "uncommon" ? POTIONS[1] : POTIONS[0]; // Healing Potion or Healing Vial
  const multiplier = RARITY_MULTIPLIER[rarity];
  const prefix = RARITY_PREFIX[rarity];
  return {
    id: `start-potion-${Date.now()}`,
    name: `${prefix}${template.name}`,
    type: "potion",
    rarity,
    value: Math.round(template.baseValue * multiplier),
    glyph: template.glyph,
    description: template.description,
  };
}
