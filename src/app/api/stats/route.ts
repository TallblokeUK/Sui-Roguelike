import { NextResponse } from "next/server";
import client from "@/lib/sui-client";

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";

// Simple in-memory cache (30 seconds)
let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 30_000;

interface DeathEvent {
  hero_id: string;
  name: string;
  level: string;
  floor: string;
  kills: string;
  turns: string;
  cause_of_death: string;
  owner: string;
}

interface ItemEvent {
  item_id: string;
  name: string;
  item_type: string;
  rarity: string;
  hero_name: string;
  floor: string;
  owner: string;
}

const RARITY_NAMES = ["common", "rare", "epic", "legendary"];

/**
 * GET /api/stats
 * All data from on-chain events:
 * - Deaths from HeroDeath events (emitted by record_death, called server-side)
 * - Items from ItemMint events (emitted by mint_item, called server-side)
 */
export async function GET() {
  try {
    // Return cached data if fresh
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    if (!PACKAGE_ID) {
      return NextResponse.json({
        heroesLost: 0,
        deepestFloor: 0,
        itemsFound: 0,
        recentDeaths: [],
        recentLoot: [],
      });
    }

    // Query on-chain events in parallel
    const [deathEvents, itemEvents] = await Promise.all([
      client.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::hero::HeroDeath` },
        order: "descending",
        limit: 50,
      }),
      client.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::items::ItemMint` },
        order: "descending",
        limit: 50,
      }),
    ]);

    // Aggregate stats
    const heroesLost = deathEvents.data.length;
    let deepestFloor = 0;
    for (const e of deathEvents.data) {
      const parsed = e.parsedJson as DeathEvent;
      const floor = Number(parsed.floor);
      if (floor > deepestFloor) deepestFloor = floor;
    }
    const itemsFound = itemEvents.data.length;

    // Format recent deaths for the feed
    const recentDeaths = deathEvents.data.slice(0, 6).map((e) => {
      const d = e.parsedJson as DeathEvent;
      const ago = getTimeAgo(Number(e.timestampMs));
      return {
        hero: d.name,
        level: Number(d.level),
        cause: d.cause_of_death,
        floor: Number(d.floor),
        time: ago,
      };
    });

    // Format recent loot for the feed
    const recentLoot = itemEvents.data.slice(0, 5).map((e) => {
      const l = e.parsedJson as ItemEvent;
      return {
        hero: l.hero_name,
        item: l.name,
        rarity: RARITY_NAMES[Number(l.rarity)] || "common",
        floor: Number(l.floor),
      };
    });

    const data = {
      heroesLost,
      deepestFloor,
      itemsFound,
      recentDeaths,
      recentLoot,
    };

    cache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Stats error:", err);
    return NextResponse.json({
      heroesLost: 0,
      deepestFloor: 0,
      itemsFound: 0,
      recentDeaths: [],
      recentLoot: [],
    });
  }
}

function getTimeAgo(timestampMs: number): string {
  const diff = Date.now() - timestampMs;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
