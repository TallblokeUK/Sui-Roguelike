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
} from "./types";
import { isWalkable } from "./dungeon";
import { resolveMeleeAttack, formatHeroAttack, applyStatusEffect } from "./combat";
import { getHeroAtk } from "./state";

// ─── Default abilities every hero starts with ───
export function getStartingAbilities(): Ability[] {
  return [
    {
      id: "lunge",
      name: "Lunge",
      description: "Strike a monster up to 2 tiles away and close the gap",
      energyCost: 1,
      cooldown: 0,
      currentCooldown: 0,
      range: 2,
    },
    {
      id: "shield_bash",
      name: "Shield Bash",
      description: "Melee attack with 50% chance to stun for 1 turn",
      energyCost: 2,
      cooldown: 3,
      currentCooldown: 0,
      range: 1,
    },
    {
      id: "cleave",
      name: "Cleave",
      description: "Hit all adjacent monsters for 75% damage",
      energyCost: 2,
      cooldown: 4,
      currentCooldown: 0,
      range: 0, // 0 = hits all adjacent, no direction needed
    },
  ];
}

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
    case "lunge":
      return executeLunge(state, abilityIndex, direction);
    case "shield_bash":
      return executeShieldBash(state, abilityIndex, direction);
    case "cleave":
      return executeCleave(state, abilityIndex);
    default:
      return state;
  }
}

// ─── Lunge: attack up to 2 tiles away, move adjacent ───
function executeLunge(
  state: GameState,
  abilityIndex: number,
  direction?: Direction,
): GameState {
  if (!direction) {
    return {
      ...state,
      pendingAbility: "lunge",
      log: [...state.log, { text: "Lunge: choose a direction (arrow/WASD)", type: "ability" }],
    };
  }

  const { dx, dy } = DIR_OFFSETS[direction];
  const hero = { ...state.hero };
  let monsters = [...state.monsters];
  const log: LogEntry[] = [...state.log];

  // Find monster in range (1 or 2 tiles in direction)
  let targetIdx = -1;
  let targetPos: Position | null = null;

  for (let dist = 1; dist <= 2; dist++) {
    const tx = hero.pos.x + dx * dist;
    const ty = hero.pos.y + dy * dist;
    if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) break;
    if (!isWalkable(state.map[ty][tx]) && dist === 1) break; // wall blocks lunge

    const idx = monsters.findIndex((m) => m.pos.x === tx && m.pos.y === ty);
    if (idx >= 0) {
      targetIdx = idx;
      targetPos = { x: tx, y: ty };
      break;
    }
  }

  if (targetIdx < 0) {
    return {
      ...state,
      pendingAbility: null,
      log: [...log, { text: "No target in range for Lunge.", type: "danger" }],
    };
  }

  // Attack the target
  const mon = { ...monsters[targetIdx] };
  const heroAtk = getHeroAtk(hero);
  const result = resolveMeleeAttack(heroAtk, mon.def, hero.critChance, 0); // monsters don't dodge lunge
  log.push(...formatHeroAttack(mon.name, result));

  mon.hp -= result.damage;
  if (result.statusApplied) {
    mon.statusEffects = applyStatusEffect(mon.statusEffects, result.statusApplied);
  }

  let killCount = state.killCount;
  if (mon.hp <= 0) {
    monsters = monsters.filter((_, i) => i !== targetIdx);
    hero.xp += mon.xpReward;
    killCount += 1;
    log.push({ text: `${mon.name} is slain! (+${mon.xpReward} XP)`, type: "combat" });
  } else {
    monsters[targetIdx] = mon;
  }

  // Move hero adjacent to target (1 tile in direction if possible)
  if (targetPos) {
    const moveX = hero.pos.x + dx;
    const moveY = hero.pos.y + dy;
    if (
      moveX >= 0 && moveX < MAP_WIDTH &&
      moveY >= 0 && moveY < MAP_HEIGHT &&
      isWalkable(state.map[moveY][moveX]) &&
      !monsters.some((m) => m.pos.x === moveX && m.pos.y === moveY)
    ) {
      hero.pos = { x: moveX, y: moveY };
    }
  }

  // Consume energy, set cooldown
  hero.energy -= state.hero.abilities[abilityIndex].energyCost;
  hero.abilities = hero.abilities.map((a, i) =>
    i === abilityIndex ? { ...a, currentCooldown: a.cooldown } : a,
  );

  log.push({ text: `You lunge forward!`, type: "ability" });

  return {
    ...state,
    hero,
    monsters,
    log,
    killCount,
    pendingAbility: null,
    turnsElapsed: state.turnsElapsed + 1,
  };
}

