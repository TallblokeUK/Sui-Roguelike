import {
  type GameState,
  type GameAction,
  type Hero,
  type LogEntry,
  type Monster,
  type Item,
  type Position,
  type StatusEffect,
  type RoomType,
  type Equipment,
  type EquipSlotKey,
  ITEM_TYPE_TO_SLOT,
  TileType,
  DIR_OFFSETS,
  MAP_WIDTH,
  MAP_HEIGHT,
  XP_PER_LEVEL,
  MAX_INVENTORY,
} from "./types";
import { generateDungeon, computeFOV, isWalkable, getRoomAt, isBossFloor } from "./dungeon";
import {
  resolveMeleeAttack,
  processStatusEffects,
  applyStatusEffect,
  isStunned,
  formatHeroAttack,
  formatMonsterAttack,
} from "./combat";
import { getStartingAbilities, executeAbility, tickCooldowns, regenEnergy } from "./abilities";
import { generateLevelUpChoices, applyLevelUpChoice } from "./progression";
import { countSetPieces, generateShopItems, generatePotion } from "./items";
import type { MetaBonuses } from "./meta-progression";

// ─── Initial hero stats ───
function createHero(name: string, start: Position, meta?: MetaBonuses): Hero {
  const hp = 30 + (meta?.bonusHp ?? 0);
  const inventory: Item[] = [];

  // Starting potion from Grave Goods
  if (meta?.startingPotionRarity) {
    const potion = generatePotion(meta.startingPotionRarity);
    if (potion) inventory.push(potion);
  }

  return {
    name,
    hp,
    maxHp: hp,
    atk: 5 + (meta?.bonusAtk ?? 0),
    def: 2 + (meta?.bonusDef ?? 0),
    xp: 0,
    level: 1,
    pos: start,
    inventory,
    equipment: { weapon: null, helmet: null, chest: null, legs: null, boots: null, gloves: null, ring: null, amulet: null, bracelet: null },
    dodge: 3 + (meta?.bonusDodge ?? 0),
    critChance: 5 + (meta?.bonusCrit ?? 0),
    energy: 5 + (meta?.bonusEnergy ?? 0),
    maxEnergy: 5 + (meta?.bonusEnergy ?? 0),
    statusEffects: [],
    abilities: getStartingAbilities(),
    passives: [...(meta?.startingPassives ?? [])],
    chosenPerks: [],
    gold: meta?.startingGold ?? 0,
  };
}

// ─── Helper: get all equipped items ───
function equippedItems(hero: Hero): Item[] {
  const slots: Array<keyof Equipment> = ["weapon", "helmet", "chest", "legs", "boots", "gloves", "ring", "amulet", "bracelet"];
  return slots.map((s) => hero.equipment[s]).filter((i): i is Item => i !== null);
}

// ─── Computed hero stats (base + equipment + set bonuses) ───
export function getHeroAtk(hero: Hero): number {
  let atk = hero.atk;
  // Weapon adds full value as ATK
  if (hero.equipment.weapon) atk += hero.equipment.weapon.value;
  // Gloves add half value as ATK
  if (hero.equipment.gloves) atk += Math.floor(hero.equipment.gloves.value / 2);
  // Accessories with ATK keywords
  for (const item of [hero.equipment.ring, hero.equipment.amulet, hero.equipment.bracelet]) {
    if (item && (item.name.includes("Strength") || item.name.includes("Berserker") || item.name.includes("Wrath") || item.name.includes("Might"))) {
      atk += item.value;
    }
  }
  // Shadowsteel set bonus
  const ss = countSetPieces(hero.equipment, "shadowsteel");
  if (ss >= 2) atk += 3;
  if (ss >= 4) atk += 5;
  // Wraith 4pc: ignore 3 DEF (modeled as +3 ATK here)
  if (countSetPieces(hero.equipment, "wraith") >= 4) atk += 3;
  return atk;
}

export function getHeroDef(hero: Hero): number {
  let def = hero.def;
  // Armor slots add value as DEF
  for (const slot of ["helmet", "chest", "legs", "boots"] as const) {
    if (hero.equipment[slot]) def += hero.equipment[slot]!.value;
  }
  // Gloves add half value as DEF
  if (hero.equipment.gloves) def += Math.ceil(hero.equipment.gloves.value / 2);
  // Accessories with DEF keywords
  for (const item of [hero.equipment.ring, hero.equipment.amulet, hero.equipment.bracelet]) {
    if (item && (item.name.includes("Protection") || item.name.includes("Sentinel") || item.name.includes("Bulwark") || item.name.includes("Warding"))) {
      def += item.value;
    }
  }
  return def;
}

