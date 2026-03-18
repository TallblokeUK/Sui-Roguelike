// ─── Tile types ───
export enum TileType {
  Wall = "wall",
  Floor = "floor",
  Corridor = "corridor",
  StairsDown = "stairs_down",
  Door = "door",
  Trap = "trap",
  Water = "water",
  SecretDoor = "secret_door",
}

// ─── Trap data ───
export type TrapType = "spike" | "poison_dart" | "teleport" | "alarm";

export interface TrapData {
  trapType: TrapType;
  triggered: boolean;
  damage: number;
}

// ─── Room types ───
export type RoomType = "normal" | "vault" | "arena" | "shrine" | "shop";

// ─── Direction ───
export type Direction = "up" | "down" | "left" | "right";

export const DIR_OFFSETS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// ─── Position ───
export interface Position {
  x: number;
  y: number;
}

// ─── Status Effects ───
export type StatusEffectType = "poison" | "bleed" | "stun" | "burning";

export interface StatusEffect {
  type: StatusEffectType;
  turnsRemaining: number;
  damagePerTurn: number;
  source: string;
}

// ─── Abilities ───
export interface Ability {
  id: string;
  name: string;
  description: string;
  energyCost: number;
  cooldown: number;
  currentCooldown: number;
  range: number; // 1 = melee, 2+ = ranged
}

// ─── Items ───
export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic" | "ancient" | "divine";
export type ItemType = "weapon" | "helmet" | "chest" | "legs" | "boots" | "gloves" | "ring" | "amulet" | "bracelet" | "potion" | "scroll";
export type ScrollEffect = "teleport" | "mapping" | "fire" | "frost" | "enchant" | "remove_curse";

// Slots that can be equipped
export type EquipSlotKey = "weapon" | "helmet" | "chest" | "legs" | "boots" | "gloves" | "ring" | "amulet" | "bracelet";

// Map item type to equipment slot (consumables excluded)
export const ITEM_TYPE_TO_SLOT: Partial<Record<ItemType, EquipSlotKey>> = {
  weapon: "weapon",
  helmet: "helmet",
  chest: "chest",
  legs: "legs",
  boots: "boots",
  gloves: "gloves",
  ring: "ring",
  amulet: "amulet",
  bracelet: "bracelet",
};

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  // stat bonus or heal amount
  value: number;
  glyph: string;
  description: string;
  scrollEffect?: ScrollEffect;
  cursed?: boolean;
  setId?: string; // items with same setId form a set
}

// ─── Equipment slots ───
export interface Equipment {
  weapon: Item | null;
  helmet: Item | null;
  chest: Item | null;
  legs: Item | null;
  boots: Item | null;
  gloves: Item | null;
  ring: Item | null;
  amulet: Item | null;
  bracelet: Item | null;
}

// ─── Monster ───
export interface Monster {
  id: string;
  name: string;
  glyph: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  xpReward: number;
  pos: Position;
  color: string; // tailwind color class
  statusEffects: StatusEffect[];
  behavior: "melee" | "ranged";
  rangedRange?: number; // for ranged attackers
  statusOnHit?: { type: StatusEffectType; chance: number; duration: number; damage: number };
  special?: "pack" | "regenerate" | "summoner" | "mimic";
  isBoss?: boolean;
  disguised?: boolean; // mimics: renders as item until revealed
}

// ─── Passive effects (from level-up choices) ───
export type PassiveEffect =
  | "vampiric_touch"    // heal 3 HP on kill
  | "poison_resistance" // immune to poison
  | "thick_skin"        // -1 all damage taken (min 1)
  | "relentless";       // +1 energy regen per turn

// ─── Level-up choice ───
export interface LevelUpChoice {
  id: string;
  name: string;
  description: string;
}

// ─── Hero ───
export interface Hero {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  xp: number;
  level: number;
  pos: Position;
  inventory: Item[];
  equipment: Equipment;
  dodge: number; // percentage chance to dodge (0-100)
  critChance: number; // percentage chance for critical hit (0-100)
  energy: number;
  maxEnergy: number;
  statusEffects: StatusEffect[];
  abilities: Ability[];
  passives: PassiveEffect[];
  chosenPerks: string[]; // display names of all level-up choices taken
  gold: number;
}

// ─── Attack result (for combat log) ───
export interface AttackResult {
  damage: number;
  isCrit: boolean;
  isDodged: boolean;
  statusApplied?: StatusEffect;
}

// ─── Dungeon tile ───
export interface Tile {
  type: TileType;
  visible: boolean; // currently in FOV
  revealed: boolean; // previously seen
  item: Item | null;
  trap?: TrapData;
  doorOpen?: boolean;
}

// ─── Room (for generation) ───
export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  roomType: RoomType;
}

// ─── Log entry ───
export interface LogEntry {
  text: string;
  type: "info" | "combat" | "loot" | "danger" | "level" | "death" | "ability" | "status";
}

// ─── Game phase ───
export type GamePhase = "naming" | "playing" | "dead" | "victory" | "level_up";

// ─── Game state ───
export interface GameState {
  phase: GamePhase;
  hero: Hero;
  floor: number;
  map: Tile[][];
  mapWidth: number;
  mapHeight: number;
  monsters: Monster[];
  rooms: Room[];
  log: LogEntry[];
  turnsElapsed: number;
  killCount: number;
  causeOfDeath: string;
  heroObjectId: string;
  pendingAbility: string | null; // ability waiting for directional input
  levelUpChoices: LevelUpChoice[]; // 3 choices offered on level-up
  shopItems: Item[]; // items available in the current shop
  shopOpen: boolean; // whether the shop UI is open
}

// ─── Leaderboard ───
export interface LeaderboardEntry {
  hero_name: string;
  player_name: string;
  level: number;
  floor: number;
  kills: number;
  turns: number;
  cause_of_death: string;
  created_at: string;
}

// ─── Actions ───
export type GameAction =
  | { type: "START_GAME"; name: string; heroObjectId: string; metaBonuses?: import("./meta-progression").MetaBonuses }
  | { type: "MOVE"; direction: Direction }
  | { type: "DESCEND" }
  | { type: "PICKUP" }
  | { type: "USE_ITEM"; itemId: string }
  | { type: "EQUIP_ITEM"; itemId: string }
  | { type: "DROP_ITEM"; itemId: string }
  | { type: "WAIT" }
  | { type: "ABANDON" }
  | { type: "RESET" }
  | { type: "USE_ABILITY"; abilityIndex: number; direction?: Direction }
  | { type: "INTERACT" }
  | { type: "CHOOSE_LEVEL_UP"; choiceIndex: number }
  | { type: "BUY_ITEM"; itemIndex: number }
  | { type: "CLOSE_SHOP" }
  | { type: "LOAD_SAVE"; state: GameState };

// ─── Constants ───
export const MAP_WIDTH = 48;
export const MAP_HEIGHT = 28;
export const MAX_ROOMS = 9;
export const ROOM_MIN_SIZE = 4;
export const ROOM_MAX_SIZE = 9;
export const FOV_RADIUS = 6;
export const XP_PER_LEVEL = 20;
export const MAX_INVENTORY = 15;
