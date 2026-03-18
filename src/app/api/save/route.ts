import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

/**
 * GET /api/save?sub=xxx
 * Load a saved game state for the given player.
 */
export async function GET(req: NextRequest) {
  const sub = req.nextUrl.searchParams.get("sub");
  if (!sub) {
    return NextResponse.json({ error: "Missing sub" }, { status: 400 });
  }

  try {
    const result = await pool.query("SELECT state FROM saves WHERE sub = $1", [sub]);
    if (result.rows.length === 0) {
      return NextResponse.json({ save: null });
    }
    return NextResponse.json({ save: result.rows[0].state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Load save error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/save
 * Save or update a game state.
 * Body: { sub, state }
 */
export async function POST(req: NextRequest) {
  try {
    const { sub, state } = await req.json();
    if (!sub || !state) {
      return NextResponse.json({ error: "Missing sub or state" }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO saves (sub, state, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (sub) DO UPDATE SET state = $2, updated_at = NOW()`,
      [sub, JSON.stringify(state)],
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Save error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/save?sub=xxx
 * Delete a saved game (on death or victory).
 */
export async function DELETE(req: NextRequest) {
  const sub = req.nextUrl.searchParams.get("sub");
  if (!sub) {
    return NextResponse.json({ error: "Missing sub" }, { status: 400 });
  }

  try {
    await pool.query("DELETE FROM saves WHERE sub = $1", [sub]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Delete save error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