// ─── Computed max HP (base + equipment + set bonuses) ───
export function getHeroMaxHp(hero: Hero): number {
  let maxHp = hero.maxHp;
  // Accessories with HP keywords
  for (const item of [hero.equipment.ring, hero.equipment.amulet, hero.equipment.bracelet]) {
    if (item && (item.name.includes("Vitality") || item.name.includes("Regeneration") || item.name.includes("Fortitude") || item.name.includes("Undying") || item.name.includes("Mountain"))) {
      maxHp += item.value;
    }
  }
  // Guardian set bonus
  const gs = countSetPieces(hero.equipment, "guardian");
  if (gs >= 2) maxHp += 10;
  if (gs >= 4) maxHp += 15;
  return maxHp;
}

// ─── Computed crit chance (base + set bonuses) ───
export function getHeroCrit(hero: Hero): number {
  let crit = hero.critChance;
  // Dragonfire set bonus
  const df = countSetPieces(hero.equipment, "dragonfire");
  if (df >= 2) crit += 5;
  if (df >= 4) crit += 10;
  return crit;
}

// ─── Computed dodge (base + equipment + set bonuses) ───
export function getHeroDodge(hero: Hero): number {
  let dodge = hero.dodge;
  // Boots add dodge
  if (hero.equipment.boots && (hero.equipment.boots.name.includes("Silence") || hero.equipment.boots.name.includes("Winged") || hero.equipment.boots.name.includes("Phantom"))) {
    dodge += hero.equipment.boots.value;
  }
  // Evasion accessories
  for (const item of [hero.equipment.ring, hero.equipment.amulet, hero.equipment.bracelet]) {
    if (item && item.name.includes("Evasion")) dodge += item.value;
  }
  // Wraith 2pc: +10% dodge
  if (countSetPieces(hero.equipment, "wraith") >= 2) dodge += 10;
  return dodge;
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
    pendingAbility: null,
    levelUpChoices: [],
    shopItems: [],
    shopOpen: false,
  };
}

// ─── Start a new floor ───
function enterFloor(state: GameState, floor: number): GameState {
  const { map, rooms, playerStart, monsters } = generateDungeon(floor);
  const hero = { ...state.hero, pos: playerStart };
  // Generate shop inventory if a shop room exists
  const hasShop = rooms.some((r) => r.roomType === "shop");
  const shopItems = hasShop ? generateShopItems(floor) : [];
  const fovMap = computeFOV(map, playerStart);
  const log: LogEntry[] = [
    ...state.log,
    { text: `You descend to floor ${floor}.`, type: "info" },
  ];

  // Boss floor warning
  if (isBossFloor(floor)) {
    const boss = monsters.find((m) => m.isBoss);
    if (boss) {
      log.push({ text: `A powerful presence stirs in the depths... ${boss.name} awaits.`, type: "danger" });
    }
  }

  return {
    ...state,
    floor,
    map: fovMap,
    rooms,
    monsters,
    hero,
    log,
    shopItems,
    shopOpen: false,
  };
}

// ─── Process hero status effects at turn start ───
function processHeroStatusTick(state: GameState): GameState {
  if (state.hero.statusEffects.length === 0) return state;

  const { damage, remaining, log } = processStatusEffects(
    state.hero.statusEffects,
    "you",
  );

  return {
    ...state,
    hero: {
      ...state.hero,
      hp: state.hero.hp - damage,
      statusEffects: remaining,
    },
    log: [...state.log, ...log],
  };
}

// ─── Process monster status effects at turn start ───
function processMonsterStatusTicks(state: GameState): GameState {
  let monsters = [...state.monsters];
  let log = [...state.log];
  let killCount = state.killCount;
  let hero = { ...state.hero };

  for (let i = monsters.length - 1; i >= 0; i--) {
    const mon = monsters[i];
    if (mon.statusEffects.length === 0) continue;

    const result = processStatusEffects(mon.statusEffects, mon.name);
    log.push(...result.log);

    const newHp = mon.hp - result.damage;
    if (newHp <= 0) {
      const goldDrop = Math.floor(mon.xpReward * (0.8 + Math.random() * 0.8)) + state.floor;
      hero.gold += goldDrop;
      log.push({ text: `${mon.name} dies from status effects! (+${mon.xpReward} XP, +${goldDrop} gold)`, type: "combat" });
      hero.xp += mon.xpReward;
      killCount += 1;
      monsters = monsters.filter((_, j) => j !== i);
    } else {
      monsters[i] = { ...mon, hp: newHp, statusEffects: result.remaining };
    }
  }

  return { ...state, monsters, log, killCount, hero };
}

// ─── Apply thick_skin passive damage reduction ───
function applyDamageReduction(hero: Hero, damage: number): number {
  if (hero.passives.includes("thick_skin")) {
    return Math.max(1, damage - 1);
  }
  return damage;
}

// ─── Apply status effect with poison resistance check ───
function applyStatusToHero(hero: Hero, effect: StatusEffect): Hero {
  if (effect.type === "poison" && hero.passives.includes("poison_resistance")) {
    return hero; // immune
  }
  return { ...hero, statusEffects: applyStatusEffect(hero.statusEffects, effect) };
}

