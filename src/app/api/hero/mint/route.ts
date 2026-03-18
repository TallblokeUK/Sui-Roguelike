import { NextRequest, NextResponse } from "next/server";
import { Transaction } from "@mysten/sui/transactions";
import client from "@/lib/sui-client";
import pool from "@/lib/db";
import { getSponsorKeypair } from "@/lib/sponsor";
import { heroTarget } from "@/lib/contracts";

export const maxDuration = 15;

/**
 * POST /api/hero/mint
 * Mint a Hero object on Sui. Sponsor keypair is the signer and gas payer,
 * but the hero is transferred to the player's zkLogin address (sender).
 *
 * Body: { name: string, sender: string }
 * Returns: { heroObjectId: string, digest: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { name, sender, sub } = await req.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!sender || typeof sender !== "string") {
      return NextResponse.json(
        { error: "Sender address is required" },
        { status: 400 },
      );
    }

    // Check name uniqueness: another player (different Google account) can't use the same name
    if (sub) {
      const { rows } = await pool.query(
        `SELECT 1 FROM runs WHERE hero_name = $1 AND user_id != $2 LIMIT 1`,
        [name, sub],
      );
      if (rows.length > 0) {
        return NextResponse.json(
          { error: "That hero name is already taken by another player" },
          { status: 409 },
        );
      }
    }

    const keypair = getSponsorKeypair();
    const tx = new Transaction();
    tx.moveCall({
      target: heroTarget("mint_hero"),
      arguments: [
        tx.pure.string(name),
        tx.pure.address(sender), // recipient = player's zkLogin address
      ],
    });

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showObjectChanges: true },
    });

    const heroObj = result.objectChanges?.find(
      (c) => c.type === "created" && c.objectType?.includes("::hero::Hero"),
    );

    const heroObjectId =
      heroObj && "objectId" in heroObj ? heroObj.objectId : null;

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
