import {
  type Tile,
  type Room,
  type Position,
  type Monster,
  type ItemRarity,
  type TrapData,
  type RoomType,
  TileType,
  MAP_WIDTH,
  MAP_HEIGHT,
  MAX_ROOMS,
  ROOM_MIN_SIZE,
  ROOM_MAX_SIZE,
  FOV_RADIUS,
} from "./types";
import { MONSTER_TEMPLATES, getBossForFloor } from "./monsters";
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

// ─── Assign room types based on floor depth ───
function assignRoomType(roomIndex: number, totalRooms: number, floor: number): RoomType {
  // First room is always normal (player spawn), last room has stairs
  if (roomIndex === 0 || roomIndex === totalRooms - 1) return "normal";

  const roll = rand();

  // Vault rooms: small, guarded, guaranteed rare+ loot (floor 2+)
  if (floor >= 2 && roll < 0.12) return "vault";

  // Arena rooms: large, extra monsters, columns (floor 3+)
  if (floor >= 3 && roll < 0.22) return "arena";

  // Shrine rooms: single interactable shrine (floor 2+)
  if (floor >= 2 && roll < 0.28) return "shrine";

  // Shop rooms (floor 3+, ~8% chance)
  if (floor >= 3 && roll < 0.36) return "shop";

  return "normal";
}

// ─── Place doors at room-corridor boundaries ───
// A door is placed where a 1-tile-wide passage connects a corridor to a room.
// The tile must have walls on two opposite sides (chokepoint) and at least one
// Floor neighbor (room edge) — this prevents doors in the middle of corridors.
function placeDoors(map: Tile[][]) {
  const isOpen = (t: Tile | undefined) =>
    t && (t.type === TileType.Floor || t.type === TileType.Corridor);
  const isWall = (t: Tile | undefined) =>
    !t || t.type === TileType.Wall;

  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      const tile = map[y][x];
      if (tile.type !== TileType.Floor && tile.type !== TileType.Corridor) continue;

      const n = map[y - 1]?.[x];
      const s = map[y + 1]?.[x];
      const w = map[y]?.[x - 1];
      const e = map[y]?.[x + 1];

      // Horizontal doorway: walls north+south, open east+west
      // Must have at least one Floor neighbor (room boundary, not mid-corridor)
      if (isWall(n) && isWall(s) && isOpen(w) && isOpen(e)) {
        if (w!.type === TileType.Floor || e!.type === TileType.Floor) {
          map[y][x] = { ...tile, type: TileType.Door, doorOpen: false };
        }
      }
      // Vertical doorway: walls east+west, open north+south
      else if (isWall(w) && isWall(e) && isOpen(n) && isOpen(s)) {
        if (n!.type === TileType.Floor || s!.type === TileType.Floor) {
          map[y][x] = { ...tile, type: TileType.Door, doorOpen: false };
        }
      }
    }
  }
}

// ─── Place columns in arena rooms ───
function placeColumns(map: Tile[][], room: Room) {
  // Place columns in a grid pattern every 3 tiles
  for (let y = room.y + 2; y < room.y + room.h - 2; y += 3) {
    for (let x = room.x + 2; x < room.x + room.w - 2; x += 3) {
      if (x < MAP_WIDTH && y < MAP_HEIGHT) {
        map[y][x].type = TileType.Wall; // column
      }
    }
  }
}