// ─── Monster AI: move toward player if visible, always aggressive ───
function moveMonsters(state: GameState): GameState {
  let { hero, monsters, map, log } = state;
  const newMonsters = [...monsters];
  const newLog = [...log];
  let newHero = { ...hero };

  const canMoveTo = (x: number, y: number, skipIdx: number) =>
    x >= 0 && x < MAP_WIDTH &&
    y >= 0 && y < MAP_HEIGHT &&
    isWalkable(map[y][x]) &&
    !(x === hero.pos.x && y === hero.pos.y) &&
    !newMonsters.some((other, j) => j !== skipIdx && other.pos.x === x && other.pos.y === y);

  // Check line of sight for ranged attacks
  const hasLineOfSight = (from: Position, to: Position): boolean => {
    const ddx = to.x - from.x;
    const ddy = to.y - from.y;
    const steps = Math.max(Math.abs(ddx), Math.abs(ddy));
    if (steps === 0) return true;
    for (let s = 1; s < steps; s++) {
      const cx = Math.round(from.x + (ddx * s) / steps);
      const cy = Math.round(from.y + (ddy * s) / steps);
      if (!isWalkable(map[cy]?.[cx])) return false;
    }
    return true;
  };

  for (let i = 0; i < newMonsters.length; i++) {
    const mon = { ...newMonsters[i] };
    const tile = map[mon.pos.y]?.[mon.pos.x];
    if (!tile?.visible) continue; // only act if player can see them

    // Disguised mimics don't act — they wait to be bumped
    if (mon.disguised) {
      newMonsters[i] = mon;
      continue;
    }

    // Skip stunned monsters
    if (isStunned(mon.statusEffects)) {
      newMonsters[i] = mon;
      continue;
    }

    // Troll regeneration
    if (mon.special === "regenerate" && mon.hp < mon.maxHp) {
      mon.hp = Math.min(mon.maxHp, mon.hp + 2);
      newLog.push({ text: `${mon.name} regenerates!`, type: "status" });
    }

    // Necromancer/summoner: 20% chance to summon a skeleton
    if (mon.special === "summoner" && Math.random() < 0.2) {
      const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
      for (const d of dirs.sort(() => Math.random() - 0.5)) {
        const sx = mon.pos.x + d.dx;
        const sy = mon.pos.y + d.dy;
        if (canMoveTo(sx, sy, i)) {
          const summon: Monster = {
            id: `summon-${Date.now()}-${Math.random()}`,
            name: "Summoned Skeleton",
            glyph: "s",
            color: "text-stone-300",
            hp: 8 + state.floor,
            maxHp: 8 + state.floor,
            atk: 3 + Math.floor(state.floor * 0.5),
            def: 1,
            xpReward: 3,
            pos: { x: sx, y: sy },
            statusEffects: [],
            behavior: "melee",
          };
          newMonsters.push(summon);
          newLog.push({ text: `${mon.name} raises a skeleton from the dead!`, type: "danger" });
          break;
        }
      }
    }

    const dx = hero.pos.x - mon.pos.x;
    const dy = hero.pos.y - mon.pos.y;
    const dist = Math.abs(dx) + Math.abs(dy);

    // Pack bonus: count adjacent monsters of same type
    let atkBonus = 0;
    if (mon.special === "pack") {
      atkBonus = newMonsters.filter((other) =>
        other.id !== mon.id &&
        other.special === "pack" &&
        Math.abs(other.pos.x - mon.pos.x) <= 1 &&
        Math.abs(other.pos.y - mon.pos.y) <= 1
      ).length;
    }

    // Ranged monster behavior
    if (mon.behavior === "ranged" && mon.rangedRange) {
      if (dist <= mon.rangedRange && dist > 1 && hasLineOfSight(mon.pos, hero.pos)) {
        const heroDef = getHeroDef(newHero);
        const result = resolveMeleeAttack(mon.atk + atkBonus, heroDef, 0, getHeroDodge(newHero), mon.statusOnHit);
        newLog.push(...formatMonsterAttack(mon.name, result));

        if (!result.isDodged) {
          newHero = { ...newHero, hp: newHero.hp - applyDamageReduction(newHero, result.damage) };
          if (result.statusApplied) {
            newHero = applyStatusToHero(newHero, result.statusApplied);
          }
          // Guardian set: reflect 1 damage
          if (countSetPieces(newHero.equipment, "guardian") >= 2) {
            mon.hp -= 1;
            newLog.push({ text: `Guardian set reflects 1 damage to ${mon.name}!`, type: "status" });
          }
        }

        if (dist <= 2) {
          const fleeX = mon.pos.x - (dx > 0 ? 1 : dx < 0 ? -1 : 0);
          const fleeY = mon.pos.y - (dy > 0 ? 1 : dy < 0 ? -1 : 0);
          if (canMoveTo(fleeX, fleeY, i)) {
            mon.pos = { x: fleeX, y: fleeY };
          }
        }

        newMonsters[i] = mon;
        continue;
      }
    }

    if (dist <= 1) {
      const heroDef = getHeroDef(newHero);
      const result = resolveMeleeAttack(mon.atk + atkBonus, heroDef, 0, getHeroDodge(newHero), mon.statusOnHit);
      newLog.push(...formatMonsterAttack(mon.name, result));

      if (!result.isDodged) {
        newHero = { ...newHero, hp: newHero.hp - applyDamageReduction(newHero, result.damage) };
        if (result.statusApplied) {
          newHero = applyStatusToHero(newHero, result.statusApplied);
        }
        // Guardian set: reflect 1 damage
        if (countSetPieces(newHero.equipment, "guardian") >= 2) {
          mon.hp -= 1;
          newLog.push({ text: `Guardian set reflects 1 damage to ${mon.name}!`, type: "status" });
        }
      }
    } else {
      const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
      const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;

      let moved = false;

      if (Math.abs(dx) >= Math.abs(dy)) {
        if (stepX !== 0 && canMoveTo(mon.pos.x + stepX, mon.pos.y, i)) {
          mon.pos = { x: mon.pos.x + stepX, y: mon.pos.y };
          moved = true;
        } else if (stepY !== 0 && canMoveTo(mon.pos.x, mon.pos.y + stepY, i)) {
          mon.pos = { x: mon.pos.x, y: mon.pos.y + stepY };
          moved = true;
        }
      } else {
        if (stepY !== 0 && canMoveTo(mon.pos.x, mon.pos.y + stepY, i)) {
          mon.pos = { x: mon.pos.x, y: mon.pos.y + stepY };
          moved = true;
        } else if (stepX !== 0 && canMoveTo(mon.pos.x + stepX, mon.pos.y, i)) {
          mon.pos = { x: mon.pos.x + stepX, y: mon.pos.y };
          moved = true;
        }
      }

      if (!moved && stepX !== 0 && stepY !== 0 && canMoveTo(mon.pos.x + stepX, mon.pos.y + stepY, i)) {
        mon.pos = { x: mon.pos.x + stepX, y: mon.pos.y + stepY };
      }

      // Attack immediately after moving adjacent
      const newDx = hero.pos.x - mon.pos.x;
      const newDy = hero.pos.y - mon.pos.y;
      const newDist = Math.abs(newDx) + Math.abs(newDy);
      if (newDist <= 1) {
        const heroDef = getHeroDef(newHero);
        const result = resolveMeleeAttack(mon.atk + atkBonus, heroDef, 0, getHeroDodge(newHero), mon.statusOnHit);
        newLog.push(...formatMonsterAttack(mon.name, result));

        if (!result.isDodged) {
          newHero = { ...newHero, hp: newHero.hp - applyDamageReduction(newHero, result.damage) };
          if (result.statusApplied) {
            newHero = applyStatusToHero(newHero, result.statusApplied);
          }
          // Guardian set: reflect 1 damage
          if (countSetPieces(newHero.equipment, "guardian") >= 2) {
            mon.hp -= 1;
            newLog.push({ text: `Guardian set reflects 1 damage to ${mon.name}!`, type: "status" });
          }
        }
      }
    }

    newMonsters[i] = mon;
  }

  return { ...state, hero: newHero, monsters: newMonsters, log: newLog };
}

