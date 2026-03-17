import { NextRequest, NextResponse } from "next/server";
import { Transaction } from "@mysten/sui/transactions";
import client from "@/lib/sui-client";
import { getSponsorKeypair } from "@/lib/sponsor";
import { heroTarget } from "@/lib/contracts";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import pool from "@/lib/db";

export const maxDuration = 15;

/**
 * POST /api/hero/mint
 * Mint a Hero object on Sui. Sponsor keypair is both sender and gas payer.
 * Enforces unique hero names — a name used by another player can't be reused,
 * but you can reuse your own previous hero names.
 * Body: { name: string }
 * Returns: { heroObjectId: string, digest: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await req.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Check if another player has used this hero name
    const { rows } = await pool.query(
      `SELECT user_id FROM runs WHERE LOWER(hero_name) = LOWER($1) AND user_id != $2 LIMIT 1`,
      [name.trim(), session.user.id]
    );
    if (rows.length > 0) {
      return NextResponse.json(
        { error: "That hero name has been claimed by another player. Choose a different name." },
        { status: 409 }
      );
    }

    const keypair = getSponsorKeypair();
    const tx = new Transaction();
    tx.moveCall({
      target: heroTarget("mint_hero"),
      arguments: [tx.pure.string(name)],
    });

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showObjectChanges: true },
    });

    // Find the created Hero object
    const heroObj = result.objectChanges?.find(
      (c) => c.type === "created" && c.objectType?.includes("::hero::Hero")
    );

    const heroObjectId = heroObj && "objectId" in heroObj ? heroObj.objectId : null;

    return NextResponse.json({
      heroObjectId,
      digest: result.digest,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Hero mint error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
