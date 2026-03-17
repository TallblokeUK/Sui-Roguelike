import {
  type GameState,
  type GameAction,
  type Hero,
  type LogEntry,
  type Monster,
  type Item,
  type Position,
  TileType,
  DIR_OFFSETS,
  MAP_WIDTH,
  MAP_HEIGHT,
  XP_PER_LEVEL,
  MAX_INVENTORY,
} from "./types";
import { generateDungeon, computeFOV, isWalkable } from "./dungeon";

// ─── Initial hero stats ───
function createHero(name: string, start: Position): Hero {
  return {
    name,
    hp: 30,
    maxHp: 30,
    atk: 5,
    def: 2,
    xp: 0,
    level: 1,
    pos: start,
    inventory: [],
    equipment: { weapon: null, armor: null, ring: null },
  };
}

// ─── Computed hero stats (base + equipment) ───
export function getHeroAtk(hero: Hero): number {
  let atk = hero.atk;
  if (hero.equipment.weapon) atk += hero.equipment.weapon.value;
  if (hero.equipment.ring?.name.includes("Strength")) atk += hero.equipment.ring.value;
  return atk;
}

export function getHeroDef(hero: Hero): number {
  let def = hero.def;
  if (hero.equipment.armor) def += hero.equipment.armor.value;
  if (hero.equipment.ring?.name.includes("Protection")) def += hero.equipment.ring.value;
  return def;
}

// ─── Create initial game state ───
export function createInitialState(): GameState {
  return {
    phase: "naming",
    hero: createHero("", { x: 0, y: 0 }),
    floor: 0,
    map: [],
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    monsters: [],
    rooms: [],
    log: [{ text: "Welcome to the Crypts of Sui.", type: "info" }],
    turnsElapsed: 0,
    killCount: 0,
    causeOfDeath: "",
    heroObjectId: "",
  };
}

// ─── Start a new floor ───
function enterFloor(state: GameState, floor: number): GameState {
  const { map, rooms, playerStart, monsters } = generateDungeon(floor);
  const hero = { ...state.hero, pos: playerStart };
  const fovMap = computeFOV(map, playerStart);
  return {
    ...state,
    floor,
    map: fovMap,
    rooms,
    monsters,
    hero,
    log: [
      ...state.log,
      { text: `You descend to floor ${floor}.`, type: "info" },
    ],
  };
}

// ─── Damage calculation ───
function calcDamage(atk: number, def: number): number {
  const dmg = Math.max(1, atk - def + Math.floor(Math.random() * 3) - 1);
  return dmg;
}

// ─── Monster AI: move toward player if visible ───
function moveMonsters(state: GameState): GameState {
  let { hero, monsters, map, log } = state;
  const newMonsters = [...monsters];
  const newLog = [...log];
  let newHero = { ...hero };

  for (let i = 0; i < newMonsters.length; i++) {
    const mon = { ...newMonsters[i] };
    const tile = map[mon.pos.y]?.[mon.pos.x];
    if (!tile?.visible) continue; // only move if player can see them

    const dx = hero.pos.x - mon.pos.x;
    const dy = hero.pos.y - mon.pos.y;
    const dist = Math.abs(dx) + Math.abs(dy);

    if (dist <= 1) {
      // Attack player
      const heroDef = getHeroDef(newHero);
      const dmg = calcDamage(mon.atk, heroDef);
      newHero = { ...newHero, hp: newHero.hp - dmg };
      newLog.push({
        text: `${mon.name} hits you for ${dmg} damage!`,
        type: "combat",
      });
    } else if (dist <= 8) {
      // Move toward player
      let moveX = mon.pos.x + (dx > 0 ? 1 : dx < 0 ? -1 : 0);
      let moveY = mon.pos.y + (dy > 0 ? 1 : dy < 0 ? -1 : 0);

      // Prefer axis with greater distance
      if (Math.abs(dx) >= Math.abs(dy)) {
        moveY = mon.pos.y;
      } else {
        moveX = mon.pos.x;
      }

      if (
        moveX >= 0 && moveX < MAP_WIDTH &&
        moveY >= 0 && moveY < MAP_HEIGHT &&
        isWalkable(map[moveY][moveX]) &&
        !(moveX === hero.pos.x && moveY === hero.pos.y) &&
        !newMonsters.some((other, j) => j !== i && other.pos.x === moveX && other.pos.y === moveY)
      ) {
        mon.pos = { x: moveX, y: moveY };
      }
    }

    newMonsters[i] = mon;
  }

  return { ...state, hero: newHero, monsters: newMonsters, log: newLog };
}