// ─── Shield Bash: melee attack + 50% stun ───
function executeShieldBash(
  state: GameState,
  abilityIndex: number,
  direction?: Direction,
): GameState {
  if (!direction) {
    return {
      ...state,
      pendingAbility: "shield_bash",
      log: [...state.log, { text: "Shield Bash: choose a direction", type: "ability" }],
    };
  }

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
      log: [...log, { text: "No target for Shield Bash.", type: "danger" }],
    };
  }

  const mon = { ...monsters[targetIdx] };
  const heroAtk = getHeroAtk(hero);
  const result = resolveMeleeAttack(heroAtk, mon.def, hero.critChance, 0);
  log.push(...formatHeroAttack(mon.name, result));

  mon.hp -= result.damage;
  if (result.statusApplied) {
    mon.statusEffects = applyStatusEffect(mon.statusEffects, result.statusApplied);
  }

  // 50% stun chance
  if (Math.random() < 0.5 && mon.hp > 0) {
    mon.statusEffects = applyStatusEffect(mon.statusEffects, {
      type: "stun",
      turnsRemaining: 2, // 2 because it ticks down at start of monster's turn
      damagePerTurn: 0,
      source: "shield_bash",
    });
    log.push({ text: `${mon.name} is stunned!`, type: "status" });
  }

  let killCount = state.killCount;
  if (mon.hp <= 0) {
    monsters = monsters.filter((_, i) => i !== targetIdx);
    hero.xp += mon.xpReward;
    killCount += 1;
    log.push({ text: `${mon.name} is slain! (+${mon.xpReward} XP)`, type: "combat" });
  } else {
    monsters[targetIdx] = mon;
  }

  hero.energy -= state.hero.abilities[abilityIndex].energyCost;
  hero.abilities = hero.abilities.map((a, i) =>
    i === abilityIndex ? { ...a, currentCooldown: a.cooldown } : a,
  );

  log.push({ text: "You bash with your shield!", type: "ability" });

  return {
    ...state,
    hero,
    monsters,
    log,
    killCount,
    pendingAbility: null,
    turnsElapsed: state.turnsElapsed + 1,
  };
}

// ─── Cleave: hit all adjacent monsters for 75% damage ───
function executeCleave(state: GameState, abilityIndex: number): GameState {
  const hero = { ...state.hero };
  let monsters = [...state.monsters];
  const log: LogEntry[] = [...state.log];
  let killCount = state.killCount;

  const adjacent = monsters.filter((m) => {
    const dist = Math.abs(m.pos.x - hero.pos.x) + Math.abs(m.pos.y - hero.pos.y);
    return dist <= 1;
  });

  if (adjacent.length === 0) {
    return {
      ...state,
      log: [...log, { text: "No adjacent targets for Cleave.", type: "danger" }],
    };
  }

  const heroAtk = getHeroAtk(hero);

  for (const target of adjacent) {
    const idx = monsters.findIndex((m) => m.id === target.id);
    if (idx < 0) continue;

    const mon = { ...monsters[idx] };
    // 75% damage, no crit on cleave
    const baseDmg = Math.max(1, heroAtk - mon.def + Math.floor(Math.random() * 3) - 1);
    const damage = Math.max(1, Math.floor(baseDmg * 0.75));
    mon.hp -= damage;

    log.push({ text: `Cleave hits ${mon.name} for ${damage} damage!`, type: "combat" });

    if (mon.hp <= 0) {
      monsters = monsters.filter((m) => m.id !== mon.id);
      hero.xp += mon.xpReward;
      killCount += 1;
      log.push({ text: `${mon.name} is slain! (+${mon.xpReward} XP)`, type: "combat" });
    } else {
      const newIdx = monsters.findIndex((m) => m.id === mon.id);
      if (newIdx >= 0) monsters[newIdx] = mon;
    }
  }

  hero.energy -= state.hero.abilities[abilityIndex].energyCost;
  hero.abilities = hero.abilities.map((a, i) =>
    i === abilityIndex ? { ...a, currentCooldown: a.cooldown } : a,
  );

  log.push({ text: "You cleave in a wide arc!", type: "ability" });

  return {
    ...state,
    hero,
    monsters,
    log,
    killCount,
    pendingAbility: null,
    turnsElapsed: state.turnsElapsed + 1,
  };
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