// ─── End of turn processing ───
function endOfTurn(state: GameState): GameState {
  let s = state;

  // Process status effects
  s = processHeroStatusTick(s);
  s = processMonsterStatusTicks(s);

  // Monster AI
  s = moveMonsters(s);

  // Tick cooldowns and regen energy (relentless grants +1 extra regen)
  let regenHero = regenEnergy(s.hero);
  if (regenHero.passives.includes("relentless")) {
    regenHero = { ...regenHero, energy: Math.min(regenHero.maxEnergy, regenHero.energy + 1) };
  }
  s = { ...s, hero: tickCooldowns(regenHero) };

  // Check death
  s = checkDeath(s);

  // Update FOV
  s.map = computeFOV(s.map, s.hero.pos);

  return s;
}

// ─── Level up check ───
function checkLevelUp(state: GameState): GameState {
  const hero = { ...state.hero };
  const xpNeeded = hero.level * XP_PER_LEVEL;

  if (hero.xp >= xpNeeded) {
    hero.xp -= xpNeeded;
    hero.level += 1;
    // Base stats still go up slightly
    hero.maxHp += 3;
    hero.hp = Math.min(hero.hp + 5, getHeroMaxHp(hero));

    const choices = generateLevelUpChoices();

    return {
      ...state,
      hero,
      phase: "level_up",
      levelUpChoices: choices,
      log: [
        ...state.log,
        { text: `Level up! You are now level ${hero.level}. Choose a perk:`, type: "level" },
      ],
    };
  }

  return { ...state, hero };
}