// ─── Level up check ───
function checkLevelUp(state: GameState): GameState {
  const hero = { ...state.hero };
  const log = [...state.log];
  const xpNeeded = hero.level * XP_PER_LEVEL;

  while (hero.xp >= xpNeeded) {
    hero.xp -= xpNeeded;
    hero.level += 1;
    hero.maxHp += 5;
    hero.hp = Math.min(hero.hp + 10, hero.maxHp);
    hero.atk += 1;
    hero.def += 1;
    log.push({
      text: `Level up! You are now level ${hero.level}.`,
      type: "level",
    });
  }

  return { ...state, hero, log };
}

// ─── Death check ───
function checkDeath(state: GameState): GameState {
  if (state.hero.hp <= 0) {
    // Find the last combat log entry as cause of death
    const lastCombatLog = [...state.log].reverse().find((l) => l.type === "combat");
    const causeOfDeath = lastCombatLog?.text ?? "Unknown causes";

    return {
      ...state,
      phase: "dead",
      hero: { ...state.hero, hp: 0 },
      causeOfDeath,
      log: [
        ...state.log,
        { text: `${state.hero.name} has perished on floor ${state.floor}. ☠`, type: "death" },
      ],
    };
  }
  return state;
}

// ─── Game reducer ───
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START_GAME": {
      const newState = {
        ...state,
        phase: "playing" as const,
        hero: { ...state.hero, name: action.name },
        heroObjectId: action.heroObjectId,
        log: [
          ...state.log,
          { text: `${action.name} enters the Crypts of Sui...`, type: "info" as const },
        ],
      };
      return enterFloor(newState, 1);
    }

    case "MOVE": {
      if (state.phase !== "playing") return state;

      const { dx, dy } = DIR_OFFSETS[action.direction];
      const newX = state.hero.pos.x + dx;
      const newY = state.hero.pos.y + dy;

      // Bounds check
      if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return state;

      // Wall check
      if (!isWalkable(state.map[newY][newX])) return state;

      // Monster collision — attack instead of move
      const targetMonster = state.monsters.findIndex(
        (m) => m.pos.x === newX && m.pos.y === newY
      );

      if (targetMonster >= 0) {
        // Attack monster
        const mon = { ...state.monsters[targetMonster] };
        const heroAtk = getHeroAtk(state.hero);
        const dmg = calcDamage(heroAtk, mon.def);
        mon.hp -= dmg;

        const log: LogEntry[] = [
          ...state.log,
          { text: `You hit ${mon.name} for ${dmg} damage!`, type: "combat" },
        ];

        let monsters: Monster[];
        let hero = { ...state.hero };

        let killCount = state.killCount;
        if (mon.hp <= 0) {
          // Monster dies
          monsters = state.monsters.filter((_, i) => i !== targetMonster);
          hero.xp += mon.xpReward;
          killCount += 1;
          log.push({ text: `${mon.name} is slain! (+${mon.xpReward} XP)`, type: "combat" });
        } else {
          monsters = [...state.monsters];
          monsters[targetMonster] = mon;
        }

        let result: GameState = {
          ...state,
          hero,
          monsters,
          log,
          turnsElapsed: state.turnsElapsed + 1,
          killCount,
        };

        result = checkLevelUp(result);
        result = moveMonsters(result);
        result = checkDeath(result);
        result.map = computeFOV(result.map, result.hero.pos);

        return result;
      }

      // Move hero
      const hero = { ...state.hero, pos: { x: newX, y: newY } };
      let log = [...state.log];
      const newMap = computeFOV(state.map, hero.pos);

      // Check for items on ground
      const tile = newMap[newY][newX];
      if (tile.item) {
        log.push({
          text: `You see a ${tile.item.name} on the ground. Press [G] to pick up.`,
          type: "loot",
        });
      }

      // Check for stairs
      if (tile.type === TileType.StairsDown) {
        log.push({ text: "You see stairs descending deeper. Press [>] to descend.", type: "info" });
      }

      let result: GameState = {
        ...state,
        hero,
        map: newMap,
        log,
        turnsElapsed: state.turnsElapsed + 1,
      };

      result = moveMonsters(result);
      result = checkDeath(result);

      return result;
    }

    case "WAIT": {
      if (state.phase !== "playing") return state;
      let result: GameState = {
        ...state,
        turnsElapsed: state.turnsElapsed + 1,
      };
      result = moveMonsters(result);
      result = checkDeath(result);
      result.map = computeFOV(result.map, result.hero.pos);
      return result;
    }

    case "DESCEND": {
      if (state.phase !== "playing") return state;
      const tile = state.map[state.hero.pos.y][state.hero.pos.x];
      if (tile.type !== TileType.StairsDown) return state;
      return enterFloor(state, state.floor + 1);
    }

    case "PICKUP": {
      if (state.phase !== "playing") return state;
      const { x, y } = state.hero.pos;
      const tile = state.map[y][x];
      if (!tile.item) return state;

      if (state.hero.inventory.length >= MAX_INVENTORY) {
        return {
          ...state,
          log: [...state.log, { text: "Inventory full!", type: "danger" }],
        };
      }

      const item = tile.item;
      const newMap = state.map.map((row) => row.map((t) => ({ ...t })));
      newMap[y][x].item = null;

      return {
        ...state,
        map: newMap,
        hero: {
          ...state.hero,
          inventory: [...state.hero.inventory, item],
        },
        log: [
          ...state.log,
          { text: `Picked up ${item.name}.`, type: "loot" },
        ],
      };
    }

    case "USE_ITEM": {
      if (state.phase !== "playing") return state;
      const item = state.hero.inventory.find((i) => i.id === action.itemId);
      if (!item || item.type !== "potion") return state;

      const hero = { ...state.hero };
      const oldHp = hero.hp;
      hero.hp = Math.min(hero.maxHp, hero.hp + item.value);
      hero.inventory = hero.inventory.filter((i) => i.id !== action.itemId);
      const healed = hero.hp - oldHp;

      return {
        ...state,
        hero,
        log: [
          ...state.log,
          { text: `Used ${item.name}. Restored ${healed} HP.`, type: "info" },
        ],
      };
    }

    case "EQUIP_ITEM": {
      if (state.phase !== "playing") return state;
      const item = state.hero.inventory.find((i) => i.id === action.itemId);
      if (!item || item.type === "potion") return state;

      const hero = { ...state.hero };
      const slot = item.type as "weapon" | "armor" | "ring";
      const currentEquip = hero.equipment[slot];

      // Swap equipment
      hero.equipment = { ...hero.equipment, [slot]: item };
      hero.inventory = hero.inventory.filter((i) => i.id !== action.itemId);
      if (currentEquip) {
        hero.inventory.push(currentEquip);
      }

      return {
        ...state,
        hero,
        log: [
          ...state.log,
          { text: `Equipped ${item.name}.`, type: "info" },
        ],
      };
    }

    case "DROP_ITEM": {
      if (state.phase !== "playing") return state;
      const item = state.hero.inventory.find((i) => i.id === action.itemId);
      if (!item) return state;

      const { x, y } = state.hero.pos;
      const tile = state.map[y][x];

      // Can't drop if there's already an item on this tile
      if (tile.item) {
        return {
          ...state,
          log: [
            ...state.log,
            { text: "There's already an item here.", type: "danger" },
          ],
        };
      }

      const newMap = state.map.map((row) => row.map((t) => ({ ...t })));
      newMap[y][x].item = item;

      return {
        ...state,
        map: newMap,
        hero: {
          ...state.hero,
          inventory: state.hero.inventory.filter((i) => i.id !== action.itemId),
        },
        log: [
          ...state.log,
          { text: `Dropped ${item.name}.`, type: "info" },
        ],
      };
    }

    case "RESET":
      return createInitialState();

    default:
      return state;
  }
}
