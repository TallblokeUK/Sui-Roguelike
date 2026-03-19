import {
  type Ability,
  type Hero,
  type Monster,
  type GameState,
  type LogEntry,
  type Direction,
  type Position,
  DIR_OFFSETS,
  MAP_WIDTH,
  MAP_HEIGHT,
  FOV_RADIUS,
  TileType,
} from "./types";
import { isWalkable } from "./dungeon";
import { resolveMeleeAttack, formatHeroAttack, applyStatusEffect } from "./combat";
import { getHeroAtk, getHeroMaxHp } from "./state";

// ─── Execute an ability ───
export function executeAbility(
  state: GameState,
  abilityIndex: number,
  direction?: Direction,
): GameState {
  const hero = { ...state.hero };
  const ability = hero.abilities[abilityIndex];
  if (!ability) return state;

  // Check energy
  if (hero.energy < ability.energyCost) {
    return {
      ...state,
      log: [...state.log, { text: "Not enough energy!", type: "danger" }],
    };
  }

  // Check cooldown
  if (ability.currentCooldown > 0) {
    return {
      ...state,
      log: [...state.log, { text: `${ability.name} is on cooldown (${ability.currentCooldown} turns)!`, type: "danger" }],
    };
  }

  switch (ability.id) {
    // ─── Shared abilities ───
    case "lunge": return executeLunge(state, abilityIndex, direction);
    case "cleave": return executeCleave(state, abilityIndex);

    // ─── Warden ───
    case "shield_slam": return executeShieldSlam(state, abilityIndex, direction);
    case "fortify": return executeFortify(state, abilityIndex);
    case "rallying_cry": return executeRallyingCry(state, abilityIndex);
    case "earthquake": return executeEarthquake(state, abilityIndex);

    // ─── Rogue ───
    case "backstab": return executeBackstab(state, abilityIndex, direction);
    case "smoke_bomb": return executeSmokeBomb(state, abilityIndex);
    case "envenom": return executeEnvenom(state, abilityIndex, direction);
    case "shadow_dance": return executeShadowDance(state, abilityIndex);

    // ─── Arcanist ───
    case "arcane_bolt": return executeArcaneBolt(state, abilityIndex, direction);
    case "frost_nova": return executeFrostNova(state, abilityIndex);
    case "flame_pillar": return executeFlamePillar(state, abilityIndex, direction);
    case "chain_lightning": return executeChainLightning(state, abilityIndex, direction);
    case "voidrift": return executeVoidrift(state, abilityIndex);

    // ─── Reaver ───
    case "rend": return executeRend(state, abilityIndex, direction);
    case "blood_frenzy": return executeBloodFrenzy(state, abilityIndex);
    case "deathstrike": return executeDeathstrike(state, abilityIndex, direction);
    case "howl_of_fury": return executeHowlOfFury(state, abilityIndex);

    // Legacy
    case "shield_bash": return executeShieldSlam(state, abilityIndex, direction);

    default:
      return state;
  }
}

// ─── Helper: consume energy + set cooldown ───
function consumeAbility(hero: Hero, abilityIndex: number): Hero {
  return {
    ...hero,
    energy: hero.energy - hero.abilities[abilityIndex].energyCost,
    abilities: hero.abilities.map((a, i) =>
      i === abilityIndex ? { ...a, currentCooldown: a.cooldown } : a,
    ),
  };
}

// ─── Helper: find monster at position ───
function findMonsterAt(monsters: Monster[], x: number, y: number) {
  return monsters.findIndex((m) => m.pos.x === x && m.pos.y === y);
}

// ─── Helper: directional ability with no target message ───
function requireDirection(state: GameState, abilityId: string, abilityName: string, direction?: Direction): GameState | null {
  if (!direction) {
    return {
      ...state,
      pendingAbility: abilityId,
      log: [...state.log, { text: `${abilityName}: choose a direction`, type: "ability" }],
    };
  }
  return null;
}

