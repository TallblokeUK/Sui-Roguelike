import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { computeMetaBonuses } from "@/lib/game/meta-progression";
import { checkAchievements } from "@/lib/game/achievements";
import type { RunStats, LifetimeStats } from "@/lib/game/achievements";

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

/**
 * GET /api/progression?sub=xxx
 * Load account progression for the given player.
 */
export async function GET(req: NextRequest) {
  const sub = req.nextUrl.searchParams.get("sub");
  if (!sub) {
    return NextResponse.json({ error: "Missing sub" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      "SELECT soul_embers, total_embers_earned, upgrades, achievements FROM account_progression WHERE sub = $1",
      [sub],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        soulEmbers: 0,
        totalEmbersEarned: 0,
        upgrades: {},
        achievements: [],
      });
    }

    const row = result.rows[0];
    return NextResponse.json({
      soulEmbers: row.soul_embers,
      totalEmbersEarned: row.total_embers_earned,
      upgrades: row.upgrades,
      achievements: row.achievements ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Load progression error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/progression
 * Award soul embers + check achievements after a run ends.
 * Body: { sub, floor, level, kills, heroClass, bossKills, turns, heroHp, heroMaxHp }
 */
export async function POST(req: NextRequest) {
  try {
    const { sub, floor, level, kills, heroClass, bossKills, turns, heroHp, heroMaxHp, playerAddress, playerName } = await req.json();
    if (!sub || floor == null || level == null || kills == null) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Get current account data
    const existing = await pool.query(
      "SELECT upgrades, achievements FROM account_progression WHERE sub = $1",
      [sub],
    );
    const upgrades = existing.rows.length > 0 ? existing.rows[0].upgrades : {};
    const currentAchievements: string[] = existing.rows.length > 0 ? (existing.rows[0].achievements ?? []) : [];
    const { emberMultiplier } = computeMetaBonuses(upgrades);

    // Calculate embers
    const floorEmbers = floor * 3;
    const killEmbers = kills;
    const levelEmbers = (level - 1) * 5;
    const bossFloorsCleared = Math.floor((floor - 1) / 5);
    const bossEmbers = bossFloorsCleared * 10;
    const base = floorEmbers + killEmbers + levelEmbers + bossEmbers;
    const bonus = emberMultiplier > 1 ? Math.floor(base * (emberMultiplier - 1)) : 0;
    let total = base + bonus;

    // Check achievements
    const runStats: RunStats = {
      floor,
      kills,
      bossKills: bossKills ?? 0,
      turns: turns ?? 0,
      heroClass: heroClass ?? "warden",
      heroHp: heroHp ?? 0,
      heroMaxHp: heroMaxHp ?? 30,
    };

    // Aggregate lifetime stats from runs table
    const lifetimeResult = await pool.query(
      `SELECT COALESCE(SUM(kills), 0) as total_kills,
              array_agg(DISTINCT hero_class) as classes_played,
              COALESCE(MAX(floor), 0) as max_floor
       FROM runs WHERE user_id = $1`,
      [sub],
    );
    const lifetimeRow = lifetimeResult.rows[0];
    const totalBossKillsResult = await pool.query(
      `SELECT COALESCE(SUM(
        CASE WHEN floor >= 5 THEN floor / 5 ELSE 0 END
      ), 0) as total_boss_kills FROM runs WHERE user_id = $1`,
      [sub],
    );

    const lifetime: LifetimeStats = {
      totalKills: Number(lifetimeRow.total_kills) + kills,
      totalBossKills: Number(totalBossKillsResult.rows[0].total_boss_kills) + (bossKills ?? 0),
      classesPlayed: [...new Set([...(lifetimeRow.classes_played?.filter(Boolean) ?? []), heroClass ?? "warden"])],
      maxFloor: Math.max(Number(lifetimeRow.max_floor), floor),
    };

    const newAchievements = checkAchievements(runStats, lifetime, currentAchievements);
    const achievementEmbers = newAchievements.reduce((sum, a) => sum + a.emberReward, 0);
    total += achievementEmbers;

    const updatedAchievements = [...currentAchievements, ...newAchievements.map(a => a.id)];

    // Upsert
    await pool.query(
      `INSERT INTO account_progression (sub, soul_embers, total_embers_earned, achievements, player_address, player_name, updated_at)
       VALUES ($1, $2, $2, $3, $4, $5, NOW())
       ON CONFLICT (sub) DO UPDATE SET
         soul_embers = account_progression.soul_embers + $2,
         total_embers_earned = account_progression.total_embers_earned + $2,
         achievements = $3,
         player_address = COALESCE($4, account_progression.player_address),
         player_name = COALESCE($5, account_progression.player_name),
         updated_at = NOW()`,
      [sub, total, JSON.stringify(updatedAchievements), playerAddress || null, playerName || null],
    );

    return NextResponse.json({
      embersEarned: total,
      newAchievements: newAchievements.map(a => ({ id: a.id, name: a.name, description: a.description, emberReward: a.emberReward })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Earn embers error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
