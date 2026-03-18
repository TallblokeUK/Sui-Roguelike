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
  { name: "Short Sword", type: "weapon", glyph: "†", baseValue: 3, description: "Quick and dependable." },
  { name: "Iron Sword", type: "weapon", glyph: "†", baseValue: 4, description: "Reliable and sharp." },
  { name: "Warhammer", type: "weapon", glyph: "T", baseValue: 5, description: "Crushes bone and armor alike." },
  { name: "Battleaxe", type: "weapon", glyph: "¶", baseValue: 6, description: "Heavy, devastating strikes." },
  { name: "Cursed Scimitar", type: "weapon", glyph: "†", baseValue: 7, description: "Whispers of its former owner." },
  { name: "Flamebrand", type: "weapon", glyph: "†", baseValue: 8, description: "The blade flickers with inner fire." },
  { name: "Frostbite Spear", type: "weapon", glyph: "/", baseValue: 9, description: "Piercing cold radiates from the tip." },
  { name: "Voidcleaver", type: "weapon", glyph: "†", baseValue: 11, description: "Cuts through reality itself." },
  { name: "Soulshard Blade", type: "weapon", glyph: "†", baseValue: 13, description: "Hums with captured souls." },
];

const ARMORS: ItemTemplate[] = [
  { name: "Leather Vest", type: "armor", glyph: "[", baseValue: 1, description: "Basic protection." },
  { name: "Studded Leather", type: "armor", glyph: "[", baseValue: 2, description: "Reinforced with iron rivets." },
  { name: "Chain Mail", type: "armor", glyph: "[", baseValue: 3, description: "Interlinked iron rings." },
  { name: "Scale Mail", type: "armor", glyph: "[", baseValue: 4, description: "Overlapping metal scales." },
  { name: "Plate Armor", type: "armor", glyph: "[", baseValue: 5, description: "Heavy but resilient." },
  { name: "Shadow Cloak", type: "armor", glyph: "(", baseValue: 4, description: "Woven from darkness itself." },
  { name: "Dragonhide Vest", type: "armor", glyph: "[", baseValue: 7, description: "Scales of a fallen wyrm." },
  { name: "Ethereal Plate", type: "armor", glyph: "[", baseValue: 9, description: "Phase-shifts to deflect blows." },
];

const POTIONS: ItemTemplate[] = [
  { name: "Healing Vial", type: "potion", glyph: "!", baseValue: 10, description: "Restores a little health." },
  { name: "Healing Potion", type: "potion", glyph: "!", baseValue: 18, description: "A reliable restorative brew." },
  { name: "Greater Healing Potion", type: "potion", glyph: "!", baseValue: 28, description: "Potent restorative elixir." },
  { name: "Elixir of Vitality", type: "potion", glyph: "!", baseValue: 40, description: "Fully mends grievous wounds." },
  { name: "Phoenix Tears", type: "potion", glyph: "!", baseValue: 55, description: "Liquid fire that heals all." },
];

const RINGS: ItemTemplate[] = [
  { name: "Ring of Strength", type: "ring", glyph: "°", baseValue: 2, description: "+ATK while worn." },
  { name: "Ring of Protection", type: "ring", glyph: "°", baseValue: 2, description: "+DEF while worn." },
  { name: "Ring of Vitality", type: "ring", glyph: "°", baseValue: 8, description: "+Max HP while worn." },
  { name: "Ring of the Berserker", type: "ring", glyph: "°", baseValue: 4, description: "+ATK while worn." },
  { name: "Ring of the Sentinel", type: "ring", glyph: "°", baseValue: 4, description: "+DEF while worn." },
  { name: "Ring of Regeneration", type: "ring", glyph: "°", baseValue: 15, description: "+Max HP while worn." },
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
  if (roll < 0.30) templates = POTIONS;
  else if (roll < 0.55) templates = WEAPONS;
  else if (roll < 0.80) templates = ARMORS;
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