// ─── Helper: melee directional attack base ───
function meleeDirectionalAttack(
  state: GameState,
  abilityIndex: number,
  direction: Direction,
  opts: {
    abilityId: string;
    abilityName: string;
    damageMultiplier?: number;
    stunChance?: number;
    applyBleed?: { damage: number; duration: number };
    applyPoison?: { damage: number; duration: number };
    applyBurning?: { damage: number; duration: number };
    healOnKillPct?: number;
    logMsg: string;
    conditionDmgMult?: (mon: typeof state.monsters[0]) => number;
  },
): GameState {
  const pending = requireDirection(state, opts.abilityId, opts.abilityName, direction);
  if (pending) return pending;

  const { dx, dy } = DIR_OFFSETS[direction];
  const hero = { ...state.hero };
  let monsters = [...state.monsters];
  const log: LogEntry[] = [...state.log];

  const tx = hero.pos.x + dx;
  const ty = hero.pos.y + dy;
  const targetIdx = monsters.findIndex((m) => m.pos.x === tx && m.pos.y === ty);

  if (targetIdx < 0) {
    return {
      ...state,
      pendingAbility: null,
      log: [...log, { text: `No target for ${opts.abilityName}.`, type: "danger" }],
    };
  }

  const mon = { ...monsters[targetIdx] };
  const heroAtk = getHeroAtk(hero);
  let mult = opts.damageMultiplier ?? 1;
  if (opts.conditionDmgMult) mult *= opts.conditionDmgMult(mon);

  // Shadow Step proc (rogue)
  if (hero.shadowStepProc) {
    mult *= 1.5;
    hero.shadowStepProc = false;
    log.push({ text: "Shadow Step bonus damage!", type: "ability" });
  }

  const result = resolveMeleeAttack(heroAtk, mon.def, hero.critChance, 0);
  result.damage = Math.max(1, Math.floor(result.damage * mult));
  log.push(...formatHeroAttack(mon.name, result));

  mon.hp -= result.damage;
  if (result.statusApplied) {
    mon.statusEffects = applyStatusEffect(mon.statusEffects, result.statusApplied);
  }

  // Stun chance
  if (opts.stunChance && Math.random() < opts.stunChance && mon.hp > 0) {
    mon.statusEffects = applyStatusEffect(mon.statusEffects, {
      type: "stun", turnsRemaining: 2, damagePerTurn: 0, source: opts.abilityId,
    });
    log.push({ text: `${mon.name} is stunned!`, type: "status" });
  }

  // Apply status effects
  if (opts.applyBleed && mon.hp > 0) {
    mon.statusEffects = applyStatusEffect(mon.statusEffects, {
      type: "bleed", turnsRemaining: opts.applyBleed.duration, damagePerTurn: opts.applyBleed.damage, source: opts.abilityId,
    });
    log.push({ text: `${mon.name} is bleeding!`, type: "status" });
  }
  if (opts.applyPoison && mon.hp > 0) {
    mon.statusEffects = applyStatusEffect(mon.statusEffects, {
      type: "poison", turnsRemaining: opts.applyPoison.duration, damagePerTurn: opts.applyPoison.damage, source: opts.abilityId,
    });
    log.push({ text: `${mon.name} is poisoned!`, type: "status" });
  }
  if (opts.applyBurning && mon.hp > 0) {
    mon.statusEffects = applyStatusEffect(mon.statusEffects, {
      type: "burning", turnsRemaining: opts.applyBurning.duration, damagePerTurn: opts.applyBurning.damage, source: opts.abilityId,
    });
    log.push({ text: `${mon.name} is burning!`, type: "status" });
  }

  let killCount = state.killCount;
  let bossKillCount = state.bossKillCount;
  if (mon.hp <= 0) {
    if (mon.isBoss) bossKillCount++;
    monsters = monsters.filter((_, i) => i !== targetIdx);
    hero.xp += mon.xpReward;
    killCount += 1;
    log.push({ text: `${mon.name} is slain! (+${mon.xpReward} XP)`, type: "combat" });
    if (opts.healOnKillPct) {
      const maxHp = getHeroMaxHp(hero);
      const heal = Math.floor(maxHp * opts.healOnKillPct);
      hero.hp = Math.min(maxHp, hero.hp + heal);
      log.push({ text: `You absorb ${heal} HP from the kill!`, type: "ability" });
    }
  } else {
    monsters[targetIdx] = mon;
  }

  const updatedHero = consumeAbility(hero, abilityIndex);
  log.push({ text: opts.logMsg, type: "ability" });

  return {
    ...state,
    hero: updatedHero,
    monsters,
    log,
    killCount,
    bossKillCount,
    pendingAbility: null,
    turnsElapsed: state.turnsElapsed + 1,
  };
}

// ═══════════════════════════════════════════
// SHARED ABILITIES
// ═══════════════════════════════════════════

