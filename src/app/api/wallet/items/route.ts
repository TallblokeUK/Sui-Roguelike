import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/sui-client";
import { PACKAGE_ID } from "@/lib/contracts";

// Reverse maps: u8 → game string
const ITEM_TYPE_REVERSE: Record<number, string> = {
  0: "weapon", 1: "helmet", 2: "chest", 3: "legs", 4: "boots",
  5: "gloves", 6: "ring", 7: "amulet", 8: "bracelet", 9: "potion", 10: "scroll",
};

const RARITY_REVERSE: Record<number, string> = {
  0: "common", 1: "uncommon", 2: "rare", 3: "epic",
  4: "legendary", 5: "mythic", 6: "ancient", 7: "divine",
};

/**
 * GET /api/wallet/items?owner=0x...
 * Fetch all Item objects owned by a player's zkLogin address.
 */
export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner");
  if (!owner) {
    return NextResponse.json({ error: "Missing owner" }, { status: 400 });
  }

  try {
    const items: {
      objectId: string;
      name: string;
      type: string;
      rarity: string;
      value: number;
      glyph: string;
      description: string;
    }[] = [];

    let cursor: string | null | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const page = await client.getOwnedObjects({
        owner,
        filter: { StructType: `${PACKAGE_ID}::items::Item` },
        options: { showContent: true },
        ...(cursor ? { cursor } : {}),
      });

      for (const obj of page.data) {
        if (!obj.data?.content || obj.data.content.dataType !== "moveObject") continue;
        const fields = obj.data.content.fields as Record<string, unknown>;

        items.push({
          objectId: obj.data.objectId,
          name: fields.name as string,
          type: ITEM_TYPE_REVERSE[Number(fields.item_type)] ?? "weapon",
          rarity: RARITY_REVERSE[Number(fields.rarity)] ?? "common",
          value: Number(fields.value),
          glyph: fields.glyph as string,
          description: fields.description as string,
        });
      }

      hasMore = page.hasNextPage;
      cursor = page.nextCursor;
    }

    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Wallet items error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
