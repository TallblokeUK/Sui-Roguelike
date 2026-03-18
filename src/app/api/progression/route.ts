import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { UPGRADE_CATALOG, computeMetaBonuses } from "@/lib/game/meta-progression";

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
      "SELECT soul_embers, total_embers_earned, upgrades FROM account_progression WHERE sub = $1",
      [sub],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        soulEmbers: 0,
        totalEmbersEarned: 0,
        upgrades: {},
      });
    }

    const row = result.rows[0];
    return NextResponse.json({
      soulEmbers: row.soul_embers,
      totalEmbersEarned: row.total_embers_earned,
      upgrades: row.upgrades,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Load progression error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/progression
 * Award soul embers after a run ends.
 * Body: { sub, floor, level, kills }
 */
export async function POST(req: NextRequest) {
  try {
    const { sub, floor, level, kills } = await req.json();
    if (!sub || floor == null || level == null || kills == null) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Get current upgrades to compute ember multiplier
    const existing = await pool.query(
      "SELECT upgrades FROM account_progression WHERE sub = $1",
      [sub],
    );
    const upgrades = existing.rows.length > 0 ? existing.rows[0].upgrades : {};
    const { emberMultiplier } = computeMetaBonuses(upgrades);

    // Calculate embers
    const floorEmbers = floor * 3;
    const killEmbers = kills;
    const levelEmbers = (level - 1) * 5;
    const bossFloorsCleared = Math.floor((floor - 1) / 5);
    const bossEmbers = bossFloorsCleared * 10;
    const base = floorEmbers + killEmbers + levelEmbers + bossEmbers;
    const bonus = emberMultiplier > 1 ? Math.floor(base * (emberMultiplier - 1)) : 0;
    const total = base + bonus;

    // Upsert
    await pool.query(
      `INSERT INTO account_progression (sub, soul_embers, total_embers_earned, updated_at)
       VALUES ($1, $2, $2, NOW())
       ON CONFLICT (sub) DO UPDATE SET
         soul_embers = account_progression.soul_embers + $2,
         total_embers_earned = account_progression.total_embers_earned + $2,
         updated_at = NOW()`,
      [sub, total],
    );

    return NextResponse.json({ embersEarned: total });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Earn embers error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