// ─── Death check ───
function checkDeath(state: GameState): GameState {
  if (state.hero.hp <= 0) {
    const lastCombatLog = [...state.log].reverse().find((l) => l.type === "combat" || l.type === "status");
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
      const hero = createHero(action.name, { x: 0, y: 0 }, action.metaBonuses);
      const newState = {
        ...state,
        phase: "playing" as const,
        hero,
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

      // If there's a pending ability, use the direction for that instead
      if (state.pendingAbility) {
        const abilityIdx = state.hero.abilities.findIndex((a) => a.id === state.pendingAbility);
        if (abilityIdx >= 0) {
          let result = executeAbility(state, abilityIdx, action.direction);
          if (result.turnsElapsed > state.turnsElapsed) {
            result = checkLevelUp(result);
            result = endOfTurn(result);
          }
          return result;
        }
        return { ...state, pendingAbility: null };
      }

      const { dx, dy } = DIR_OFFSETS[action.direction];
      const newX = state.hero.pos.x + dx;
      const newY = state.hero.pos.y + dy;

      // Bounds check
      if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return state;

      // Secret door — bumping reveals it
      if (state.map[newY][newX].type === TileType.SecretDoor) {
        const newMap = state.map.map((row) => row.map((t) => ({ ...t })));
        newMap[newY][newX].type = TileType.Floor;
        return {
          ...state,
          map: computeFOV(newMap, state.hero.pos),
          log: [...state.log, { text: "You discover a hidden passage!", type: "loot" }],
        };
      }

      // Wall check
      if (!isWalkable(state.map[newY][newX])) return state;

      // Monster collision — attack instead of move
      const targetMonster = state.monsters.findIndex(
        (m) => m.pos.x === newX && m.pos.y === newY
      );

      if (targetMonster >= 0) {
        // Reveal mimic on bump
        const mon = { ...state.monsters[targetMonster] };
        if (mon.disguised) {
          mon.disguised = false;
        }
        const heroAtk = getHeroAtk(state.hero);
        const heroCrit = getHeroCrit(state.hero);
        const result = resolveMeleeAttack(heroAtk, mon.def, heroCrit, 0, state.hero.equipment.weapon?.name.includes("Venom") ? { type: "poison", chance: 20, duration: 3, damage: 2 } : undefined);

        const log: LogEntry[] = [...state.log];

        // Mimic surprise reveal
        if (state.monsters[targetMonster].disguised) {
          log.push({ text: "It was a Mimic! The treasure attacks!", type: "danger" });
        }

        log.push(...formatHeroAttack(mon.name, result));

        if (!result.isDodged) {
          mon.hp -= result.damage;
          if (result.statusApplied) {
            mon.statusEffects = applyStatusEffect(mon.statusEffects, result.statusApplied);
          }
          // Shadowsteel set: attacks inflict bleed (2+ pieces)
          if (countSetPieces(state.hero.equipment, "shadowsteel") >= 2) {
            mon.statusEffects = applyStatusEffect(mon.statusEffects, {
              type: "bleed", turnsRemaining: 3, damagePerTurn: 2, source: "Shadowsteel Set",
            });
            log.push({ text: "Shadowsteel set: target bleeds!", type: "status" });
          }
          // Dragonfire set: crits cause burning (2+ pieces)
          if (result.isCrit && countSetPieces(state.hero.equipment, "dragonfire") >= 2) {
            mon.statusEffects = applyStatusEffect(mon.statusEffects, {
              type: "burning", turnsRemaining: 2, damagePerTurn: 3, source: "Dragonfire Set",
            });
            log.push({ text: "Dragonfire set: critical strike ignites!", type: "status" });
          }
        }

        let monsters: Monster[];
        let hero = { ...state.hero };
        let killCount = state.killCount;

        if (mon.hp <= 0) {
          monsters = state.monsters.filter((_, i) => i !== targetMonster);
          hero.xp += mon.xpReward;
          killCount += 1;
          // Gold drop: based on xpReward + floor + randomness
          const goldDrop = Math.floor(mon.xpReward * (0.8 + Math.random() * 0.8)) + state.floor;
          hero.gold += goldDrop;
          if (mon.isBoss) {
            const bossGold = goldDrop * 3;
            hero.gold += bossGold - goldDrop; // replace with 3x
            log.push({ text: `${mon.name} has been vanquished! The stairs unseal. (+${mon.xpReward} XP, +${bossGold} gold)`, type: "level" });
          } else {
            log.push({ text: `${mon.name} is slain! (+${mon.xpReward} XP, +${goldDrop} gold)`, type: "combat" });
          }
          // Vampiric Touch passive
          if (hero.passives.includes("vampiric_touch")) {
            const healAmt = Math.min(3, getHeroMaxHp(hero) - hero.hp);
            if (healAmt > 0) {
              hero.hp += healAmt;
              log.push({ text: `Vampiric Touch heals ${healAmt} HP!`, type: "status" });
            }
          }
        } else {
          monsters = [...state.monsters];
          monsters[targetMonster] = mon;
        }

        let s: GameState = {
          ...state,
          hero,
          monsters,
          log,
          turnsElapsed: state.turnsElapsed + 1,
          killCount,
        };

        s = checkLevelUp(s);
        s = endOfTurn(s);

        return s;
      }

      // Move hero
      const hero = { ...state.hero, pos: { x: newX, y: newY } };
      let log = [...state.log];
      const newMap = state.map.map((row) => row.map((t) => ({ ...t })));

      // Open doors when walking through
      if (newMap[newY][newX].type === TileType.Door && !newMap[newY][newX].doorOpen) {
        newMap[newY][newX].doorOpen = true;
        log.push({ text: "You open the door.", type: "info" });
      }

      // Trigger traps
      if (newMap[newY][newX].type === TileType.Trap && newMap[newY][newX].trap && !newMap[newY][newX].trap!.triggered) {
        const trap = newMap[newY][newX].trap!;
        newMap[newY][newX].trap = { ...trap, triggered: true };

        switch (trap.trapType) {
          case "spike":
            hero.hp -= trap.damage;
            log.push({ text: `You step on a spike trap! ${trap.damage} damage!`, type: "danger" });
            break;
          case "poison_dart":
            hero.hp -= trap.damage;
            hero.statusEffects = [...hero.statusEffects, {
              type: "poison" as const,
              turnsRemaining: 4,
              damagePerTurn: 2,
              source: "poison_dart_trap",
            }];
            log.push({ text: "A poison dart hits you!", type: "danger" });
            break;
          case "teleport": {
            // Teleport to a random revealed floor tile
            const floors: Position[] = [];
            for (let ty = 0; ty < MAP_HEIGHT; ty++) {
              for (let tx = 0; tx < MAP_WIDTH; tx++) {
                if (newMap[ty][tx].type === TileType.Floor && newMap[ty][tx].revealed && !(tx === newX && ty === newY)) {
                  floors.push({ x: tx, y: ty });
                }
              }
            }
            if (floors.length > 0) {
              const dest = floors[Math.floor(Math.random() * floors.length)];
              hero.pos = dest;
              log.push({ text: "A teleport trap whisks you away!", type: "danger" });
            }
            break;
          }
          case "alarm":
            log.push({ text: "An alarm trap! Monsters stir!", type: "danger" });
            // Alarm traps are handled by spawning extra monsters — just log for now
            break;
        }
      }

      // Check for shrine room
      const currentRoom = getRoomAt(state.rooms, hero.pos);
      if (currentRoom?.roomType === "shrine") {
        const center = {
          x: Math.floor(currentRoom.x + currentRoom.w / 2),
          y: Math.floor(currentRoom.y + currentRoom.h / 2),
        };
        if (hero.pos.x === center.x && hero.pos.y === center.y) {
          log.push({ text: "A mystical shrine glows before you. Press [E] to interact.", type: "loot" });
        }
      }

      const fovMap = computeFOV(newMap, hero.pos);

      // Check for items on ground
      const tile = fovMap[hero.pos.y][hero.pos.x];
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

      // Water tile flavor text (first time)
      if (tile.type === TileType.Water) {
        log.push({ text: "You splash through shallow water.", type: "info" });
      }

      let s: GameState = {
        ...state,
        hero,
        map: fovMap,
        log,
        turnsElapsed: state.turnsElapsed + 1,
      };

      s = endOfTurn(s);

      return s;
    }

    case "WAIT": {
      if (state.phase !== "playing") return state;
      let s: GameState = {
        ...state,
        turnsElapsed: state.turnsElapsed + 1,
      };
      s = endOfTurn(s);
      return s;
    }

    case "DESCEND": {
      if (state.phase !== "playing") return state;
      const tile = state.map[state.hero.pos.y][state.hero.pos.x];
      if (tile.type !== TileType.StairsDown) return state;

      // Boss floors: stairs locked until boss is defeated
      if (isBossFloor(state.floor) && state.monsters.some((m) => m.isBoss)) {
        return {
          ...state,
          log: [...state.log, { text: "The stairs are sealed by a dark power. Defeat the boss first!", type: "danger" }],
        };
      }

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
      if (!item) return state;

      // Potions
      if (item.type === "potion") {
        const hero = { ...state.hero };
        const oldHp = hero.hp;
        hero.hp = Math.min(getHeroMaxHp(hero), hero.hp + item.value);
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

      // Scrolls
      if (item.type === "scroll" && item.scrollEffect) {
        const hero = { ...state.hero };
        hero.inventory = hero.inventory.filter((i) => i.id !== action.itemId);
        const log: LogEntry[] = [...state.log];
        let newMap = state.map.map((row) => row.map((t) => ({ ...t })));
        let monsters = [...state.monsters];

        switch (item.scrollEffect) {
          case "teleport": {
            // Teleport to a random walkable tile
            const walkable: Position[] = [];
            for (let y = 0; y < state.mapHeight; y++) {
              for (let x = 0; x < state.mapWidth; x++) {
                if (isWalkable(state.map[y][x]) && !state.monsters.some((m) => m.pos.x === x && m.pos.y === y)) {
                  walkable.push({ x, y });
                }
              }
            }
            if (walkable.length > 0) {
              hero.pos = walkable[Math.floor(Math.random() * walkable.length)];
              log.push({ text: "You read the scroll and teleport!", type: "info" });
            }
            break;
          }
          case "mapping": {
            newMap = newMap.map((row) => row.map((t) => ({ ...t, revealed: true })));
            log.push({ text: "The scroll reveals the entire floor!", type: "info" });
            break;
          }
          case "fire": {
            let fireKills = 0;
            monsters = monsters.map((m) => {
              const tile = state.map[m.pos.y]?.[m.pos.x];
              if (tile?.visible) {
                const dmg = 8 + state.floor * 2;
                const updated = { ...m, hp: m.hp - dmg };
                if (updated.hp <= 0) fireKills++;
                return updated;
              }
              return m;
            });
            const killed = monsters.filter((m) => m.hp <= 0);
            const fireXp = killed.reduce((sum, m) => sum + m.xpReward, 0);
            const fireGold = killed.reduce((sum, m) => sum + Math.floor(m.xpReward * 0.8) + state.floor, 0);
            hero.xp += fireXp;
            hero.gold += fireGold;
            monsters = monsters.filter((m) => m.hp > 0);
            log.push({ text: `Flames erupt! ${killed.length} monsters burned! (+${fireGold} gold)`, type: "combat" });
            break;
          }
          case "frost": {
            let frozenCount = 0;
            monsters = monsters.map((m) => {
              const tile = state.map[m.pos.y]?.[m.pos.x];
              if (tile?.visible) {
                frozenCount++;
                return {
                  ...m,
                  statusEffects: applyStatusEffect(m.statusEffects, {
                    type: "stun",
                    turnsRemaining: 2,
                    damagePerTurn: 0,
                    source: "Scroll of Frost",
                  }),
                };
              }
              return m;
            });
            log.push({ text: `Ice crystals freeze ${frozenCount} monsters in place!`, type: "combat" });
            break;
          }
          case "enchant": {
            if (hero.equipment.weapon) {
              const weapon = { ...hero.equipment.weapon, value: hero.equipment.weapon.value + 2 };
              weapon.name = weapon.name.startsWith("Enchanted ") ? weapon.name : `Enchanted ${weapon.name}`;
              hero.equipment = { ...hero.equipment, weapon };
              log.push({ text: `Your ${weapon.name} glows with power! (+2 ATK)`, type: "loot" });
            } else {
              log.push({ text: "The scroll fizzles... you have no weapon equipped.", type: "info" });
              // Refund the scroll
              hero.inventory = [...hero.inventory, item];
            }
            break;
          }
          case "remove_curse": {
            let cursesRemoved = 0;
            const slots: Array<keyof Equipment> = ["weapon", "helmet", "chest", "legs", "boots", "gloves", "ring", "amulet", "bracelet"];
            hero.equipment = { ...hero.equipment };
            for (const slot of slots) {
              const eq = hero.equipment[slot];
              if (eq?.cursed) {
                hero.equipment[slot] = { ...eq, cursed: false };
                cursesRemoved++;
              }
            }
            if (cursesRemoved > 0) {
              log.push({ text: `The curse lifts! ${cursesRemoved} item(s) cleansed.`, type: "loot" });
            } else {
              log.push({ text: "The scroll glows softly but finds no curses.", type: "info" });
            }
            break;
          }
        }

        let s: GameState = {
          ...state,
          hero,
          monsters,
          map: computeFOV(newMap, hero.pos),
          log,
          turnsElapsed: state.turnsElapsed + 1,
        };
        s = checkLevelUp(s);
        s = endOfTurn(s);
        return s;
      }

      // Other item types can't be "used"
      return state;
    }

    case "EQUIP_ITEM": {
      if (state.phase !== "playing") return state;
      const item = state.hero.inventory.find((i) => i.id === action.itemId);
      if (!item) return state;
      const slot = ITEM_TYPE_TO_SLOT[item.type];
      if (!slot) return state; // consumables can't be equipped

      const hero = { ...state.hero };
      const currentEquip = hero.equipment[slot];

      // Cursed items can't be unequipped
      if (currentEquip?.cursed) {
        return {
          ...state,
          log: [
            ...state.log,
            { text: `${currentEquip.name} is cursed! It cannot be removed.`, type: "danger" },
          ],
        };
      }

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

    case "USE_ABILITY": {
      if (state.phase !== "playing") return state;
      let result = executeAbility(state, action.abilityIndex, action.direction);
      if (result.turnsElapsed > state.turnsElapsed) {
        result = checkLevelUp(result);
        result = endOfTurn(result);
      }
      return result;
    }

    case "CHOOSE_LEVEL_UP": {
      if (state.phase !== "level_up") return state;
      const choice = state.levelUpChoices[action.choiceIndex];
      if (!choice) return state;

      const hero = applyLevelUpChoice(state.hero, choice.id);
      hero.chosenPerks = [...hero.chosenPerks, `${choice.name}: ${choice.description}`];

      return {
        ...state,
        phase: "playing",
        hero,
        levelUpChoices: [],
        log: [
          ...state.log,
          { text: `Chose ${choice.name}: ${choice.description}`, type: "level" },
        ],
      };
    }

    case "INTERACT": {
      if (state.phase !== "playing") return state;
      const currentRoom = getRoomAt(state.rooms, state.hero.pos);

      // Shop interaction
      if (currentRoom?.roomType === "shop") {
        const center = {
          x: Math.floor(currentRoom.x + currentRoom.w / 2),
          y: Math.floor(currentRoom.y + currentRoom.h / 2),
        };
        if (Math.abs(state.hero.pos.x - center.x) <= 1 && Math.abs(state.hero.pos.y - center.y) <= 1) {
          if (state.shopItems.length === 0) {
            return { ...state, log: [...state.log, { text: "The shopkeeper has nothing left to sell.", type: "info" }] };
          }
          return { ...state, shopOpen: true, log: [...state.log, { text: "Welcome, adventurer! Browse my wares.", type: "loot" }] };
        }
        return { ...state, log: [...state.log, { text: "Move closer to the shopkeeper to trade.", type: "info" }] };
      }

      if (!currentRoom || currentRoom.roomType !== "shrine") {
        return { ...state, log: [...state.log, { text: "Nothing to interact with here.", type: "info" }] };
      }
      const center = {
        x: Math.floor(currentRoom.x + currentRoom.w / 2),
        y: Math.floor(currentRoom.y + currentRoom.h / 2),
      };
      if (state.hero.pos.x !== center.x || state.hero.pos.y !== center.y) {
        return { ...state, log: [...state.log, { text: "Move to the shrine center to interact.", type: "info" }] };
      }

      // Mark shrine as used (change room type to normal)
      const newRooms = state.rooms.map((r) =>
        r === currentRoom ? { ...r, roomType: "normal" as RoomType } : r
      );

      const hero = { ...state.hero };
      const log = [...state.log];
      const shrineRoll = Math.random();

      if (shrineRoll < 0.2) {
        hero.atk += 2;
        log.push({ text: "Shrine of Might! ATK +2!", type: "level" });
      } else if (shrineRoll < 0.4) {
        hero.def += 2;
        log.push({ text: "Shrine of Resilience! DEF +2!", type: "level" });
      } else if (shrineRoll < 0.6) {
        hero.dodge += 5;
        log.push({ text: "Shrine of Swiftness! Dodge +5%!", type: "level" });
      } else if (shrineRoll < 0.8) {
        // Reveal entire floor map
        const newMap = state.map.map((row) => row.map((t) => ({ ...t, revealed: true })));
        log.push({ text: "Shrine of Knowledge! The floor is revealed!", type: "level" });
        return { ...state, hero, rooms: newRooms, map: computeFOV(newMap, hero.pos), log };
      } else {
        // Sacrifice: lose 30% HP, gain a free level-up worth of stats
        const hpCost = Math.floor(hero.hp * 0.3);
        hero.hp -= hpCost;
        hero.maxHp += 3;
        hero.atk += 1;
        hero.def += 1;
        hero.critChance += 3;
        log.push({ text: `Shrine of Sacrifice! Lost ${hpCost} HP, but gained power!`, type: "danger" });
      }

      return { ...state, hero, rooms: newRooms, log };
    }

    case "BUY_ITEM": {
      if (!state.shopOpen) return state;
      const shopItem = state.shopItems[action.itemIndex];
      if (!shopItem) return state;
      if (state.hero.gold < shopItem.value) {
        return { ...state, log: [...state.log, { text: `Not enough gold! Need ${shopItem.value}, have ${state.hero.gold}.`, type: "danger" }] };
      }
      if (state.hero.inventory.length >= MAX_INVENTORY) {
        return { ...state, log: [...state.log, { text: "Inventory full!", type: "danger" }] };
      }
      const boughtItem = { ...shopItem, value: Math.floor(shopItem.value / 3) }; // restore item's actual stat value
      return {
        ...state,
        hero: {
          ...state.hero,
          gold: state.hero.gold - shopItem.value,
          inventory: [...state.hero.inventory, boughtItem],
        },
        shopItems: state.shopItems.filter((_, i) => i !== action.itemIndex),
        log: [...state.log, { text: `Bought ${shopItem.name} for ${shopItem.value} gold.`, type: "loot" }],
      };
    }

    case "CLOSE_SHOP": {
      return { ...state, shopOpen: false };
    }

    case "ABANDON": {
      if (state.phase !== "playing") return state;
      return {
        ...state,
        phase: "dead",
        causeOfDeath: "Abandoned the crypts",
        log: [
          ...state.log,
          { text: `${state.hero.name} fled the crypts in cowardice.`, type: "death" as const },
        ],
      };
    }

    case "RESET":
      return createInitialState();

    case "LOAD_SAVE":
      return action.state;

    default:
      return state;
  }
}
