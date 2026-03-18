"use client";

import { useReducer, useEffect, useCallback, useRef, useState } from "react";
import {
  type GameState,
  type LeaderboardEntry,
  type Direction,
  type Item,
  TileType,
  MAP_WIDTH,
  MAP_HEIGHT,
} from "@/lib/game/types";
import {
  gameReducer,
  createInitialState,
  getHeroAtk,
  getHeroDef,
  getHeroMaxHp,
} from "@/lib/game/state";
import { useZkLogin } from "@/lib/zklogin-context";
import { useRouter } from "next/navigation";
import {
  type ZkLoginSession,
  deserializeKeypair,
  createZkLoginSignature,
} from "@/lib/zklogin";
import { fromBase64 } from "@mysten/sui/utils";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const RARITY_COLORS: Record<string, string> = {
  common: "text-stone-400",
  rare: "text-ice",
  epic: "text-mana",
  legendary: "text-gold-bright",
};

const LOG_COLORS: Record<string, string> = {
  info: "text-stone-500",
  combat: "text-torch",
  loot: "text-gold",
  danger: "text-blood",
  level: "text-gold-bright",
  death: "text-blood",
};

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch("/api/leaderboard");
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function mintHeroOnChain(
  name: string,
  senderAddress: string,
  sub: string,
): Promise<string> {
  const res = await fetch("/api/hero/mint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, sender: senderAddress, sub }),
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ error: "Failed to mint hero" }));
    throw new Error(err.error || "Failed to mint hero");
  }
  const data = await res.json();
  return data.heroObjectId || "";
}

async function burnHeroOnChain(
  state: GameState,
  session: ZkLoginSession,
  onStatus: (status: string) => void,
): Promise<void> {
  try {
    onStatus("Building burn transaction...");
    const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });

    // 1. Get sponsored burn transaction from server
    const burnRes = await fetch("/api/hero/burn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        heroObjectId: state.heroObjectId,
        level: state.hero.level,
        floor: state.floor,
        kills: state.killCount,
        turns: state.turnsElapsed,
        causeOfDeath: state.causeOfDeath || "Unknown",
        sender: session.address,
      }),
    });

    if (!burnRes.ok) {
      const err = await burnRes.json().catch(() => ({}));
      throw new Error(err.error || "Burn sponsorship failed");
    }

    const { sponsoredTxBytes, sponsorSignature } = await burnRes.json();

    // 2. Sign with ephemeral key
    onStatus("Signing with zkLogin...");
    const ephemeralKeyPair = deserializeKeypair(session.ephemeralKeyPairB64);
    const { signature: userSignature } =
      await ephemeralKeyPair.signTransaction(fromBase64(sponsoredTxBytes));

    // 3. Create zkLogin signature
    const zkLoginSig = createZkLoginSignature(session, userSignature);

    // 4. Execute with both signatures
    onStatus("Burning hero on-chain...");
    await suiClient.executeTransactionBlock({
      transactionBlock: sponsoredTxBytes,
      signature: [zkLoginSig, sponsorSignature],
      options: { showEffects: true },
    });

    onStatus("Hero burned on-chain");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Burn error:", msg);
    onStatus(`Burn failed: ${msg}`);
  }
}

function mintItemOnChain(
  item: {
    name: string;
    type: string;
    rarity: string;
    value: number;
    glyph: string;
    description: string;
  },
  heroName: string,
  floor: number,
  senderAddress: string,
) {
  // Fire-and-forget — don't block gameplay
  fetch("/api/items/mint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: item.name,
      itemType: item.type,
      rarity: item.rarity,
      value: item.value,
      glyph: item.glyph,
      description: item.description,
      heroName,
      floor,
      sender: senderAddress,
    }),
  }).catch(() => {}); // silently ignore failures
}