// ─── Place water pools in rooms ───
function placeWaterPool(map: Tile[][], room: Room) {
  const cx = roomCenter(room).x;
  const cy = roomCenter(room).y;
  // Small cluster of 3-5 water tiles around center
  const offsets = [
    { dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
  ];
  const count = randInt(3, 5);
  for (let i = 0; i < count; i++) {
    const off = offsets[i];
    const wx = cx + off.dx;
    const wy = cy + off.dy;
    if (wx > room.x && wx < room.x + room.w - 1 &&
        wy > room.y && wy < room.y + room.h - 1 &&
        map[wy][wx].type === TileType.Floor) {
      map[wy][wx].type = TileType.Water;
    }
  }
}

// ─── Place traps in corridors ───
function placeCorridorTraps(map: Tile[][], floor: number) {
  const trapChance = Math.min(0.04 + floor * 0.01, 0.12); // increases with floor depth

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (map[y][x].type === TileType.Corridor && rand() < trapChance) {
        const trapTypes: Array<{ type: TrapData["trapType"]; damage: number }> = [
          { type: "spike", damage: 3 + Math.floor(floor * 0.5) },
          { type: "poison_dart", damage: 2 },
          { type: "alarm", damage: 0 },
        ];
        if (floor >= 4) {
          trapTypes.push({ type: "teleport", damage: 0 });
        }
        const picked = trapTypes[randInt(0, trapTypes.length - 1)];
        map[y][x] = {
          ...map[y][x],
          type: TileType.Trap,
          trap: {
            trapType: picked.type,
            triggered: false,
            damage: picked.damage,
          },
        };
      }
    }
  }
}

// ─── Create a secret room attached to a random room ───
function placeSecretRoom(map: Tile[][], rooms: Room[], floor: number, monsters: Monster[]) {
  if (rooms.length < 3) return;

  // Pick a non-first, non-last room to attach to
  const hostIdx = randInt(1, rooms.length - 2);
  const host = rooms[hostIdx];

  // Try to place a small 3x3 room adjacent to one of the host's walls
  const sides = ["top", "bottom", "left", "right"];
  for (const side of sides.sort(() => rand() - 0.5)) {
    let sx: number, sy: number;

    if (side === "top" && host.y >= 5) {
      sx = Math.floor(host.x + host.w / 2) - 1;
      sy = host.y - 4;
    } else if (side === "bottom" && host.y + host.h + 4 < MAP_HEIGHT) {
      sx = Math.floor(host.x + host.w / 2) - 1;
      sy = host.y + host.h + 1;
    } else if (side === "left" && host.x >= 5) {
      sx = host.x - 4;
      sy = Math.floor(host.y + host.h / 2) - 1;
    } else if (side === "right" && host.x + host.w + 4 < MAP_WIDTH) {
      sx = host.x + host.w + 1;
      sy = Math.floor(host.y + host.h / 2) - 1;
    } else {
      continue;
    }

    const secretRoom: Room = { x: sx, y: sy, w: 3, h: 3, roomType: "vault" };

    // Check it doesn't overlap existing rooms
    if (rooms.some((r) => roomsOverlap(r, secretRoom, 0))) continue;
    if (sx < 1 || sy < 1 || sx + 3 >= MAP_WIDTH - 1 || sy + 3 >= MAP_HEIGHT - 1) continue;

    // Carve secret room
    carveRoom(map, secretRoom);

    // Place secret door between host and secret room
    let doorX: number, doorY: number;
    if (side === "top") { doorX = sx + 1; doorY = host.y - 1; }
    else if (side === "bottom") { doorX = sx + 1; doorY = host.y + host.h; }
    else if (side === "left") { doorX = host.x - 1; doorY = sy + 1; }
    else { doorX = host.x + host.w; doorY = sy + 1; }

    // Carve the passage between
    if (doorX >= 0 && doorX < MAP_WIDTH && doorY >= 0 && doorY < MAP_HEIGHT) {
      map[doorY][doorX].type = TileType.SecretDoor;
    }

    // Place guaranteed epic+ loot
    const center = roomCenter(secretRoom);
    const rarity = rand() < 0.4 ? "legendary" : "epic";
    map[center.y][center.x].item = generateItem(floor, rarity as ItemRarity);

    return;
  }
}

// ─── Spawn a monster at a position ───
function spawnMonster(floor: number, pos: Position, id: string): Monster {
  const template = pickMonster(floor);
  const scaledHp = template.hp + Math.floor(floor * 1.5);
  const scaledAtk = template.atk + Math.floor(floor * 0.5);
  const scaledDef = template.def + Math.floor(floor * 0.3);

  return {
    id,
    name: template.name,
    glyph: template.glyph,
    color: template.color,
    hp: scaledHp,
    maxHp: scaledHp,
    atk: scaledAtk,
    def: scaledDef,
    xpReward: template.xpReward + floor,
    pos,
    statusEffects: [],
    behavior: template.behavior,
    rangedRange: template.rangedRange,
    statusOnHit: template.statusOnHit,
    special: template.special,
    disguised: template.special === "mimic",
  };
}

