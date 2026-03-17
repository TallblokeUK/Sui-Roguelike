import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import pool from "@/lib/db";
import crypto from "crypto";

// GET /api/leaderboard — fetch top runs
export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT r.hero_name, r.level, r.floor, r.kills, r.turns, r.cause_of_death, r.created_at,
             u.name as player_name
      FROM runs r
      JOIN "user" u ON r.user_id = u.id
      ORDER BY r.floor DESC, r.level DESC, r.kills DESC
      LIMIT 20
    `);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Leaderboard fetch error:", err);
    return NextResponse.json([], { status: 500 });
  }
}

// POST /api/leaderboard — save a run (requires auth)
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { heroName, level, floor, kills, turns, causeOfDeath } = body;

    if (!heroName || typeof floor !== "number") {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO runs (id, user_id, hero_name, level, floor, kills, turns, cause_of_death)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, session.user.id, heroName, level, floor, kills, turns, causeOfDeath || ""]
    );

    return NextResponse.json({ id });
  } catch (err) {
    console.error("Leaderboard save error:", err);
    return NextResponse.json({ error: "Failed to save run" }, { status: 500 });
  }
}
