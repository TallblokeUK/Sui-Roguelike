import type { Item, ItemRarity, ItemType } from "./types";

interface ItemTemplate {
  name: string;
  type: ItemType;
  glyph: string;
  baseValue: number;
  description: string;
}

const WEAPONS: ItemTemplate[] = [
  { name: "Rusty Dagger", type: "weapon", glyph: "†", baseValue: 2, description: "A corroded blade. Better than fists." },
  { name: "Iron Sword", type: "weapon", glyph: "†", baseValue: 3, description: "Reliable and sharp." },
  { name: "Battleaxe", type: "weapon", glyph: "¶", baseValue: 5, description: "Heavy, devastating strikes." },
  { name: "Flamebrand", type: "weapon", glyph: "†", baseValue: 7, description: "The blade flickers with inner fire." },
  { name: "Soulshard Blade", type: "weapon", glyph: "†", baseValue: 10, description: "Hums with captured souls." },
];

const ARMORS: ItemTemplate[] = [
  { name: "Leather Vest", type: "armor", glyph: "[", baseValue: 1, description: "Basic protection." },
  { name: "Chain Mail", type: "armor", glyph: "[", baseValue: 3, description: "Interlinked iron rings." },
  { name: "Plate Armor", type: "armor", glyph: "[", baseValue: 5, description: "Heavy but resilient." },
  { name: "Shadow Cloak", type: "armor", glyph: "[", baseValue: 4, description: "Woven from darkness itself." },
];

const POTIONS: ItemTemplate[] = [
  { name: "Healing Vial", type: "potion", glyph: "!", baseValue: 10, description: "Restores health." },
  { name: "Greater Healing Potion", type: "potion", glyph: "!", baseValue: 20, description: "Potent restorative brew." },
  { name: "Elixir of Vitality", type: "potion", glyph: "!", baseValue: 35, description: "Fully mends wounds." },
];

const RINGS: ItemTemplate[] = [
  { name: "Ring of Strength", type: "ring", glyph: "°", baseValue: 2, description: "+ATK while worn." },
  { name: "Ring of Protection", type: "ring", glyph: "°", baseValue: 2, description: "+DEF while worn." },
  { name: "Ring of Vitality", type: "ring", glyph: "°", baseValue: 5, description: "+MaxHP while worn." },
];

const RARITY_MULTIPLIER: Record<ItemRarity, number> = {
  common: 1,
  rare: 1.5,
  epic: 2,
  legendary: 3,
};

const RARITY_PREFIX: Record<ItemRarity, string> = {
  common: "",
  rare: "Fine ",
  epic: "Masterwork ",
  legendary: "Legendary ",
};

let itemCounter = 0;

export function generateItem(floor: number, rarity: ItemRarity): Item {
  // Pick a category — potions are more common
  const roll = Math.random();
  let templates: ItemTemplate[];
  if (roll < 0.35) templates = POTIONS;
  else if (roll < 0.6) templates = WEAPONS;
  else if (roll < 0.85) templates = ARMORS;
  else templates = RINGS;

  // Pick template weighted toward higher-tier items on deeper floors
  const maxIdx = Math.min(templates.length - 1, Math.floor(floor / 2));
  const idx = Math.floor(Math.random() * (maxIdx + 1));
  const template = templates[idx];

  const multiplier = RARITY_MULTIPLIER[rarity];
  const prefix = RARITY_PREFIX[rarity];

  return {
    id: `item-${++itemCounter}-${Date.now()}`,
    name: `${prefix}${template.name}`,
    type: template.type,
    rarity,
    value: Math.round(template.baseValue * multiplier) + Math.floor(floor * 0.5),
    glyph: template.glyph,
    description: template.description,
  };
}
