import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { UPGRADE_CATALOG, getNextTierCost } from "@/lib/game/meta-progression";

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

/**
 * POST /api/progression/purchase
 * Purchase an upgrade tier.
 * Body: { sub, upgradeId }
 */
export async function POST(req: NextRequest) {
  try {
    const { sub, upgradeId } = await req.json();
    if (!sub || !upgradeId) {
      return NextResponse.json({ error: "Missing sub or upgradeId" }, { status: 400 });
    }

    const upgrade = UPGRADE_CATALOG.find((u) => u.id === upgradeId);
    if (!upgrade) {
      return NextResponse.json({ error: "Unknown upgrade" }, { status: 400 });
    }

    // Get current state
    const result = await pool.query(
      "SELECT soul_embers, upgrades FROM account_progression WHERE sub = $1",
      [sub],
    );

    const currentEmbers = result.rows.length > 0 ? result.rows[0].soul_embers : 0;
    const currentUpgrades = result.rows.length > 0 ? result.rows[0].upgrades : {};
    const currentTier = currentUpgrades[upgradeId] ?? 0;

    const cost = getNextTierCost(upgrade, currentTier);
    if (cost === null) {
      return NextResponse.json({ error: "Already at max tier" }, { status: 400 });
    }
    if (currentEmbers < cost) {
      return NextResponse.json({ error: "Not enough soul embers" }, { status: 400 });
    }

    // Apply purchase
    const newUpgrades = { ...currentUpgrades, [upgradeId]: currentTier + 1 };
    const newEmbers = currentEmbers - cost;

    await pool.query(
      `INSERT INTO account_progression (sub, soul_embers, total_embers_earned, upgrades, updated_at)
       VALUES ($1, $2, 0, $3, NOW())
       ON CONFLICT (sub) DO UPDATE SET
         soul_embers = $2,
         upgrades = $3,
         updated_at = NOW()`,
      [sub, newEmbers, JSON.stringify(newUpgrades)],
    );

    return NextResponse.json({
      soulEmbers: newEmbers,
      upgrades: newUpgrades,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Purchase error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
