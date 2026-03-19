import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/sui-client";
import { PACKAGE_ID } from "@/lib/contracts";

// Reverse maps: u8 → game string
const ITEM_TYPE_REVERSE: Record<number, string> = {
  0: "weapon", 1: "helmet", 2: "chest", 3: "legs", 4: "boots",
  5: "gloves", 6: "ring", 7: "amulet", 8: "bracelet", 9: "potion", 10: "scroll",
};

// Infer item type from name keywords (fallback for items minted with old mapping)
function inferTypeFromName(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("ring")) return "ring";
  if (n.includes("amulet") || n.includes("pendant") || n.includes("talisman")) return "amulet";
  if (n.includes("bracelet") || n.includes("bangle") || n.includes("cuff")) return "bracelet";
  if (n.includes("helm") || n.includes("crown") || n.includes("hood") || n.includes("circlet")) return "helmet";
  if (n.includes("plate") || n.includes("robe") || n.includes("vest") || n.includes("mail") || n.includes("tunic")) return "chest";
  if (n.includes("greaves") || n.includes("leggings") || n.includes("tassets") || n.includes("chausses")) return "legs";
  if (n.includes("boots") || n.includes("sabatons") || n.includes("treads") || n.includes("sandals")) return "boots";
  if (n.includes("gauntlets") || n.includes("gloves") || n.includes("grips") || n.includes("wraps")) return "gloves";
  if (n.includes("sword") || n.includes("blade") || n.includes("axe") || n.includes("dagger")
    || n.includes("mace") || n.includes("staff") || n.includes("wand") || n.includes("hammer")
    || n.includes("spear") || n.includes("bow") || n.includes("scythe") || n.includes("flail")
    || n.includes("glaive") || n.includes("halberd") || n.includes("rapier") || n.includes("cleaver")
    || n.includes("katana") || n.includes("claw") || n.includes("scepter")) return "weapon";
  if (n.includes("potion") || n.includes("elixir") || n.includes("draught") || n.includes("flask")) return "potion";
  if (n.includes("scroll")) return "scroll";
  return null;
}

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

        const name = fields.name as string;
        const u8Type = ITEM_TYPE_REVERSE[Number(fields.item_type)] ?? "weapon";
        // Prefer name-based inference over u8 (handles items minted with old type mapping)
        const inferredType = inferTypeFromName(name);
        items.push({
          objectId: obj.data.objectId,
          name,
          type: inferredType ?? u8Type,
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