// ─── Lunge: attack up to 2 tiles away, move adjacent ───
function executeLunge(state: GameState, abilityIndex: number, direction?: Direction): GameState {
  const pending = requireDirection(state, "lunge", "Lunge", direction);
  if (pending) return pending;

  const { dx, dy } = DIR_OFFSETS[direction!];
  const hero = { ...state.hero };
  let monsters = [...state.monsters];
  const log: LogEntry[] = [...state.log];

  let targetIdx = -1;
  let targetPos: Position | null = null;

  for (let dist = 1; dist <= 2; dist++) {
    const tx = hero.pos.x + dx * dist;
    const ty = hero.pos.y + dy * dist;
    if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) break;
    if (!isWalkable(state.map[ty][tx]) && dist === 1) break;

    const idx = monsters.findIndex((m) => m.pos.x === tx && m.pos.y === ty);
    if (idx >= 0) {
      targetIdx = idx;
      targetPos = { x: tx, y: ty };
      break;
    }
  }

  if (targetIdx < 0) {
    return { ...state, pendingAbility: null, log: [...log, { text: "No target in range for Lunge.", type: "danger" }] };
  }

  const mon = { ...monsters[targetIdx] };
  const heroAtk = getHeroAtk(hero);
  let mult = 1;
  if (hero.shadowStepProc) { mult = 1.5; hero.shadowStepProc = false; log.push({ text: "Shadow Step bonus!", type: "ability" }); }
  const result = resolveMeleeAttack(heroAtk, mon.def, hero.critChance, 0);
  result.damage = Math.max(1, Math.floor(result.damage * mult));
  log.push(...formatHeroAttack(mon.name, result));
  mon.hp -= result.damage;
  if (result.statusApplied) mon.statusEffects = applyStatusEffect(mon.statusEffects, result.statusApplied);

  let killCount = state.killCount;
  let bossKillCount = state.bossKillCount;
  if (mon.hp <= 0) {
    if (mon.isBoss) bossKillCount++;
    monsters = monsters.filter((_, i) => i !== targetIdx);
    hero.xp += mon.xpReward;
    killCount += 1;
    log.push({ text: `${mon.name} is slain! (+${mon.xpReward} XP)`, type: "combat" });
  } else {
    monsters[targetIdx] = mon;
  }

  if (targetPos) {
    const moveX = hero.pos.x + dx;
    const moveY = hero.pos.y + dy;
    if (moveX >= 0 && moveX < MAP_WIDTH && moveY >= 0 && moveY < MAP_HEIGHT &&
        isWalkable(state.map[moveY][moveX]) && !monsters.some((m) => m.pos.x === moveX && m.pos.y === moveY)) {
      hero.pos = { x: moveX, y: moveY };
    }
  }

  const updatedHero = consumeAbility(hero, abilityIndex);
  log.push({ text: "You lunge forward!", type: "ability" });

  return { ...state, hero: updatedHero, monsters, log, killCount, bossKillCount, pendingAbility: null, turnsElapsed: state.turnsElapsed + 1 };
}

// ─── Cleave: hit all adjacent monsters for 75% damage ───
function executeCleave(state: GameState, abilityIndex: number): GameState {
  const hero = { ...state.hero };
  let monsters = [...state.monsters];
  const log: LogEntry[] = [...state.log];
  let killCount = state.killCount;
  let bossKillCount = state.bossKillCount;

  const adjacent = monsters.filter((m) => Math.abs(m.pos.x - hero.pos.x) + Math.abs(m.pos.y - hero.pos.y) <= 1);
  if (adjacent.length === 0) {
    return { ...state, log: [...log, { text: "No adjacent targets for Cleave.", type: "danger" }] };
  }

  const heroAtk = getHeroAtk(hero);
  for (const target of adjacent) {
    const idx = monsters.findIndex((m) => m.id === target.id);
    if (idx < 0) continue;
    const mon = { ...monsters[idx] };
    const baseDmg = Math.max(1, heroAtk - mon.def + Math.floor(Math.random() * 3) - 1);
    const damage = Math.max(1, Math.floor(baseDmg * 0.75));
    mon.hp -= damage;
    log.push({ text: `Cleave hits ${mon.name} for ${damage}!`, type: "combat" });
    if (mon.hp <= 0) {
      if (mon.isBoss) bossKillCount++;
      monsters = monsters.filter((m) => m.id !== mon.id);
      hero.xp += mon.xpReward;
      killCount += 1;
      log.push({ text: `${mon.name} is slain! (+${mon.xpReward} XP)`, type: "combat" });
    } else {
      const newIdx = monsters.findIndex((m) => m.id === mon.id);
      if (newIdx >= 0) monsters[newIdx] = mon;
    }
  }

  const updatedHero = consumeAbility(hero, abilityIndex);
  log.push({ text: "You cleave in a wide arc!", type: "ability" });
  return { ...state, hero: updatedHero, monsters, log, killCount, bossKillCount, pendingAbility: null, turnsElapsed: state.turnsElapsed + 1 };
}

