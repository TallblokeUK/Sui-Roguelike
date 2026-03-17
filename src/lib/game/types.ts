// ─── Tile types ───
export enum TileType {
  Wall = "wall",
  Floor = "floor",
  Corridor = "corridor",
  StairsDown = "stairs_down",
  Door = "door",
}

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

// ─── Items ───
export type ItemRarity = "common" | "rare" | "epic" | "legendary";
export type ItemType = "weapon" | "armor" | "potion" | "ring";

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  // stat bonus or heal amount
  value: number;
  glyph: string;
  description: string;
}

// ─── Equipment slots ───
export interface Equipment {
  weapon: Item | null;
  armor: Item | null;
  ring: Item | null;
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
}

// ─── Dungeon tile ───
export interface Tile {
  type: TileType;
  visible: boolean; // currently in FOV
  revealed: boolean; // previously seen
  item: Item | null;
}

// ─── Room (for generation) ───
export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─── Log entry ───
export interface LogEntry {
  text: string;
  type: "info" | "combat" | "loot" | "danger" | "level" | "death";
}

// ─── Game phase ───
export type GamePhase = "naming" | "playing" | "dead" | "victory";

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
  | { type: "START_GAME"; name: string; heroObjectId: string }
  | { type: "MOVE"; direction: Direction }
  | { type: "DESCEND" }
  | { type: "PICKUP" }
  | { type: "USE_ITEM"; itemId: string }
  | { type: "EQUIP_ITEM"; itemId: string }
  | { type: "DROP_ITEM"; itemId: string }
  | { type: "WAIT" }
  | { type: "RESET" };

// ─── Constants ───
export const MAP_WIDTH = 48;
export const MAP_HEIGHT = 28;
export const MAX_ROOMS = 9;
export const ROOM_MIN_SIZE = 4;
export const ROOM_MAX_SIZE = 9;
export const FOV_RADIUS = 6;
export const XP_PER_LEVEL = 20;
export const MAX_INVENTORY = 10;