export function GameScreen() {
  const { session, loading: authLoading, signOut } = useZkLogin();
  const router = useRouter();
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [burnStatus, setBurnStatus] = useState("");
  const [damageFlash, setDamageFlash] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const deathSaved = useRef(false);
  const prevInventorySize = useRef(0);
  const prevHp = useRef(state.hero.hp);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login");
    }
  }, [authLoading, session, router]);

  // Load leaderboard on mount
  useEffect(() => {
    fetchLeaderboard().then(setLeaderboard);
  }, []);

  // Burn hero on death (once) — on-chain + database
  useEffect(() => {
    if (state.phase === "dead" && !deathSaved.current && session) {
      deathSaved.current = true;

      // 1. Burn on-chain (client-side zkLogin + sponsored)
      burnHeroOnChain(state, session, setBurnStatus);

      // 2. Save run to leaderboard DB
      fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroName: state.hero.name,
          level: state.hero.level,
          floor: state.floor,
          kills: state.killCount,
          turns: state.turnsElapsed,
          causeOfDeath: state.causeOfDeath,
          playerAddress: session.address,
          playerName: session.name,
          sub: session.sub,
        }),
      })
        .then(() => fetchLeaderboard())
        .then(setLeaderboard)
        .catch(() => {});
    }
  }, [state.phase, state, session]);

  // Mint items on-chain when picked up
  useEffect(() => {
    const currentSize = state.hero.inventory.length;
    if (
      currentSize > prevInventorySize.current &&
      state.phase === "playing" &&
      session
    ) {
      const newItem = state.hero.inventory[currentSize - 1];
      if (newItem) {
        mintItemOnChain(newItem, state.hero.name, state.floor, session.address);
      }
    }
    prevInventorySize.current = currentSize;
  }, [state.hero.inventory.length, state.hero.name, state.floor, state.phase, session]);

  // Damage flash when HP drops
  useEffect(() => {
    if (state.hero.hp < prevHp.current && state.phase === "playing") {
      setDamageFlash(true);
      const timer = setTimeout(() => setDamageFlash(false), 400);
      return () => clearTimeout(timer);
    }
    prevHp.current = state.hero.hp;
  }, [state.hero.hp, state.phase]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state.log]);

  // Focus name input on mount
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Keyboard controls — must be before early returns to satisfy hooks rules
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (state.phase !== "playing") return;

      const dirMap: Record<string, Direction> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };

      if (dirMap[e.key]) {
        e.preventDefault();
        dispatch({ type: "MOVE", direction: dirMap[e.key] });
      } else if (e.key === ">" || e.key === ".") {
        dispatch({ type: "DESCEND" });
      } else if (e.key === "g" || e.key === ",") {
        dispatch({ type: "PICKUP" });
      } else if (e.key === " ") {
        e.preventDefault();
        dispatch({ type: "WAIT" });
      }
    },
    [state.phase],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Loading / auth guard
  if (authLoading) {
    return (
      <div className="h-dvh flex items-center justify-center stone-bg noise">
        <p className="text-stone-600 font-[family-name:var(--font-mono)] text-sm">
          Loading...
        </p>
      </div>
    );
  }
  if (!session) return null;

  // ─── Naming screen ───
  if (state.phase === "naming") {
    return (
      <NamingScreen
        nameRef={nameRef}
        dispatch={dispatch}
        leaderboard={leaderboard}
        floor={state.floor}
        senderAddress={session.address}
        sub={session.sub}
      />
    );
  }

  // ─── Death screen ───
  if (state.phase === "dead") {
    return (
      <DeathScreen
        state={state}
        leaderboard={leaderboard}
        burnStatus={burnStatus}
        onRetry={() => {
          deathSaved.current = false;
          setBurnStatus("");
          dispatch({ type: "RESET" });
        }}
      />
    );
  }

  // ─── Game screen ───
  return (
    <div className={`h-dvh flex flex-col stone-bg noise overflow-hidden ${damageFlash ? "damage-flash" : ""}`}>
      {/* Header bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-stone-700/50 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-stone-300">
            Crypts of Sui
          </h1>
          <span className="font-[family-name:var(--font-mono)] text-xs text-stone-400">
            {session.name}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-[family-name:var(--font-mono)] text-xs text-stone-400">
            Floor {state.floor} · Kills {state.killCount} · Turn{" "}
            {state.turnsElapsed}
          </span>
          <button
            onClick={() => {
              if (confirm("Abandon this run? Your hero will be lost.")) {
                dispatch({ type: "ABANDON" });
              }
            }}
            className="text-blood/70 hover:text-blood font-[family-name:var(--font-mono)] text-xs border border-blood/30 hover:border-blood/60 px-2 py-0.5 rounded transition"
          >
            End Run
          </button>
          <button
            onClick={() => {
              signOut();
              router.push("/login");
            }}
            className="text-stone-500 hover:text-stone-300 font-[family-name:var(--font-mono)] text-xs transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main game area */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel: Hero HUD */}
        <aside className="w-64 xl:w-72 border-r border-stone-800/50 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
          <HeroPanel state={state} dispatch={dispatch} />
        </aside>

        {/* Center: Dungeon map */}
        <main className="flex-1 flex items-center justify-center p-2 overflow-hidden">
          <DungeonGrid state={state} />
        </main>

        {/* Right panel: Log */}
        <aside className="w-72 xl:w-80 border-l border-stone-800/50 flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-stone-800/50">
            <h3 className="font-[family-name:var(--font-display)] text-xs tracking-[0.15em] text-stone-500 uppercase">
              Log
            </h3>
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto p-4 space-y-1.5">
            {state.log.slice(-50).map((entry, i) => (
              <p
                key={i}
                className={`text-sm font-[family-name:var(--font-mono)] leading-relaxed ${LOG_COLORS[entry.type]}`}
              >
                {entry.text}
              </p>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-stone-800/50">
            <p className="text-stone-500 font-[family-name:var(--font-mono)] text-xs">
              WASD/Arrows: Move · G: Grab · &gt;: Descend · Space: Wait
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Dungeon Grid ───
function DungeonGrid({ state }: { state: GameState }) {
  const { map, hero, monsters } = state;

  return (
    <div
      className="dungeon-grid font-[family-name:var(--font-mono)] leading-none select-none"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${MAP_WIDTH}, 1fr)`,
        gap: 0,
        fontSize: "clamp(8px, 1.2vw, 14px)",
        lineHeight: 1,
        width: "fit-content",
      }}
    >
      {Array.from({ length: MAP_HEIGHT }, (_, y) =>
        Array.from({ length: MAP_WIDTH }, (_, x) => {
          const tile = map[y]?.[x];
          if (!tile)
            return (
              <span key={`${x}-${y}`} className="tile tile-hidden">
                &nbsp;
              </span>
            );

          const isPlayer = hero.pos.x === x && hero.pos.y === y;
          const monster = monsters.find(
            (m) => m.pos.x === x && m.pos.y === y,
          );

          if (isPlayer) {
            return (
              <span
                key={`${x}-${y}`}
                className="tile text-gold-bright font-bold"
              >
                @
              </span>
            );
          }

          if (monster && tile.visible) {
            return (
              <span
                key={`${x}-${y}`}
                className={`tile ${monster.color} font-bold`}
              >
                {monster.glyph}
              </span>
            );
          }

          if (!tile.revealed) {
            return (
              <span key={`${x}-${y}`} className="tile tile-hidden">
                &nbsp;
              </span>
            );
          }

          const dimmed = !tile.visible;

          if (tile.item && tile.visible) {
            return (
              <span
                key={`${x}-${y}`}
                className={`tile ${RARITY_COLORS[tile.item.rarity]}`}
              >
                {tile.item.glyph}
              </span>
            );
          }

          switch (tile.type) {
            case TileType.Wall:
              return (
                <span
                  key={`${x}-${y}`}
                  className={`tile ${dimmed ? "text-stone-900" : "text-stone-700"}`}
                >
                  #
                </span>
              );
            case TileType.Floor:
            case TileType.Corridor:
              return (
                <span
                  key={`${x}-${y}`}
                  className={`tile ${dimmed ? "text-stone-900" : "text-stone-800"}`}
                >
                  ·
                </span>
              );
            case TileType.StairsDown:
              return (
                <span
                  key={`${x}-${y}`}
                  className={`tile ${dimmed ? "text-stone-700" : "text-torch"}`}
                >
                  ▼
                </span>
              );
            case TileType.Door:
              return (
                <span
                  key={`${x}-${y}`}
                  className={`tile ${dimmed ? "text-stone-800" : "text-gold-dim"}`}
                >
                  +
                </span>
              );
            default:
              return (
                <span key={`${x}-${y}`} className="tile tile-hidden">
                  &nbsp;
                </span>
              );
          }
        }),
      )}
    </div>
  );
}

// ─── Hero Panel ───
function HeroPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<import("@/lib/game/types").GameAction>;
}) {
  const { hero } = state;
  const effectiveMaxHp = getHeroMaxHp(hero);
  const hpPercent = Math.max(0, (hero.hp / effectiveMaxHp) * 100);

  return (
    <>
      <div>
        <div className="font-[family-name:var(--font-display)] text-base text-stone-200 tracking-wide">
          {hero.name}
        </div>
        <div className="font-[family-name:var(--font-mono)] text-xs text-stone-600 mt-0.5">
          Level {hero.level} · XP {hero.xp}/{hero.level * 20}
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs font-[family-name:var(--font-mono)] text-stone-500 mb-1">
          <span>HP</span>
          <span className={hpPercent < 30 ? "text-blood" : "text-stone-400"}>
            {hero.hp}/{effectiveMaxHp}
          </span>
        </div>
        <div className="health-bar">
          <div
            className="health-bar-fill"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs font-[family-name:var(--font-mono)]">
        <div className="text-stone-500">
          ATK <span className="text-torch">{getHeroAtk(hero)}</span>
        </div>
        <div className="text-stone-500">
          DEF <span className="text-ice">{getHeroDef(hero)}</span>
        </div>
      </div>

      <div>
        <div className="font-[family-name:var(--font-display)] text-xs text-stone-500 tracking-wider uppercase mb-1">
          Equipment
        </div>
        <div className="space-y-1 text-xs font-[family-name:var(--font-mono)]">
          <EquipSlot label="Wpn" item={hero.equipment.weapon} />
          <EquipSlot label="Arm" item={hero.equipment.armor} />
          <EquipSlot label="Rng" item={hero.equipment.ring} />
        </div>
      </div>

      <div>
        <div className="font-[family-name:var(--font-display)] text-xs text-stone-500 tracking-wider uppercase mb-1">
          Inventory ({hero.inventory.length}/10)
        </div>
        {hero.inventory.length === 0 ? (
          <p className="text-stone-700 text-xs font-[family-name:var(--font-mono)]">
            Empty
          </p>
        ) : (
          <div className="space-y-1">
            {hero.inventory.map((item) => (
              <InventoryItem key={item.id} item={item} dispatch={dispatch} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function EquipSlot({ label, item }: { label: string; item: Item | null }) {
  return (
    <div className="flex gap-2">
      <span className="text-stone-700 w-8">{label}</span>
      {item ? (
        <span className={RARITY_COLORS[item.rarity]}>{item.name}</span>
      ) : (
        <span className="text-stone-800">&mdash;</span>
      )}
    </div>
  );
}

function InventoryItem({
  item,
  dispatch,
}: {
  item: Item;
  dispatch: React.Dispatch<import("@/lib/game/types").GameAction>;
}) {
  return (
    <div className="flex items-center gap-1.5 group text-xs font-[family-name:var(--font-mono)]">
      <span className={RARITY_COLORS[item.rarity]}>{item.glyph}</span>
      <span className={`flex-1 truncate ${RARITY_COLORS[item.rarity]}`}>
        {item.name}
      </span>
      <span className="flex gap-1.5 opacity-0 group-hover:opacity-100">
        {item.type === "potion" ? (
          <button
            onClick={() => dispatch({ type: "USE_ITEM", itemId: item.id })}
            className="text-heal hover:underline"
          >
            use
          </button>
        ) : (
          <button
            onClick={() =>
              dispatch({ type: "EQUIP_ITEM", itemId: item.id })
            }
            className="text-gold hover:underline"
          >
            eqp
          </button>
        )}
        <button
          onClick={() => dispatch({ type: "DROP_ITEM", itemId: item.id })}
          className="text-stone-600 hover:text-blood hover:underline"
        >
          drop
        </button>
      </span>
    </div>
  );
}

// ─── Naming Screen ───
function NamingScreen({
  nameRef,
  dispatch,
  leaderboard,
  senderAddress,
  sub,
}: {
  nameRef: React.RefObject<HTMLInputElement | null>;
  dispatch: React.Dispatch<import("@/lib/game/types").GameAction>;
  leaderboard: LeaderboardEntry[];
  floor: number;
  senderAddress: string;
  sub: string;
}) {
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState("");

  const handleStart = async () => {
    const name = nameRef.current?.value.trim();
    if (!name) return;

    setMinting(true);
    setError("");
    try {
      const heroObjectId = await mintHeroOnChain(name, senderAddress, sub);
      dispatch({ type: "START_GAME", name, heroObjectId });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mint hero. Try again.",
      );
      setMinting(false);
    }
  };

  return (
    <div className="h-dvh flex flex-col items-center justify-center stone-bg noise px-6 overflow-y-auto">
      <div className="fade-in text-center max-w-lg py-12">
        <div className="glyph mb-6">&#x2726; &middot; &#x2726; &middot; &#x2726;</div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-stone-200 tracking-[0.08em] mb-2">
          Create Your Hero
        </h1>
        <p className="text-stone-500 font-[family-name:var(--font-body)] text-lg mb-8">
          Name them wisely. Permadeath is permanent.
        </p>

        <div className="flex gap-3 max-w-sm mx-auto">
          <input
            ref={nameRef}
            type="text"
            placeholder="Enter hero name..."
            maxLength={24}
            disabled={minting}
            className="flex-1 bg-stone-900 border border-stone-700 rounded px-4 py-3 text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-gold/40 font-[family-name:var(--font-mono)] text-sm disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleStart();
            }}
          />
          <button
            onClick={handleStart}
            disabled={minting}
            className="cta-btn disabled:opacity-50"
          >
            {minting ? "Minting..." : "Descend"}
          </button>
        </div>

        {minting && (
          <p className="mt-4 text-torch font-[family-name:var(--font-mono)] text-xs animate-pulse">
            Minting hero on Sui...
          </p>
        )}
        {error && (
          <p className="mt-4 text-blood font-[family-name:var(--font-mono)] text-xs">
            {error}
          </p>
        )}

        <div className="mt-10 text-stone-700 font-[family-name:var(--font-mono)] text-xs space-y-1">
          <p>WASD or Arrow Keys to move</p>
          <p>Bump into enemies to attack</p>
          <p>G to pick up items · &gt; to descend stairs</p>
        </div>

        {leaderboard.length > 0 && (
          <div className="mt-12">
            <Leaderboard entries={leaderboard} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Death Screen ───
function DeathScreen({
  state,
  leaderboard,
  burnStatus,
  onRetry,
}: {
  state: GameState;
  leaderboard: LeaderboardEntry[];
  burnStatus: string;
  onRetry: () => void;
}) {
  return (
    <div className="h-dvh flex flex-col items-center justify-center stone-bg noise px-6 overflow-y-auto">
      <div className="fade-in text-center max-w-lg py-12">
        <div
          className="text-5xl text-blood mb-6"
          style={{ animation: "skullFloat 4s ease-in-out infinite" }}
        >
          &#x2620;
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-blood tracking-[0.08em] mb-2">
          You Have Perished
        </h1>
        <div className="card mt-6 text-left">
          <div className="space-y-2 font-[family-name:var(--font-mono)] text-xs">
            <div className="flex justify-between">
              <span className="text-stone-500">Hero</span>
              <span className="text-stone-300">{state.hero.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Level</span>
              <span className="text-stone-300">{state.hero.level}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Deepest Floor</span>
              <span className="text-stone-300">{state.floor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Kills</span>
              <span className="text-stone-300">{state.killCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Turns Survived</span>
              <span className="text-stone-300">{state.turnsElapsed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Cause of Death</span>
              <span className="text-blood text-right max-w-48 truncate">
                {state.causeOfDeath}
              </span>
            </div>
          </div>
        </div>

        {burnStatus && (
          <p className={`mt-4 font-[family-name:var(--font-mono)] text-xs ${
            burnStatus.includes("failed") ? "text-blood" :
            burnStatus.includes("burned on-chain") ? "text-heal" :
            "text-stone-500 animate-pulse"
          }`}>
            {burnStatus}
          </p>
        )}

        <button className="cta-btn mt-8" onClick={onRetry}>
          Try Again
        </button>

        {leaderboard.length > 0 && (
          <div className="mt-10">
            <Leaderboard
              entries={leaderboard}
              highlightHero={state.hero.name}
            />
          </div>
        )}

        <p className="text-stone-700 text-xs mt-6 font-[family-name:var(--font-body)]">
          The Graveyard remembers all who fell.
        </p>
      </div>
    </div>
  );
}

// ─── Leaderboard ───
function Leaderboard({
  entries,
  highlightHero,
}: {
  entries: LeaderboardEntry[];
  highlightHero?: string;
}) {
  return (
    <div className="card text-left">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-gold torch-glow">&#x2655;</span>
        <h3 className="font-[family-name:var(--font-display)] text-sm tracking-[0.15em] text-stone-400 uppercase">
          Leaderboard
        </h3>
      </div>

      <div className="grid grid-cols-[1.5rem_1fr_4rem_2.5rem_2.5rem_2.5rem] gap-x-2 mb-2 text-[10px] font-[family-name:var(--font-mono)] text-stone-600 uppercase tracking-wider">
        <span>#</span>
        <span>Hero</span>
        <span>Player</span>
        <span className="text-right">Flr</span>
        <span className="text-right">Lvl</span>
        <span className="text-right">Kills</span>
      </div>

      <div className="space-y-1">
        {entries.slice(0, 10).map((entry, i) => {
          const isHighlighted =
            highlightHero && entry.hero_name === highlightHero;
          const rankColors = [
            "text-gold-bright",
            "text-stone-300",
            "text-torch",
          ];
          const rankColor = i < 3 ? rankColors[i] : "text-stone-600";

          return (
            <div
              key={`${entry.hero_name}-${entry.created_at}`}
              className={`grid grid-cols-[1.5rem_1fr_4rem_2.5rem_2.5rem_2.5rem] gap-x-2 text-xs font-[family-name:var(--font-mono)] ${
                isHighlighted ? "text-gold" : ""
              }`}
            >
              <span className={rankColor}>{i + 1}</span>
              <span
                className={`truncate ${isHighlighted ? "text-gold" : "text-stone-300"}`}
              >
                {entry.hero_name}
              </span>
              <span className="truncate text-stone-600">
                {entry.player_name}
              </span>
              <span
                className={`text-right ${isHighlighted ? "text-gold" : "text-stone-400"}`}
              >
                {entry.floor}
              </span>
              <span
                className={`text-right ${isHighlighted ? "text-gold" : "text-stone-400"}`}
              >
                {entry.level}
              </span>
              <span
                className={`text-right ${isHighlighted ? "text-gold" : "text-stone-400"}`}
              >
                {entry.kills}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