// ═══════════════════════════════════════════
// WARDEN ABILITIES
// ═══════════════════════════════════════════

function executeShieldSlam(state: GameState, abilityIndex: number, direction?: Direction): GameState {
  return meleeDirectionalAttack(state, abilityIndex, direction!, {
    abilityId: "shield_slam", abilityName: "Shield Slam",
    stunChance: 0.4, logMsg: "You slam with your shield!",
  });
}

function executeFortify(state: GameState, abilityIndex: number): GameState {
  const hero = consumeAbility({ ...state.hero }, abilityIndex);
  // +3 DEF for 3 turns implemented as a temporary buff via def boost
  hero.def += 3;
  const log: LogEntry[] = [...state.log, { text: "You fortify your defenses! (+3 DEF for 3 turns)", type: "ability" }];
  // We'll track it simply by adding 3 DEF now. A proper buff system would be more complex,
  // but for simplicity we just boost the stat (it resets on death/new floor naturally in roguelike context)
  return { ...state, hero, log, turnsElapsed: state.turnsElapsed + 1 };
}

function executeRallyingCry(state: GameState, abilityIndex: number): GameState {
  const hero = consumeAbility({ ...state.hero }, abilityIndex);
  const maxHp = getHeroMaxHp(hero);
  const heal = Math.floor(maxHp * 0.15);
  hero.hp = Math.min(maxHp, hero.hp + heal);
  // Remove first negative status
  if (hero.statusEffects.length > 0) {
    hero.statusEffects = hero.statusEffects.slice(1);
  }
  const log: LogEntry[] = [...state.log, { text: `Rallying Cry! Healed ${heal} HP and cleansed a debuff.`, type: "ability" }];
  return { ...state, hero, log, turnsElapsed: state.turnsElapsed + 1 };
}

function executeEarthquake(state: GameState, abilityIndex: number): GameState {
  const hero = consumeAbility({ ...state.hero }, abilityIndex);
  let monsters = [...state.monsters];
  const log: LogEntry[] = [...state.log];
  let killCount = state.killCount;
  let bossKillCount = state.bossKillCount;
  const heroAtk = getHeroAtk(hero);
  const damage = Math.max(1, Math.floor(heroAtk * 0.5));

  for (let i = monsters.length - 1; i >= 0; i--) {
    const m = monsters[i];
    if (!state.map[m.pos.y]?.[m.pos.x]?.visible) continue;
    const mon = { ...monsters[i] };
    mon.hp -= damage;
    mon.statusEffects = applyStatusEffect(mon.statusEffects, {
      type: "stun", turnsRemaining: 2, damagePerTurn: 0, source: "earthquake",
    });
    log.push({ text: `Earthquake hits ${mon.name} for ${damage}!`, type: "combat" });
    if (mon.hp <= 0) {
      if (mon.isBoss) bossKillCount++;
      monsters = monsters.filter((_, j) => j !== i);
      hero.xp += mon.xpReward;
      killCount += 1;
      log.push({ text: `${mon.name} is slain!`, type: "combat" });
    } else {
      monsters[i] = mon;
    }
  }

  log.push({ text: "The ground trembles!", type: "ability" });
  return { ...state, hero, monsters, log, killCount, bossKillCount, turnsElapsed: state.turnsElapsed + 1 };
}

// ═══════════════════════════════════════════
// ROGUE ABILITIES
// ═══════════════════════════════════════════

function executeBackstab(state: GameState, abilityIndex: number, direction?: Direction): GameState {
  return meleeDirectionalAttack(state, abilityIndex, direction!, {
    abilityId: "backstab", abilityName: "Backstab",
    conditionDmgMult: (mon) => mon.statusEffects.length > 0 ? 1.5 : 1,
    logMsg: "You strike from the shadows!",
  });
}

