import {
  type Tile,
  type Room,
  type Position,
  type Monster,
  type Item,
  type ItemRarity,
  TileType,
  MAP_WIDTH,
  MAP_HEIGHT,
  MAX_ROOMS,
  ROOM_MIN_SIZE,
  ROOM_MAX_SIZE,
  FOV_RADIUS,
} from "./types";
import { MONSTER_TEMPLATES } from "./monsters";
import { generateItem } from "./items";

// ─── Seeded random (simple LCG) ───
let seed = Date.now();
export function setSeed(s: number) { seed = s; }
function rand(): number {
  seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

// ─── Create empty map ───
function createEmptyMap(): Tile[][] {
  const map: Tile[][] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      row.push({ type: TileType.Wall, visible: false, revealed: false, item: null });
    }
    map.push(row);
  }
  return map;
}

// ─── Carve a room into the map ───
function carveRoom(map: Tile[][], room: Room) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH) {
        map[y][x].type = TileType.Floor;
      }
    }
  }
}

// ─── Carve corridors between two points ───
function carveCorridor(map: Tile[][], from: Position, to: Position) {
  let { x, y } = from;
  const horizontal = rand() > 0.5;

  if (horizontal) {
    // Go horizontal first, then vertical
    while (x !== to.x) {
      if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
        if (map[y][x].type === TileType.Wall) map[y][x].type = TileType.Corridor;
      }
      x += x < to.x ? 1 : -1;
    }
    while (y !== to.y) {
      if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
        if (map[y][x].type === TileType.Wall) map[y][x].type = TileType.Corridor;
      }
      y += y < to.y ? 1 : -1;
    }
  } else {
    // Go vertical first, then horizontal
    while (y !== to.y) {
      if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
        if (map[y][x].type === TileType.Wall) map[y][x].type = TileType.Corridor;
      }
      y += y < to.y ? 1 : -1;
    }
    while (x !== to.x) {
      if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
        if (map[y][x].type === TileType.Wall) map[y][x].type = TileType.Corridor;
      }
      x += x < to.x ? 1 : -1;
    }
  }
  // Carve final tile
  if (to.x >= 0 && to.x < MAP_WIDTH && to.y >= 0 && to.y < MAP_HEIGHT) {
    if (map[to.y][to.x].type === TileType.Wall) map[to.y][to.x].type = TileType.Corridor;
  }
}

// ─── Room center ───
function roomCenter(room: Room): Position {
  return {
    x: Math.floor(room.x + room.w / 2),
    y: Math.floor(room.y + room.h / 2),
  };
}

// ─── Check room overlap ───
function roomsOverlap(a: Room, b: Room, padding = 1): boolean {
  return (
    a.x - padding < b.x + b.w + padding &&
    a.x + a.w + padding > b.x - padding &&
    a.y - padding < b.y + b.h + padding &&
    a.y + a.h + padding > b.y - padding
  );
}

// ─── Generate a dungeon floor ───
export function generateDungeon(floor: number): {
  map: Tile[][];
  rooms: Room[];
  playerStart: Position;
  monsters: Monster[];
} {
  const map = createEmptyMap();
  const rooms: Room[] = [];

  // Place rooms
  for (let attempt = 0; attempt < 100 && rooms.length < MAX_ROOMS; attempt++) {
    const w = randInt(ROOM_MIN_SIZE, ROOM_MAX_SIZE);
    const h = randInt(ROOM_MIN_SIZE, ROOM_MAX_SIZE - 1);
    const x = randInt(1, MAP_WIDTH - w - 1);
    const y = randInt(1, MAP_HEIGHT - h - 1);
    const newRoom: Room = { x, y, w, h };

    if (!rooms.some((r) => roomsOverlap(r, newRoom))) {
      carveRoom(map, newRoom);
      if (rooms.length > 0) {
        carveCorridor(map, roomCenter(rooms[rooms.length - 1]), roomCenter(newRoom));
      }
      rooms.push(newRoom);
    }
  }

  // Place stairs in last room
  if (rooms.length > 1) {
    const lastRoom = rooms[rooms.length - 1];
    const stairsPos = roomCenter(lastRoom);
    map[stairsPos.y][stairsPos.x].type = TileType.StairsDown;
  }

  // Player starts in first room
  const playerStart = roomCenter(rooms[0]);

  // Place monsters (skip first room — player spawn)
  const monsters: Monster[] = [];
  for (let i = 1; i < rooms.length; i++) {
    const numMonsters = randInt(0, Math.min(2 + Math.floor(floor / 3), 4));
    for (let m = 0; m < numMonsters; m++) {
      const room = rooms[i];
      const pos: Position = {
        x: randInt(room.x + 1, room.x + room.w - 2),
        y: randInt(room.y + 1, room.y + room.h - 2),
      };
      // Don't place on stairs
      if (map[pos.y][pos.x].type === TileType.StairsDown) continue;
      // Don't stack monsters
      if (monsters.some((mon) => mon.pos.x === pos.x && mon.pos.y === pos.y)) continue;

      const template = pickMonster(floor);
      const scaledHp = template.hp + Math.floor(floor * 1.5);
      const scaledAtk = template.atk + Math.floor(floor * 0.5);
      const scaledDef = template.def + Math.floor(floor * 0.3);

      monsters.push({
        ...template,
        id: `m-${i}-${m}-${Date.now()}`,
        hp: scaledHp,
        maxHp: scaledHp,
        atk: scaledAtk,
        def: scaledDef,
        xpReward: template.xpReward + floor,
        pos,
      });
    }
  }

  // Place items in rooms (skip first room)
  for (let i = 1; i < rooms.length; i++) {
    if (rand() < 0.45) {
      const room = rooms[i];
      const pos: Position = {
        x: randInt(room.x + 1, room.x + room.w - 2),
        y: randInt(room.y + 1, room.y + room.h - 2),
      };
      if (
        map[pos.y][pos.x].type !== TileType.StairsDown &&
        !monsters.some((mon) => mon.pos.x === pos.x && mon.pos.y === pos.y) &&
        !map[pos.y][pos.x].item
      ) {
        map[pos.y][pos.x].item = generateItem(floor, rollRarity());
      }
    }
  }

  return { map, rooms, playerStart, monsters };
}

// ─── Pick monster based on floor ───
function pickMonster(floor: number) {
  const available = MONSTER_TEMPLATES.filter((m) => floor >= m.minFloor);
  return { ...available[randInt(0, available.length - 1)] };
}

// ─── Roll rarity ───
function rollRarity(): ItemRarity {
  const roll = rand();
  if (roll < 0.5) return "common";
  if (roll < 0.8) return "rare";
  if (roll < 0.95) return "epic";
  return "legendary";
}

// ─── Field of view (simple raycasting) ───
export function computeFOV(map: Tile[][], center: Position): Tile[][] {
  // Reset visibility
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      map[y][x].visible = false;
    }
  }

  // Cast rays in all directions
  const steps = 72; // number of rays
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    let x = center.x + 0.5;
    let y = center.y + 0.5;

    for (let step = 0; step < FOV_RADIUS; step++) {
      const tileX = Math.floor(x);
      const tileY = Math.floor(y);

      if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) break;

      map[tileY][tileX].visible = true;
      map[tileY][tileX].revealed = true;

      if (map[tileY][tileX].type === TileType.Wall) break;

      x += dx;
      y += dy;
    }
  }

  return map;
}

// ─── Check if a tile is walkable ───
export function isWalkable(tile: Tile): boolean {
  return tile.type !== TileType.Wall;
}
