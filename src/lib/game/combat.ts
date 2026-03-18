import {
  type Hero,
  type Monster,
  type AttackResult,
  type StatusEffect,
  type LogEntry,
} from "./types";

// ─── Resolve a melee attack ───
export function resolveMeleeAttack(
  attackerAtk: number,
  defenderDef: number,
  attackerCritChance: number,
  defenderDodge: number,
  statusOnHit?: Monster["statusOnHit"],
): AttackResult {
  // Dodge check
  if (Math.random() * 100 < defenderDodge) {
    return { damage: 0, isCrit: false, isDodged: true };
  }

  // Base damage
  let damage = Math.max(1, attackerAtk - defenderDef + Math.floor(Math.random() * 3) - 1);

  // Critical hit check
  const isCrit = Math.random() * 100 < attackerCritChance;
  if (isCrit) {
    damage = Math.floor(damage * 1.5);
  }

  // Status effect on hit
  let statusApplied: StatusEffect | undefined;
  if (statusOnHit && Math.random() * 100 < statusOnHit.chance) {
    statusApplied = {
      type: statusOnHit.type,
      turnsRemaining: statusOnHit.duration,
      damagePerTurn: statusOnHit.damage,
      source: "attack",
    };
  }

  return { damage, isCrit, isDodged: false, statusApplied };
}

// ─── Process status effects on an entity, returning damage taken and updated effects ───
export function processStatusEffects(
  effects: StatusEffect[],
  entityName: string,
): { damage: number; remaining: StatusEffect[]; log: LogEntry[] } {
  let damage = 0;
  const log: LogEntry[] = [];
  const remaining: StatusEffect[] = [];

  for (const effect of effects) {
    if (effect.type === "stun") {
      log.push({ text: `${entityName} is stunned!`, type: "status" });
      const updated = { ...effect, turnsRemaining: effect.turnsRemaining - 1 };
      if (updated.turnsRemaining > 0) remaining.push(updated);
      continue;
    }

    if (effect.damagePerTurn > 0) {
      damage += effect.damagePerTurn;
      const label = effect.type === "poison" ? "Poison" : effect.type === "bleed" ? "Bleed" : "Burning";
      log.push({
        text: `${label} deals ${effect.damagePerTurn} damage to ${entityName}!`,
        type: "status",
      });
    }

    const updated = { ...effect, turnsRemaining: effect.turnsRemaining - 1 };
    if (updated.turnsRemaining > 0) {
      remaining.push(updated);
    } else {
      const label = effect.type === "poison" ? "Poison" : effect.type === "bleed" ? "Bleed" : effect.type === "burning" ? "Burning" : "Stun";
      log.push({ text: `${label} wears off ${entityName}.`, type: "status" });
    }
  }

  return { damage, remaining, log };
}

// ─── Apply a status effect (handles stacking for bleed) ───
export function applyStatusEffect(
  existing: StatusEffect[],
  newEffect: StatusEffect,
): StatusEffect[] {
  // Bleed stacks — add a new instance
  if (newEffect.type === "bleed") {
    return [...existing, newEffect];
  }

  // Other effects refresh duration if already present
  const idx = existing.findIndex((e) => e.type === newEffect.type);
  if (idx >= 0) {
    const updated = [...existing];
    updated[idx] = newEffect;
    return updated;
  }

  return [...existing, newEffect];
}

// ─── Check if entity is stunned ───
export function isStunned(effects: StatusEffect[]): boolean {
  return effects.some((e) => e.type === "stun" && e.turnsRemaining > 0);
}

// ─── Format attack result for combat log ───
export function formatHeroAttack(monsterName: string, result: AttackResult): LogEntry[] {
  const entries: LogEntry[] = [];

  if (result.isDodged) {
    entries.push({ text: `${monsterName} dodges your attack!`, type: "combat" });
    return entries;
  }

  const critText = result.isCrit ? "Critical hit! " : "";
  entries.push({
    text: `${critText}You hit ${monsterName} for ${result.damage} damage!`,
    type: "combat",
  });

  if (result.statusApplied) {
    const label = result.statusApplied.type;
    entries.push({
      text: `${monsterName} is ${label === "burning" ? "set ablaze" : label === "poison" ? "poisoned" : label === "bleed" ? "bleeding" : "stunned"}!`,
      type: "status",
    });
  }

  return entries;
}

export function formatMonsterAttack(monsterName: string, result: AttackResult): LogEntry[] {
  const entries: LogEntry[] = [];

  if (result.isDodged) {
    entries.push({ text: `You dodge ${monsterName}'s attack!`, type: "combat" });
    return entries;
  }

  const critText = result.isCrit ? "Critical hit! " : "";
  entries.push({
    text: `${critText}${monsterName} hits you for ${result.damage} damage!`,
    type: "combat",
  });

  if (result.statusApplied) {
    const label = result.statusApplied.type;
    entries.push({
      text: `You are ${label === "burning" ? "set ablaze" : label === "poison" ? "poisoned" : label === "bleed" ? "bleeding" : "stunned"}!`,
      type: "status",
    });
  }

  return entries;
}
