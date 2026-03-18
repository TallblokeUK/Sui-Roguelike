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
  },
];
