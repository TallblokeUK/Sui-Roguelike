import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * GET /api/player?name=Mark
 * Search for a player by display name, returns their Sui address.
 * Searches account_progression (exact match first, then partial).
 * Falls back to player_name in runs table.
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  try {
    // Exact match on account_progression
    let result = await pool.query(
      `SELECT player_name, player_address FROM account_progression
       WHERE LOWER(player_name) = LOWER($1) AND player_address IS NOT NULL
       LIMIT 5`,
      [name],
    );

    // Partial match fallback
    if (result.rows.length === 0) {
      result = await pool.query(
        `SELECT player_name, player_address FROM account_progression
         WHERE LOWER(player_name) LIKE LOWER($1) AND player_address IS NOT NULL
         LIMIT 5`,
        [`%${name}%`],
      );
    }

    // Fall back to runs table if no progression data
    if (result.rows.length === 0) {
      const runsResult = await pool.query(
        `SELECT DISTINCT ON (user_id) player_name, user_id as sub
         FROM runs
         WHERE LOWER(player_name) LIKE LOWER($1)
         LIMIT 5`,
        [`%${name}%`],
      );

      // These won't have addresses stored yet, return what we have
      return NextResponse.json({
        players: runsResult.rows.map((r) => ({
          name: r.player_name,
          address: null,
        })),
      });
    }

    return NextResponse.json({
      players: result.rows.map((r) => ({
        name: r.player_name,
        address: r.player_address,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Player lookup error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
