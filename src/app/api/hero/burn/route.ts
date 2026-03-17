import { NextRequest, NextResponse } from "next/server";
import { Transaction } from "@mysten/sui/transactions";
import client from "@/lib/sui-client";
import { getSponsorKeypair } from "@/lib/sponsor";
import { heroTarget } from "@/lib/contracts";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import pool from "@/lib/db";
import crypto from "crypto";

export const maxDuration = 15;

/**
 * POST /api/hero/burn
 * Burn a Hero on death, emitting a HeroDeath event on Sui.
 * Also saves the run to the database for leaderboard.
 * Body: { heroObjectId, heroName, level, floor, kills, turns, causeOfDeath }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { heroObjectId, heroName, level, floor, kills, turns, causeOfDeath } =
      await req.json();

    if (!heroObjectId || !heroName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const keypair = getSponsorKeypair();
    const tx = new Transaction();
    tx.moveCall({
      target: heroTarget("burn_hero"),
      arguments: [
        tx.object(heroObjectId),
        tx.pure.u64(level || 1),
        tx.pure.u64(floor || 1),
        tx.pure.u64(kills || 0),
        tx.pure.u64(turns || 0),
        tx.pure.string(causeOfDeath || "Unknown"),
      ],
    });

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
    });

    // Also save to database for leaderboard
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO runs (id, user_id, hero_name, level, floor, kills, turns, cause_of_death)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, session.user.id, heroName, level, floor, kills, turns, causeOfDeath || ""]
    );

    return NextResponse.json({ digest: result.digest });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Hero burn error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