// ─── Spawn a boss monster ───
function spawnBoss(floor: number, pos: Position): Monster | null {
  const boss = getBossForFloor(floor);
  if (!boss) return null;

  return {
    id: `boss-${floor}-${Date.now()}`,
    name: boss.name,
    glyph: boss.glyph,
    color: boss.color,
    hp: boss.hp,
    maxHp: boss.hp,
    atk: boss.atk,
    def: boss.def,
    xpReward: boss.xpReward,
    pos,
    statusEffects: [],
    behavior: boss.behavior,
    rangedRange: boss.rangedRange,
    statusOnHit: boss.statusOnHit,
    special: boss.special,
    isBoss: true,
  };
}

// ─── Check if floor has a boss ───
export function isBossFloor(floor: number): boolean {
  return floor > 0 && floor % 5 === 0;
}

// ─── Generate a dungeon floor ───
export function generateDungeon(floor: number): {
  map: Tile[][];
  rooms: Room[];
  playerStart: Position;
  monsters: Monster[];
} {
  _currentFloor = floor;
  const map = createEmptyMap();
  const rooms: Room[] = [];
  const boss = isBossFloor(floor);

  // Place rooms
  for (let attempt = 0; attempt < 100 && rooms.length < MAX_ROOMS; attempt++) {
    const w = randInt(ROOM_MIN_SIZE, ROOM_MAX_SIZE);
    const h = randInt(ROOM_MIN_SIZE, ROOM_MAX_SIZE - 1);
    const x = randInt(1, MAP_WIDTH - w - 1);
    const y = randInt(1, MAP_HEIGHT - h - 1);
    const newRoom: Room = { x, y, w, h, roomType: "normal" };

    if (!rooms.some((r) => roomsOverlap(r, newRoom))) {
      carveRoom(map, newRoom);
      if (rooms.length > 0) {
        carveCorridor(map, roomCenter(rooms[rooms.length - 1]), roomCenter(newRoom));
      }
      rooms.push(newRoom);
    }
  }

  // Boss floors: force the last room into a large arena
  if (boss && rooms.length > 1) {
    const lastRoom = rooms[rooms.length - 1];
    lastRoom.roomType = "arena";
    // Expand last room if possible (make it at least 8x7)
    const expandW = Math.max(lastRoom.w, 8);
    const expandH = Math.max(lastRoom.h, 7);
    if (lastRoom.x + expandW < MAP_WIDTH - 1 && lastRoom.y + expandH < MAP_HEIGHT - 1) {
      // Carve the expanded area
      const oldW = lastRoom.w;
      const oldH = lastRoom.h;
      lastRoom.w = expandW;
      lastRoom.h = expandH;
      carveRoom(map, lastRoom);
      // Re-carve corridor if room grew
      if (expandW !== oldW || expandH !== oldH) {
        carveCorridor(map, roomCenter(rooms[rooms.length - 2]), roomCenter(lastRoom));
      }
    }
    placeColumns(map, lastRoom);
  }

  // Assign room types (skip last room on boss floors — already set to arena)
  for (let i = 0; i < rooms.length; i++) {
    if (boss && i === rooms.length - 1) continue;
    rooms[i].roomType = assignRoomType(i, rooms.length, floor);
  }

  // Decorate rooms based on type
  for (const room of rooms) {
    if (room.roomType === "arena" && !(boss && room === rooms[rooms.length - 1])) {
      placeColumns(map, room);
    }
    if (room.roomType === "normal" && rand() < 0.2) {
      placeWaterPool(map, room);
    }
  }

  // Place doors at room entrances
  placeDoors(map);

  // Place stairs in last room
  if (rooms.length > 1) {
    const lastRoom = rooms[rooms.length - 1];
    const stairsPos = roomCenter(lastRoom);
    map[stairsPos.y][stairsPos.x].type = TileType.StairsDown;
  }

  // Player starts in first room
  const playerStart = roomCenter(rooms[0]);

  // Place monsters
  const monsters: Monster[] = [];

  // Spawn boss in last room
  if (boss && rooms.length > 1) {
    const lastRoom = rooms[rooms.length - 1];
    const bossPos = {
      x: Math.floor(lastRoom.x + lastRoom.w / 2),
      y: Math.floor(lastRoom.y + lastRoom.h / 2) - 1, // offset from stairs
    };
    const bossMonster = spawnBoss(floor, bossPos);
    if (bossMonster) {
      monsters.push(bossMonster);
      // Add 2-3 guards in boss room
      for (let g = 0; g < randInt(2, 3); g++) {
        const gPos: Position = {
          x: randInt(lastRoom.x + 1, lastRoom.x + lastRoom.w - 2),
          y: randInt(lastRoom.y + 1, lastRoom.y + lastRoom.h - 2),
        };
        if (map[gPos.y][gPos.x].type === TileType.Wall) continue;
        if (map[gPos.y][gPos.x].type === TileType.StairsDown) continue;
        if (monsters.some((mon) => mon.pos.x === gPos.x && mon.pos.y === gPos.y)) continue;
        monsters.push(spawnMonster(floor, gPos, `boss-guard-${g}-${Date.now()}`));
      }
    }
  }

  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i];
    // Skip last room on boss floors (boss already placed)
    if (boss && i === rooms.length - 1) continue;

    // No monsters in shop rooms
    if (room.roomType === "shop") continue;

    const maxMons = room.roomType === "arena"
      ? Math.min(4 + Math.floor(floor / 2), 6)
      : Math.min(2 + Math.floor(floor / 3), 4);
    const numMonsters = room.roomType === "vault"
      ? 1
      : randInt(0, maxMons);

    for (let m = 0; m < numMonsters; m++) {
      const pos: Position = {
        x: randInt(room.x + 1, room.x + room.w - 2),
        y: randInt(room.y + 1, room.y + room.h - 2),
      };
      if (map[pos.y][pos.x].type === TileType.StairsDown) continue;
      if (map[pos.y][pos.x].type === TileType.Wall) continue;
      if (map[pos.y][pos.x].type === TileType.Water) continue;
      if (monsters.some((mon) => mon.pos.x === pos.x && mon.pos.y === pos.y)) continue;

      monsters.push(spawnMonster(
        room.roomType === "vault" ? floor + 2 : floor,
        pos,
        `m-${i}-${m}-${Date.now()}`
      ));
    }
  }

  // Place items in rooms (skip first room)
  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i];

    if (room.roomType === "vault") {
      const pos = roomCenter(room);
      if (!monsters.some((mon) => mon.pos.x === pos.x && mon.pos.y === pos.y)) {
        const rarity = rand() < 0.3 ? "epic" : "rare";
        map[pos.y][pos.x].item = generateItem(floor, rarity as ItemRarity);
      }
    } else if (room.roomType === "shrine" || room.roomType === "shop") {
      // Shrine/shop interaction handled in state
    } else if (rand() < 0.45) {
      const pos: Position = {
        x: randInt(room.x + 1, room.x + room.w - 2),
        y: randInt(room.y + 1, room.y + room.h - 2),
      };
      if (
        map[pos.y][pos.x].type !== TileType.StairsDown &&
        map[pos.y][pos.x].type !== TileType.Wall &&
        map[pos.y][pos.x].type !== TileType.Water &&
        !monsters.some((mon) => mon.pos.x === pos.x && mon.pos.y === pos.y) &&
        !map[pos.y][pos.x].item
      ) {
        map[pos.y][pos.x].item = generateItem(floor, rollRarity());
      }
    }
  }

  // Place mimics (floor 4+, 15% chance per non-first room)
  if (floor >= 4) {
    for (let i = 1; i < rooms.length; i++) {
      if (rand() < 0.15) {
        const room = rooms[i];
        const pos: Position = {
          x: randInt(room.x + 1, room.x + room.w - 2),
          y: randInt(room.y + 1, room.y + room.h - 2),
        };
        if (
          map[pos.y][pos.x].type === TileType.Floor &&
          !monsters.some((mon) => mon.pos.x === pos.x && mon.pos.y === pos.y) &&
          !map[pos.y][pos.x].item
        ) {
          const mimicTemplate = MONSTER_TEMPLATES.find((t) => t.special === "mimic")!;
          const scaledHp = mimicTemplate.hp + Math.floor(floor * 1.5);
          monsters.push({
            id: `mimic-${i}-${Date.now()}`,
            name: mimicTemplate.name,
            glyph: mimicTemplate.glyph,
            color: mimicTemplate.color,
            hp: scaledHp,
            maxHp: scaledHp,
            atk: mimicTemplate.atk + Math.floor(floor * 0.5),
            def: mimicTemplate.def + Math.floor(floor * 0.3),
            xpReward: mimicTemplate.xpReward + floor,
            pos,
            statusEffects: [],
            behavior: mimicTemplate.behavior,
            special: "mimic",
            disguised: true,
          });
        }
      }
    }
  }

  // Place traps in corridors (floor 2+)
  if (floor >= 2) {
    placeCorridorTraps(map, floor);
  }

  // Secret room (15% chance, floor 3+, not on boss floors)
  if (floor >= 3 && !boss && rand() < 0.15) {
    placeSecretRoom(map, rooms, floor, monsters);
  }

  return { map, rooms, playerStart, monsters };
}

