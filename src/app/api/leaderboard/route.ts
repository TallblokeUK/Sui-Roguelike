import { NextRequest, NextResponse } from "next/server";
import { Transaction } from "@mysten/sui/transactions";
import pool from "@/lib/db";
import client from "@/lib/sui-client";
import { getSponsorKeypair } from "@/lib/sponsor";
import { heroTarget } from "@/lib/contracts";
import crypto from "crypto";

export const maxDuration = 15;

// GET /api/leaderboard — fetch top runs
export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT hero_name, player_name, level, floor, kills, turns, cause_of_death, created_at
      FROM runs
      ORDER BY floor DESC, level DESC, kills DESC
      LIMIT 20
    `);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Leaderboard fetch error:", err);
    return NextResponse.json([], { status: 500 });
  }
}

// POST /api/leaderboard — save a run + record death on-chain
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      heroName,
      level,
      floor,
      kills,
      turns,
      causeOfDeath,
      playerAddress,
      playerName,
      sub,
    } = body;

    if (!heroName || typeof floor !== "number") {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const id = crypto.randomUUID();

    // 1. Save to database
    await pool.query(
      `INSERT INTO runs (id, user_id, hero_name, player_name, level, floor, kills, turns, cause_of_death)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        sub || playerAddress || "unknown",
        heroName,
        playerName || "Adventurer",
        level,
        floor,
        kills,
        turns,
        causeOfDeath || "",
      ],
    );

    // 2. Record death on-chain via record_death (sponsor-signed, always reliable)
    const digest = await recordDeathOnChain(heroName, level, floor, kills, turns, causeOfDeath || "Unknown", playerAddress || "0x0");

    return NextResponse.json({ id, onChainDigest: digest });
  } catch (err) {
    console.error("Leaderboard save error:", err);
    return NextResponse.json(
      { error: "Failed to save run" },
      { status: 500 },
    );
  }
}

// Record death on-chain — awaited so Vercel doesn't kill the function early
async function recordDeathOnChain(
  heroName: string,
  level: number,
  floor: number,
  kills: number,
  turns: number,
  causeOfDeath: string,
  playerAddress: string,
): Promise<string | null> {
  try {
    const keypair = getSponsorKeypair();
    const tx = new Transaction();
    tx.moveCall({
      target: heroTarget("record_death"),
      arguments: [
        tx.pure.string(heroName),
        tx.pure.u64(level),
        tx.pure.u64(floor),
        tx.pure.u64(kills),
        tx.pure.u64(turns),
        tx.pure.string(causeOfDeath),
        tx.pure.address(playerAddress),
      ],
    });

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showEffects: true },
    });
    console.log("Death recorded on-chain:", result.digest);
    return result.digest;
  } catch (err) {
    console.error("record_death on-chain error:", err instanceof Error ? err.message : err);
    return null;
  }
}