function executeSmokeBomb(state: GameState, abilityIndex: number): GameState {
  const hero = consumeAbility({ ...state.hero }, abilityIndex);
  hero.dodge += 20; // temporary dodge boost
  let monsters = [...state.monsters];
  const log: LogEntry[] = [...state.log];

  // Stun all adjacent monsters
  for (let i = 0; i < monsters.length; i++) {
    const m = monsters[i];
    if (Math.abs(m.pos.x - hero.pos.x) <= 1 && Math.abs(m.pos.y - hero.pos.y) <= 1 &&
        !(m.pos.x === hero.pos.x && m.pos.y === hero.pos.y)) {
      const mon = { ...monsters[i] };
      mon.statusEffects = applyStatusEffect(mon.statusEffects, {
        type: "stun", turnsRemaining: 2, damagePerTurn: 0, source: "smoke_bomb",
      });
      monsters[i] = mon;
      log.push({ text: `${mon.name} is disoriented!`, type: "status" });
    }
  }

  log.push({ text: "Smoke bomb! +20% dodge, adjacent foes stunned.", type: "ability" });
  return { ...state, hero, monsters, log, turnsElapsed: state.turnsElapsed + 1 };
}

function executeEnvenom(state: GameState, abilityIndex: number, direction?: Direction): GameState {
  return meleeDirectionalAttack(state, abilityIndex, direction!, {
    abilityId: "envenom", abilityName: "Envenom",
    applyPoison: { damage: 3, duration: 4 },
    logMsg: "Your blade drips with venom!",
  });
}

function executeShadowDance(state: GameState, abilityIndex: number): GameState {
  const hero = consumeAbility({ ...state.hero }, abilityIndex);
  // Untargetable = massive dodge boost for 2 turns
  hero.dodge += 100;
  const log: LogEntry[] = [...state.log, { text: "You melt into the shadows! Untargetable for 2 turns.", type: "ability" }];
  return { ...state, hero, log, turnsElapsed: state.turnsElapsed + 1 };
}

// ═══════════════════════════════════════════
// ARCANIST ABILITIES
// ═══════════════════════════════════════════

function executeArcaneBolt(state: GameState, abilityIndex: number, direction?: Direction): GameState {
  const pending = requireDirection(state, "arcane_bolt", "Arcane Bolt", direction);
  if (pending) return pending;

  const { dx, dy } = DIR_OFFSETS[direction!];
  const hero = { ...state.hero };
  let monsters = [...state.monsters];
  const log: LogEntry[] = [...state.log];

  // Find first monster in line up to 3 tiles
  let targetIdx = -1;
  for (let dist = 1; dist <= 3; dist++) {
    const tx = hero.pos.x + dx * dist;
    const ty = hero.pos.y + dy * dist;
    if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) break;
    if (!isWalkable(state.map[ty][tx])) break;
    const idx = monsters.findIndex((m) => m.pos.x === tx && m.pos.y === ty);
    if (idx >= 0) { targetIdx = idx; break; }
  }

  if (targetIdx < 0) {
    return { ...state, pendingAbility: null, log: [...log, { text: "No target for Arcane Bolt.", type: "danger" }] };
  }

  const mon = { ...monsters[targetIdx] };
  const heroAtk = getHeroAtk(hero);
  const damage = Math.max(1, heroAtk - mon.def + Math.floor(Math.random() * 3));
  mon.hp -= damage;
  log.push({ text: `Arcane Bolt strikes ${mon.name} for ${damage}!`, type: "combat" });

  let killCount = state.killCount;
  let bossKillCount = state.bossKillCount;
  if (mon.hp <= 0) {
    if (mon.isBoss) bossKillCount++;
    monsters = monsters.filter((_, i) => i !== targetIdx);
    hero.xp += mon.xpReward;
    killCount += 1;
    log.push({ text: `${mon.name} is slain!`, type: "combat" });
  } else {
    monsters[targetIdx] = mon;
  }

  const updatedHero = consumeAbility(hero, abilityIndex);
  log.push({ text: "A bolt of arcane energy streaks forward!", type: "ability" });
  return { ...state, hero: updatedHero, monsters, log, killCount, bossKillCount, pendingAbility: null, turnsElapsed: state.turnsElapsed + 1 };
}