// ─── Pick monster based on floor ───
function pickMonster(floor: number) {
  const available = MONSTER_TEMPLATES.filter((m) => floor >= m.minFloor);
  return { ...available[randInt(0, available.length - 1)] };
}

// ─── Roll rarity (scaled by floor) ───
// Floor gates: uncommon 1+, rare 2+, epic 4+, legendary 6+, mythic 8+, ancient 11+, divine 14+
let _currentFloor = 1;
function rollRarity(): ItemRarity {
  const f = _currentFloor;
  const roll = rand();

  // Cumulative thresholds — higher floors shift weight toward rarer tiers
  const t = Math.min(f, 15);
  const common    = Math.max(0.20, 0.55 - t * 0.025);
  const uncommon  = common + Math.max(0.10, 0.25 - t * 0.010);
  const rare      = uncommon + (f >= 2 ? Math.min(0.25, 0.10 + t * 0.010) : 0);
  const epic      = rare + (f >= 4 ? Math.min(0.18, 0.03 + t * 0.010) : 0);
  const legendary = epic + (f >= 6 ? Math.min(0.12, 0.01 + t * 0.007) : 0);
  const mythic    = legendary + (f >= 8 ? Math.min(0.06, t * 0.004) : 0);
  const ancient   = mythic + (f >= 11 ? Math.min(0.03, t * 0.002) : 0);

  if (roll < common) return "common";
  if (roll < uncommon) return "uncommon";
  if (roll < rare) return "rare";
  if (roll < epic) return "epic";
  if (roll < legendary) return "legendary";
  if (roll < mythic) return "mythic";
  if (roll < ancient) return "ancient";
  return f >= 14 ? "divine" : f >= 11 ? "ancient" : "legendary";
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
  const steps = 72;
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

      // Walls and closed doors block FOV
      if (map[tileY][tileX].type === TileType.Wall) break;
      if (map[tileY][tileX].type === TileType.SecretDoor) break;
      if (map[tileY][tileX].type === TileType.Door && !map[tileY][tileX].doorOpen) break;

      x += dx;
      y += dy;
    }
  }

  return map;
}

// ─── Check if a tile is walkable ───
export function isWalkable(tile: Tile): boolean {
  if (!tile) return false;
  return tile.type !== TileType.Wall && tile.type !== TileType.SecretDoor;
}

// ─── Get the room containing a position ───
export function getRoomAt(rooms: Room[], pos: Position): Room | undefined {
  return rooms.find(
    (r) => pos.x >= r.x && pos.x < r.x + r.w && pos.y >= r.y && pos.y < r.y + r.h
  );
}
