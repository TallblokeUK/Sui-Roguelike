import { NextRequest, NextResponse } from "next/server";
import { Transaction } from "@mysten/sui/transactions";
import client from "@/lib/sui-client";
import { getSponsorKeypair } from "@/lib/sponsor";
import { itemTarget } from "@/lib/contracts";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const maxDuration = 15;

// Map ItemType string to u8
const ITEM_TYPE_MAP: Record<string, number> = {
  weapon: 0,
  armor: 1,
  potion: 2,
  ring: 3,
};

// Map ItemRarity string to u8
const RARITY_MAP: Record<string, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

/**
 * POST /api/items/mint
 * Mint an Item object on Sui when a player picks up loot.
 * Body: { name, itemType, rarity, value, glyph, description, heroName, floor }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, itemType, rarity, value, glyph, description, heroName, floor } =
      await req.json();

    if (!name || !itemType || !heroName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const keypair = getSponsorKeypair();
    const tx = new Transaction();
    tx.moveCall({
      target: itemTarget("mint_item"),
      arguments: [
        tx.pure.string(name),
        tx.pure.u8(ITEM_TYPE_MAP[itemType] ?? 0),
        tx.pure.u8(RARITY_MAP[rarity] ?? 0),
        tx.pure.u64(value || 0),
        tx.pure.string(glyph || "?"),
        tx.pure.string(description || ""),
        tx.pure.string(heroName),
        tx.pure.u64(floor || 1),
      ],
    });

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showObjectChanges: true },
    });

    const itemObj = result.objectChanges?.find(
      (c) => c.type === "created" && c.objectType?.includes("::items::Item")
    );

    const itemObjectId = itemObj && "objectId" in itemObj ? itemObj.objectId : null;

    return NextResponse.json({
      itemObjectId,
      digest: result.digest,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Item mint error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