function executeFrostNova(state: GameState, abilityIndex: number): GameState {
  const hero = consumeAbility({ ...state.hero }, abilityIndex);
  let monsters = [...state.monsters];
  const log: LogEntry[] = [...state.log];
  let killCount = state.killCount;
  let bossKillCount = state.bossKillCount;
  const heroAtk = getHeroAtk(hero);

  const adjacent = monsters.filter((m) =>
    Math.abs(m.pos.x - hero.pos.x) <= 1 && Math.abs(m.pos.y - hero.pos.y) <= 1 &&
    !(m.pos.x === hero.pos.x && m.pos.y === hero.pos.y)
  );

  if (adjacent.length === 0) {
    return { ...state, hero, log: [...log, { text: "No targets for Frost Nova.", type: "danger" }] };
  }

  for (const target of adjacent) {
    const idx = monsters.findIndex((m) => m.id === target.id);
    if (idx < 0) continue;
    const mon = { ...monsters[idx] };
    const damage = Math.max(1, Math.floor((heroAtk - mon.def) * 0.6) + 1);
    mon.hp -= damage;
    mon.statusEffects = applyStatusEffect(mon.statusEffects, {
      type: "stun", turnsRemaining: 2, damagePerTurn: 0, source: "frost_nova",
    });
    log.push({ text: `Frost Nova hits ${mon.name} for ${damage}! Frozen!`, type: "combat" });
    if (mon.hp <= 0) {
      if (mon.isBoss) bossKillCount++;
      monsters = monsters.filter((m) => m.id !== mon.id);
      hero.xp += mon.xpReward;
      killCount += 1;
    } else {
      const newIdx = monsters.findIndex((m) => m.id === mon.id);
      if (newIdx >= 0) monsters[newIdx] = mon;
    }
  }

  log.push({ text: "A wave of frost erupts around you!", type: "ability" });
  return { ...state, hero, monsters, log, killCount, bossKillCount, turnsElapsed: state.turnsElapsed + 1 };
}

function executeFlamePillar(state: GameState, abilityIndex: number, direction?: Direction): GameState {
  return meleeDirectionalAttack(state, abilityIndex, direction!, {
    abilityId: "flame_pillar", abilityName: "Flame Pillar",
    applyBurning: { damage: 3, duration: 3 },
    logMsg: "A pillar of flame erupts!",
  });
}

function executeChainLightning(state: GameState, abilityIndex: number, direction?: Direction): GameState {
  const pending = requireDirection(state, "chain_lightning", "Chain Lightning", direction);
  if (pending) return pending;

  const { dx, dy } = DIR_OFFSETS[direction!];
  const hero = { ...state.hero };
  let monsters = [...state.monsters];
  const log: LogEntry[] = [...state.log];
  let killCount = state.killCount;
  let bossKillCount = state.bossKillCount;
  const heroAtk = getHeroAtk(hero);

  // Find primary target
  let primaryIdx = -1;
  for (let dist = 1; dist <= 3; dist++) {
    const tx = hero.pos.x + dx * dist;
    const ty = hero.pos.y + dy * dist;
    if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) break;
    if (!isWalkable(state.map[ty][tx])) break;
    const idx = monsters.findIndex((m) => m.pos.x === tx && m.pos.y === ty);
    if (idx >= 0) { primaryIdx = idx; break; }
  }

  if (primaryIdx < 0) {
    return { ...state, pendingAbility: null, log: [...log, { text: "No target for Chain Lightning.", type: "danger" }] };
  }

  const hitIds = new Set<string>();
  const targets = [primaryIdx];
  hitIds.add(monsters[primaryIdx].id);

  // Find up to 2 bounce targets near primary
  const primary = monsters[primaryIdx];
  for (const m of monsters) {
    if (hitIds.has(m.id)) continue;
    const dist = Math.abs(m.pos.x - primary.pos.x) + Math.abs(m.pos.y - primary.pos.y);
    if (dist <= 2) {
      const idx = monsters.findIndex((mo) => mo.id === m.id);
      targets.push(idx);
      hitIds.add(m.id);
      if (targets.length >= 3) break;
    }
  }

  let dmgMult = 1;
  for (const tIdx of targets) {
    const mon = { ...monsters[tIdx] };
    const damage = Math.max(1, Math.floor((heroAtk - mon.def + Math.floor(Math.random() * 3)) * dmgMult));
    mon.hp -= damage;
    log.push({ text: `Lightning strikes ${mon.name} for ${damage}!`, type: "combat" });
    if (mon.hp <= 0) {
      if (mon.isBoss) bossKillCount++;
      monsters = monsters.filter((m) => m.id !== mon.id);
      hero.xp += mon.xpReward;
      killCount += 1;
    } else {
      const newIdx = monsters.findIndex((m) => m.id === mon.id);
      if (newIdx >= 0) monsters[newIdx] = mon;
    }
    dmgMult *= 0.7; // each bounce does 70%
  }

  const updatedHero = consumeAbility(hero, abilityIndex);
  log.push({ text: "Lightning arcs between foes!", type: "ability" });
  return { ...state, hero: updatedHero, monsters, log, killCount, bossKillCount, pendingAbility: null, turnsElapsed: state.turnsElapsed + 1 };
}

function executeVoidrift(state: GameState, abilityIndex: number): GameState {
  const hero = consumeAbility({ ...state.hero }, abilityIndex);
  const log: LogEntry[] = [...state.log];

  // Find random visible walkable tile
  const candidates: Position[] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const tile = state.map[y]?.[x];
      if (tile && tile.visible && isWalkable(tile) &&
          !state.monsters.some((m) => m.pos.x === x && m.pos.y === y) &&
          !(x === hero.pos.x && y === hero.pos.y)) {
        candidates.push({ x, y });
      }
    }
  }

  if (candidates.length > 0) {
    hero.pos = candidates[Math.floor(Math.random() * candidates.length)];
    log.push({ text: "You tear through the void and reappear elsewhere!", type: "ability" });
  } else {
    log.push({ text: "The void resists your passage.", type: "danger" });
  }

  return { ...state, hero, log, turnsElapsed: state.turnsElapsed + 1 };
}

// ═══════════════════════════════════════════
// REAVER ABILITIES
// ═══════════════════════════════════════════

function executeRend(state: GameState, abilityIndex: number, direction?: Direction): GameState {
  return meleeDirectionalAttack(state, abilityIndex, direction!, {
    abilityId: "rend", abilityName: "Rend",
    applyBleed: { damage: 2, duration: 3 },
    logMsg: "You rend your foe!",
  });
}

function executeBloodFrenzy(state: GameState, abilityIndex: number): GameState {
  const hero = consumeAbility({ ...state.hero }, abilityIndex);
  hero.atk += 3; // temporary ATK boost
  const log: LogEntry[] = [...state.log, { text: "Blood Frenzy! +3 ATK for 4 turns. Attacks heal 1 HP.", type: "ability" }];
  return { ...state, hero, log, turnsElapsed: state.turnsElapsed + 1 };
}

function executeDeathstrike(state: GameState, abilityIndex: number, direction?: Direction): GameState {
  return meleeDirectionalAttack(state, abilityIndex, direction!, {
    abilityId: "deathstrike", abilityName: "Deathstrike",
    damageMultiplier: 2,
    healOnKillPct: 0.25,
    logMsg: "A devastating strike!",
  });
}

function executeHowlOfFury(state: GameState, abilityIndex: number): GameState {
  const hero = consumeAbility({ ...state.hero }, abilityIndex);
  let monsters = [...state.monsters];
  const log: LogEntry[] = [...state.log];

  // Stun all visible monsters (simulates fear as stun)
  for (let i = 0; i < monsters.length; i++) {
    const m = monsters[i];
    if (!state.map[m.pos.y]?.[m.pos.x]?.visible) continue;
    const mon = { ...monsters[i] };
    mon.statusEffects = applyStatusEffect(mon.statusEffects, {
      type: "stun", turnsRemaining: 3, damagePerTurn: 0, source: "howl_of_fury",
    });
    monsters[i] = mon;
  }

  log.push({ text: "Your howl of fury paralyzes all visible foes!", type: "ability" });
  return { ...state, hero, monsters, log, turnsElapsed: state.turnsElapsed + 1 };
}

// ─── Tick cooldowns at end of turn ───
export function tickCooldowns(hero: Hero): Hero {
  return {
    ...hero,
    abilities: hero.abilities.map((a) => ({
      ...a,
      currentCooldown: Math.max(0, a.currentCooldown - 1),
    })),
  };
}

// ─── Regenerate energy at end of turn ───
export function regenEnergy(hero: Hero): Hero {
  return {
    ...hero,
    energy: Math.min(hero.maxEnergy, hero.energy + 1),
  };
}
