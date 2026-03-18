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
import { XP_PER_LEVEL, FOV_RADIUS } from "@/lib/game/types";
import { initAudio, playSound, setMuted as setAudioMuted, isMuted } from "@/lib/game/audio";
import { getAutoExploreDirection } from "@/lib/game/autoexplore";
import { useZkLogin } from "@/lib/zklogin-context";
import {
  type AccountProgression,
  type MetaBonuses,
  UPGRADE_CATALOG,
  CATEGORY_NAMES,
  computeMetaBonuses,
  calculateSoulEmbers,
  emptyProgression,
  getNextTierCost,
} from "@/lib/game/meta-progression";
import { useRouter } from "next/navigation";
import {
  type ZkLoginSession,
  deserializeKeypair,
  createZkLoginSignature,
} from "@/lib/zklogin";
import { fromBase64 } from "@mysten/sui/utils";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const RARITY_COLORS: Record<string, string> = {
  common: "text-stone-500",
  uncommon: "text-stone-300",
  rare: "text-ice",
  epic: "text-mana",
  legendary: "text-gold-bright",
  mythic: "text-mythic",
  ancient: "text-ancient",
  divine: "text-divine",
};

const LOG_COLORS: Record<string, string> = {
  info: "text-stone-500",
  combat: "text-torch",
  loot: "text-gold",
  danger: "text-blood",
  level: "text-gold-bright",
  death: "text-blood",
  ability: "text-mana",
  status: "text-heal",
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
    console.error("Burn error (non-critical):", msg);
    // Death is already recorded on-chain via record_death — burn just cleans up the NFT
    onStatus("Death recorded on-chain");
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
  const [screenShake, setScreenShake] = useState(false);
  const [levelBurst, setLevelBurst] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [muted, setMuted] = useState(false);
  const [autoExploring, setAutoExploring] = useState(false);
  const [savedGame, setSavedGame] = useState<GameState | null>(null);
  const [saveChecked, setSaveChecked] = useState(false);
  const [accountProg, setAccountProg] = useState<AccountProgression>(emptyProgression());
  const [embersEarned, setEmbersEarned] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const deathSaved = useRef(false);
  const prevInventorySize = useRef(0);
  const prevHp = useRef(state.hero.hp);
  const prevLevel = useRef(state.hero.level);
  const prevFloor = useRef(state.floor);
  const prevLogLen = useRef(state.log.length);
  const audioInit = useRef(false);
  const autoExploringRef = useRef(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login");
    }
  }, [authLoading, session, router]);

  // Check for existing save and load account progression on mount
  useEffect(() => {
    if (!session) return;
    fetch(`/api/save?sub=${encodeURIComponent(session.sub)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.save) setSavedGame(data.save as GameState);
      })
      .catch(() => {})
      .finally(() => setSaveChecked(true));

    fetch(`/api/progression?sub=${encodeURIComponent(session.sub)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.soulEmbers != null) {
          setAccountProg({
            soulEmbers: data.soulEmbers,
            totalEmbersEarned: data.totalEmbersEarned,
            upgrades: data.upgrades ?? {},
          });
        }
      })
      .catch(() => {});
  }, [session]);

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

      // Award soul embers
      fetch("/api/progression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sub: session.sub,
          floor: state.floor,
          level: state.hero.level,
          kills: state.killCount,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.embersEarned != null) {
            setEmbersEarned(data.embersEarned);
          }
        })
        .catch(() => {});
    }
  }, [state.phase, state, session]);

  // Auto-save on floor descent
  useEffect(() => {
    if (state.phase === "playing" && session && state.floor > 1) {
      fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sub: session.sub, state }),
      }).catch(() => {});
    }
  }, [state.floor, session]);

  // Delete save on death or victory
  useEffect(() => {
    if ((state.phase === "dead" || state.phase === "victory") && session) {
      fetch(`/api/save?sub=${encodeURIComponent(session.sub)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
  }, [state.phase, session]);

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

  // Level-up burst effect
  useEffect(() => {
    if (state.hero.level > prevLevel.current) {
      setLevelBurst(true);
      const timer = setTimeout(() => setLevelBurst(false), 800);
      prevLevel.current = state.hero.level;
      return () => clearTimeout(timer);
    }
    prevLevel.current = state.hero.level;
  }, [state.hero.level]);

  // Screen shake on new boss floor
  useEffect(() => {
    if (state.floor > prevFloor.current && state.floor % 5 === 0) {
      setScreenShake(true);
      const timer = setTimeout(() => setScreenShake(false), 500);
      prevFloor.current = state.floor;
      return () => clearTimeout(timer);
    }
    prevFloor.current = state.floor;
  }, [state.floor]);

  // Keep autoExploringRef in sync
  useEffect(() => {
    autoExploringRef.current = autoExploring;
  }, [autoExploring]);

  // Audio triggers — watch log entries for game events
  useEffect(() => {
    if (!audioInit.current || muted) return;
    const newEntries = state.log.slice(prevLogLen.current);
    prevLogLen.current = state.log.length;
    for (const entry of newEntries) {
      if (entry.type === "combat" && (entry.text.includes("hit") || entry.text.includes("strike") || entry.text.includes("slash") || entry.text.includes("slain"))) {
        playSound("attack");
      } else if (entry.type === "loot" && entry.text.includes("Picked up")) {
        playSound("pickup");
      } else if (entry.type === "death") {
        playSound("death");
      } else if (entry.type === "danger" && entry.text.toLowerCase().includes("trap")) {
        playSound("trap");
      } else if (entry.type === "info" && entry.text.includes("door")) {
        playSound("door_open");
      } else if (entry.type === "info" && (entry.text.includes("Restored") || entry.text.includes("potion"))) {
        playSound("use_potion");
      } else if (entry.type === "info" && (entry.text.includes("scroll") || entry.text.includes("Scroll"))) {
        playSound("use_scroll");
      }
    }
  }, [state.log.length, muted]);

  // Audio for level/floor/damage changes
  useEffect(() => {
    if (!audioInit.current || muted) return;
    if (state.hero.hp < prevHp.current && state.phase === "playing") {
      playSound("hit_taken");
    }
  }, [state.hero.hp, state.phase, muted]);

  useEffect(() => {
    if (!audioInit.current || muted) return;
    if (state.hero.level > prevLevel.current) {
      playSound("level_up");
    }
  }, [state.hero.level, muted]);

  useEffect(() => {
    if (!audioInit.current || muted) return;
    if (state.floor > prevFloor.current) {
      playSound("descend");
      if (state.floor % 5 === 0) {
        setTimeout(() => playSound("boss_intro"), 300);
      }
    }
  }, [state.floor, muted]);

  // Auto-explore effect
  useEffect(() => {
    if (!autoExploring || state.phase !== "playing") return;

    // Stop if visible monsters
    const hasVisibleMonster = state.monsters.some(
      (m) => !m.disguised && state.map[m.pos.y]?.[m.pos.x]?.visible
    );
    if (hasVisibleMonster) { setAutoExploring(false); return; }

    // Stop if item or stairs on current tile
    const curTile = state.map[state.hero.pos.y][state.hero.pos.x];
    if (curTile.item || curTile.type === TileType.StairsDown) {
      setAutoExploring(false);
      return;
    }

    const dir = getAutoExploreDirection(state.map, state.hero.pos);
    if (!dir) { setAutoExploring(false); return; }

    const timer = setTimeout(() => {
      if (autoExploringRef.current) {
        dispatch({ type: "MOVE", direction: dir });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [autoExploring, state.turnsElapsed, state.phase, state.hero.pos, state.monsters, state.map, dispatch]);

  // Minimap canvas rendering
  useEffect(() => {
    if (!showMinimap || !minimapCanvasRef.current) return;
    const canvas = minimapCanvasRef.current;
    const c = canvas.getContext("2d");
    if (!c) return;
    const scale = 3;
    canvas.width = MAP_WIDTH * scale;
    canvas.height = MAP_HEIGHT * scale;
    c.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = state.map[y]?.[x];
        if (!tile || !tile.revealed) continue;

        if (state.hero.pos.x === x && state.hero.pos.y === y) {
          c.fillStyle = "#f59e0b"; // gold
        } else if (state.monsters.some((m) => m.pos.x === x && m.pos.y === y && tile.visible && !m.disguised)) {
          c.fillStyle = "#dc2626"; // red
        } else if (tile.item && tile.visible) {
          c.fillStyle = "#60a5fa"; // blue
        } else if (tile.type === TileType.StairsDown) {
          c.fillStyle = "#22c55e"; // green
        } else if (tile.type === TileType.Wall || tile.type === TileType.SecretDoor) {
          c.fillStyle = "#292524"; // dark
        } else {
          c.fillStyle = tile.visible ? "#44403c" : "#1c1917"; // floor
        }
        c.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }, [showMinimap, state.map, state.hero.pos, state.monsters]);

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
      // Init audio on first interaction
      if (!audioInit.current) {
        initAudio();
        audioInit.current = true;
      }

      // Global toggles (work in any phase)
      if (e.key === "m" || e.key === "M") {
        setShowMinimap((v) => !v);
        return;
      }
      if (e.key === "?") {
        setShowHelp((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (showHelp) { setShowHelp(false); return; }
        if (state.shopOpen) { dispatch({ type: "CLOSE_SHOP" }); return; }
        if (autoExploringRef.current) { setAutoExploring(false); return; }
        if (state.pendingAbility) { dispatch({ type: "WAIT" }); return; }
        return;
      }

      // Level-up choice screen: 1/2/3 to pick
      if (state.phase === "level_up") {
        if (e.key === "1" || e.key === "2" || e.key === "3") {
          dispatch({ type: "CHOOSE_LEVEL_UP", choiceIndex: parseInt(e.key) - 1 });
        }
        return;
      }

      if (state.phase !== "playing" || state.shopOpen) return;

      // Cancel auto-explore on any action key
      if (autoExploringRef.current) {
        setAutoExploring(false);
      }

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
      } else if (e.key === "e" || e.key === "E") {
        dispatch({ type: "INTERACT" });
      } else if (e.key === "x" || e.key === "X") {
        setAutoExploring(true);
      } else if (e.key === "1" || e.key === "2" || e.key === "3") {
        const abilityIndex = parseInt(e.key) - 1;
        dispatch({ type: "USE_ABILITY", abilityIndex });
      }
    },
    [state.phase, state.pendingAbility, state.shopOpen, showHelp, dispatch],
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
        savedGame={savedGame}
        saveChecked={saveChecked}
        onContinue={() => {
          if (savedGame) {
            dispatch({ type: "LOAD_SAVE", state: savedGame });
            setSavedGame(null);
          }
        }}
        accountProg={accountProg}
        onProgUpdate={setAccountProg}
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
        embersEarned={embersEarned}
        accountProg={accountProg}
        onRetry={() => {
          deathSaved.current = false;
          setBurnStatus("");
          setEmbersEarned(null);
          // Refresh progression so NamingScreen shows updated embers
          if (session) {
            fetch(`/api/progression?sub=${encodeURIComponent(session.sub)}`)
              .then((r) => r.json())
              .then((data) => {
                if (data.soulEmbers != null) {
                  setAccountProg({
                    soulEmbers: data.soulEmbers,
                    totalEmbersEarned: data.totalEmbersEarned,
                    upgrades: data.upgrades ?? {},
                  });
                }
              })
              .catch(() => {});
          }
          dispatch({ type: "RESET" });
        }}
      />
    );
  }

  // ─── Game screen (also shown during level_up with overlay) ───
  return (
    <div className={`h-dvh flex flex-col stone-bg noise overflow-hidden ${damageFlash ? "damage-flash" : ""} ${screenShake ? "screen-shake" : ""} ${levelBurst ? "level-burst" : ""}`}>
      {/* Level-up choice overlay */}
      {state.phase === "level_up" && (
        <LevelUpOverlay state={state} dispatch={dispatch} />
      )}

      {/* Help overlay */}
      {showHelp && (
        <HelpOverlay onClose={() => setShowHelp(false)} />
      )}

      {/* Shop overlay */}
      {state.shopOpen && (
        <ShopOverlay state={state} dispatch={dispatch} />
      )}

      {/* Header bar */}
      <header className="flex items-center justify-between px-3 py-1.5 border-b border-stone-700/50 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-3 shrink-0">
          <h1 className="font-[family-name:var(--font-display)] text-xs tracking-[0.15em] text-stone-300">
            Crypts of Sui
          </h1>
          <span className="font-[family-name:var(--font-mono)] text-xs text-stone-500">
            {session.name}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-xs text-stone-400">
            F{state.floor} · K{state.killCount} · T{state.turnsElapsed}
          </span>
          {autoExploring && (
            <span className="font-[family-name:var(--font-mono)] text-xs text-gold animate-pulse">
              AUTO
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button
            onClick={() => {
              const newMuted = !muted;
              setMuted(newMuted);
              setAudioMuted(newMuted);
              if (!audioInit.current) { initAudio(); audioInit.current = true; }
            }}
            className="text-stone-500 hover:text-stone-300 font-[family-name:var(--font-mono)] text-xs transition px-1"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? "♪̸" : "♪"}
          </button>
          <button
            onClick={() => setShowHelp((v) => !v)}
            className="text-stone-500 hover:text-stone-300 font-[family-name:var(--font-mono)] text-xs transition px-1"
            title="Key bindings (?)"
          >
            ?
          </button>
          <button
            onClick={() => {
              if (session) {
                fetch("/api/save", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ sub: session.sub, state }),
                }).then(() => {
                  signOut();
                  router.push("/login");
                }).catch(() => {});
              }
            }}
            className="text-gold hover:text-gold-bright font-[family-name:var(--font-mono)] text-xs border border-gold/30 hover:border-gold/60 px-2 py-0.5 rounded transition"
          >
            Save &amp; Quit
          </button>
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
        <main className="flex-1 flex flex-col items-center justify-center p-2 overflow-hidden relative">
          <BossBar state={state} />
          <DungeonGrid state={state} />
          {/* Minimap overlay */}
          {showMinimap && (
            <div className="absolute top-3 right-3 border border-stone-700/60 bg-stone-950/90 rounded p-1">
              <canvas ref={minimapCanvasRef} style={{ imageRendering: "pixelated" }} />
            </div>
          )}
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
              WASD: Move · G: Grab · &gt;: Descend · Space: Wait · 1-3: Abilities · E: Interact · X: Auto · M: Map · ?: Help
            </p>
            {state.pendingAbility && (
              <p className="text-mana font-[family-name:var(--font-mono)] text-xs mt-1">
                Choose direction for {state.pendingAbility.replace("_", " ")}...
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Boss HP Bar ───
function BossBar({ state }: { state: GameState }) {
  const boss = state.monsters.find((m) => m.isBoss);
  if (!boss) return null;

  const hpPercent = Math.max(0, (boss.hp / boss.maxHp) * 100);

  return (
    <div className="w-full max-w-md mb-2 px-4">
      <div className="flex justify-between items-center mb-1">
        <span className="font-[family-name:var(--font-display)] text-sm text-blood tracking-wide">
          {boss.name}
        </span>
        <span className="font-[family-name:var(--font-mono)] text-xs text-stone-400">
          {boss.hp}/{boss.maxHp}
        </span>
      </div>
      <div className="h-2.5 bg-stone-900 rounded overflow-hidden border border-stone-700/50">
        <div
          className="h-full transition-all duration-300 rounded"
          style={{
            width: `${hpPercent}%`,
            background: hpPercent > 50
              ? "linear-gradient(90deg, #dc2626, #991b1b)"
              : hpPercent > 25
              ? "linear-gradient(90deg, #d4a447, #92400e)"
              : "linear-gradient(90deg, #dc2626, #7f1d1d)",
            boxShadow: hpPercent > 25
              ? "0 0 8px rgba(220, 38, 38, 0.4)"
              : "0 0 12px rgba(220, 38, 38, 0.6)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Dungeon Grid ───
function DungeonGrid({ state }: { state: GameState }) {
  const { map, hero, monsters } = state;

  // Torch-light: brightness falls off with distance from hero
  const torchBrightness = (x: number, y: number): number => {
    const dx = x - hero.pos.x;
    const dy = y - hero.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0.35, 1 - (dist / FOV_RADIUS) * 0.65);
  };

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

          // Disguised mimics render as item glyphs
          if (monster && monster.disguised && tile.visible) {
            return (
              <span
                key={`${x}-${y}`}
                className="tile text-gold-bright"
                style={{ opacity: torchBrightness(x, y) }}
                title="Something glimmers..."
              >
                !
              </span>
            );
          }

          if (monster && tile.visible) {
            const hasStatus = monster.statusEffects?.length > 0;
            const statusColor = hasStatus
              ? monster.statusEffects.some((e) => e.type === "poison") ? "status-poison"
              : monster.statusEffects.some((e) => e.type === "burning") ? "status-burning"
              : monster.statusEffects.some((e) => e.type === "bleed") ? "status-bleed"
              : monster.statusEffects.some((e) => e.type === "stun") ? "status-stun"
              : ""
              : "";
            return (
              <span
                key={`${x}-${y}`}
                className={`tile ${monster.color} font-bold ${statusColor}`}
                style={{ opacity: torchBrightness(x, y) }}
                title={`${monster.name} HP:${monster.hp}/${monster.maxHp}${hasStatus ? " " + monster.statusEffects.map((e) => e.type).join(", ") : ""}`}
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
                style={{ opacity: torchBrightness(x, y) }}
              >
                {tile.item.glyph}
              </span>
            );
          }

          // Shrine glyph at center of shrine rooms
          if (tile.visible || tile.revealed) {
            const shrineRoom = state.rooms.find(
              (r) => r.roomType === "shrine" &&
                x === Math.floor(r.x + r.w / 2) &&
                y === Math.floor(r.y + r.h / 2)
            );
            if (shrineRoom) {
              return (
                <span
                  key={`${x}-${y}`}
                  className={`tile ${dimmed ? "text-stone-600" : "text-gold-bright"} shrine-glow`}
                  title="Mystical Shrine — press E to interact"
                >
                  ✦
                </span>
              );
            }

            // Shopkeeper at center of shop rooms
            const shopRoom = state.rooms.find(
              (r) => r.roomType === "shop" &&
                x === Math.floor(r.x + r.w / 2) &&
                y === Math.floor(r.y + r.h / 2)
            );
            if (shopRoom) {
              return (
                <span
                  key={`${x}-${y}`}
                  className={`tile ${dimmed ? "text-stone-600" : "text-gold-bright"}`}
                  style={!dimmed ? { textShadow: "0 0 6px rgba(251, 191, 36, 0.5)" } : undefined}
                  title="Shopkeeper — press E to trade"
                >
                  $
                </span>
              );
            }
          }

          const tb = !dimmed ? torchBrightness(x, y) : undefined;

          switch (tile.type) {
            case TileType.Wall:
              return (
                <span
                  key={`${x}-${y}`}
                  className={`tile ${dimmed ? "text-stone-900" : "text-stone-700"}`}
                  style={tb ? { opacity: tb } : undefined}
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
                  style={tb ? { opacity: tb } : undefined}
                >
                  ·
                </span>
              );
            case TileType.StairsDown:
              return (
                <span
                  key={`${x}-${y}`}
                  className={`tile ${dimmed ? "text-stone-700" : "text-torch"}`}
                  style={tb ? { opacity: tb } : undefined}
                >
                  ▼
                </span>
              );
            case TileType.Door:
              return (
                <span
                  key={`${x}-${y}`}
                  className={`tile ${dimmed ? "text-stone-800" : tile.doorOpen ? "text-stone-600" : "text-gold-dim"}`}
                  style={tb ? { opacity: tb } : undefined}
                >
                  {tile.doorOpen ? "'" : "+"}
                </span>
              );
            case TileType.Water:
              return (
                <span
                  key={`${x}-${y}`}
                  className={`tile ${dimmed ? "text-stone-800" : "text-ice"}`}
                  style={!dimmed ? { opacity: tb, textShadow: "0 0 4px rgba(147, 197, 253, 0.3)" } : undefined}
                >
                  ~
                </span>
              );
            case TileType.Trap:
              return (
                <span
                  key={`${x}-${y}`}
                  className={`tile ${
                    tile.trap?.triggered
                      ? "text-stone-700"
                      : dimmed ? "text-stone-800" : "text-blood/60"
                  }`}
                  style={tb ? { opacity: tb } : undefined}
                >
                  {tile.trap?.triggered ? "^" : tile.visible ? "^" : "·"}
                </span>
              );
            case TileType.SecretDoor:
              // Renders as a wall — player must bump into it to discover
              return (
                <span
                  key={`${x}-${y}`}
                  className={`tile ${dimmed ? "text-stone-900" : "text-stone-700"}`}
                  style={tb ? { opacity: tb } : undefined}
                >
                  #
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
          Level {hero.level}
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
            style={{
              width: `${hpPercent}%`,
              background: hpPercent > 50
                ? "linear-gradient(90deg, #22c55e, #15803d)"
                : hpPercent > 25
                ? "linear-gradient(90deg, #d4a447, #92400e)"
                : "linear-gradient(90deg, #dc2626, #991b1b)",
            }}
          />
        </div>
      </div>

      {/* XP bar */}
      <div>
        <div className="flex justify-between text-xs font-[family-name:var(--font-mono)] text-stone-500 mb-1">
          <span>XP</span>
          <span className="text-gold">{hero.xp}/{hero.level * XP_PER_LEVEL}</span>
        </div>
        <div className="xp-bar">
          <div
            className="xp-bar-fill"
            style={{ width: `${(hero.xp / (hero.level * XP_PER_LEVEL)) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs font-[family-name:var(--font-mono)]">
        <div className="text-stone-500">
          ATK <span className="text-torch">{getHeroAtk(hero)}</span>
        </div>
        <div className="text-stone-500">
          DEF <span className="text-ice">{getHeroDef(hero)}</span>
        </div>
        <div className="text-stone-500">
          Gold <span className="text-gold-bright">{hero.gold}</span>
        </div>
      </div>

      {/* Energy bar */}
      <div>
        <div className="flex justify-between text-xs font-[family-name:var(--font-mono)] text-stone-500 mb-1">
          <span>Energy</span>
          <span className="text-mana">{hero.energy}/{hero.maxEnergy}</span>
        </div>
        <div className="h-1.5 bg-stone-900 rounded overflow-hidden">
          <div
            className="h-full bg-mana/60 transition-all duration-200"
            style={{ width: `${(hero.energy / hero.maxEnergy) * 100}%` }}
          />
        </div>
      </div>

      {/* Abilities */}
      <div>
        <div className="font-[family-name:var(--font-display)] text-xs text-stone-500 tracking-wider uppercase mb-1">
          Abilities
        </div>
        <div className="space-y-1">
          {hero.abilities.map((ability, i) => {
            const canUse = hero.energy >= ability.energyCost && ability.currentCooldown === 0;
            return (
              <button
                key={ability.id}
                onClick={() => dispatch({ type: "USE_ABILITY", abilityIndex: i })}
                disabled={!canUse}
                className={`w-full text-left text-xs font-[family-name:var(--font-mono)] px-1.5 py-0.5 rounded border transition-colors ${
                  canUse
                    ? "text-mana border-mana/30 hover:border-mana/60 hover:bg-mana/10 cursor-pointer"
                    : "text-stone-700 border-stone-800 cursor-not-allowed"
                }`}
                title={ability.description}
              >
                <span className="text-stone-500">[{i + 1}]</span>{" "}
                {ability.name}{" "}
                <span className="text-stone-600">
                  {ability.currentCooldown > 0
                    ? `(${ability.currentCooldown}t)`
                    : `(${ability.energyCost}E)`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status effects on hero */}
      {hero.statusEffects.length > 0 && (
        <div>
          <div className="font-[family-name:var(--font-display)] text-xs text-stone-500 tracking-wider uppercase mb-1">
            Status
          </div>
          <div className="space-y-0.5">
            {hero.statusEffects.map((effect, i) => {
              const colors: Record<string, string> = {
                poison: "text-heal",
                bleed: "text-blood",
                stun: "text-gold",
                burning: "text-torch",
              };
              return (
                <div key={`${effect.type}-${i}`} className={`text-xs font-[family-name:var(--font-mono)] ${colors[effect.type] || "text-stone-400"}`}>
                  {effect.type} ({effect.turnsRemaining}t)
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chosen perks from level-ups */}
      {hero.chosenPerks && hero.chosenPerks.length > 0 && (
        <div>
          <div className="font-[family-name:var(--font-display)] text-xs text-stone-500 tracking-wider uppercase mb-1">
            Perks
          </div>
          <div className="space-y-0.5">
            {hero.chosenPerks.map((perk, i) => (
              <div key={i} className="text-xs font-[family-name:var(--font-mono)] text-gold/70">
                {perk}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="font-[family-name:var(--font-display)] text-xs text-stone-500 tracking-wider uppercase mb-1">
          Equipment
        </div>
        <div className="space-y-1 text-xs font-[family-name:var(--font-mono)]">
          <EquipSlot label="Wpn" item={hero.equipment.weapon} />
          <EquipSlot label="Hlm" item={hero.equipment.helmet} />
          <EquipSlot label="Cht" item={hero.equipment.chest} />
          <EquipSlot label="Leg" item={hero.equipment.legs} />
          <EquipSlot label="Bts" item={hero.equipment.boots} />
          <EquipSlot label="Glv" item={hero.equipment.gloves} />
          <EquipSlot label="Rng" item={hero.equipment.ring} />
          <EquipSlot label="Aml" item={hero.equipment.amulet} />
          <EquipSlot label="Brc" item={hero.equipment.bracelet} />
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
        <span className={RARITY_COLORS[item.rarity]} title={item.description}>
          {item.cursed ? "💀 " : ""}{item.setId ? "⚙ " : ""}{item.name}
        </span>
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
    <div className="flex items-center gap-1.5 group text-xs font-[family-name:var(--font-mono)]" title={item.description}>
      <span className={RARITY_COLORS[item.rarity]}>{item.glyph}</span>
      <span className={`flex-1 truncate ${RARITY_COLORS[item.rarity]}`}>
        {item.cursed ? "💀 " : ""}{item.setId ? "⚙ " : ""}{item.name}
      </span>
      <span className="flex gap-1.5 opacity-0 group-hover:opacity-100">
        {item.type === "potion" || item.type === "scroll" ? (
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
  savedGame,
  saveChecked,
  onContinue,
  accountProg,
  onProgUpdate,
}: {
  nameRef: React.RefObject<HTMLInputElement | null>;
  dispatch: React.Dispatch<import("@/lib/game/types").GameAction>;
  leaderboard: LeaderboardEntry[];
  floor: number;
  senderAddress: string;
  sub: string;
  savedGame: GameState | null;
  saveChecked: boolean;
  onContinue: () => void;
  accountProg: AccountProgression;
  onProgUpdate: (p: AccountProgression) => void;
}) {
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState("");
  const [forgeTab, setForgeTab] = useState<string>("vitae");

  const metaBonuses = computeMetaBonuses(accountProg.upgrades);

  const handleStart = async () => {
    const name = nameRef.current?.value.trim();
    if (!name) return;

    setMinting(true);
    setError("");
    try {
      const heroObjectId = await mintHeroOnChain(name, senderAddress, sub);
      dispatch({ type: "START_GAME", name, heroObjectId, metaBonuses });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mint hero. Try again.",
      );
      setMinting(false);
    }
  };

  const handlePurchase = async (upgradeId: string) => {
    try {
      const res = await fetch("/api/progression/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sub, upgradeId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      onProgUpdate({
        ...accountProg,
        soulEmbers: data.soulEmbers,
        upgrades: data.upgrades,
      });
    } catch {
      // silently ignore
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

        {saveChecked && savedGame && (
          <div className="mb-8 card max-w-sm mx-auto">
            <p className="font-[family-name:var(--font-display)] text-sm text-gold tracking-wide mb-2">
              Saved Run Found
            </p>
            <p className="font-[family-name:var(--font-mono)] text-xs text-stone-400 mb-3">
              {savedGame.hero.name} · Level {savedGame.hero.level} · Floor {savedGame.floor} · {savedGame.killCount} kills
            </p>
            <button
              onClick={onContinue}
              className="cta-btn w-full"
            >
              Continue Run
            </button>
          </div>
        )}

        {saveChecked && savedGame && (
          <p className="text-stone-600 font-[family-name:var(--font-mono)] text-xs mb-4">
            — or start fresh —
          </p>
        )}

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

        {/* Dark Forge */}
        <div className="mt-10 card max-w-lg mx-auto text-left">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-torch torch-glow">&#x2692;</span>
              <h3 className="font-[family-name:var(--font-display)] text-sm tracking-[0.12em] text-stone-300 uppercase">
                The Dark Forge
              </h3>
            </div>
            <span className="font-[family-name:var(--font-mono)] text-xs text-torch">
              {accountProg.soulEmbers} Soul Embers
            </span>
          </div>
          <p className="text-stone-600 font-[family-name:var(--font-mono)] text-xs mb-4">
            Spend soul embers to strengthen all future heroes.
          </p>

          {/* Category tabs */}
          <div className="flex gap-1 mb-4">
            {Object.entries(CATEGORY_NAMES).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setForgeTab(key)}
                className={`px-3 py-1 text-xs font-[family-name:var(--font-mono)] rounded border transition-colors ${
                  forgeTab === key
                    ? "border-gold/40 text-gold bg-gold/5"
                    : "border-stone-700/50 text-stone-500 hover:text-stone-300 hover:border-stone-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Upgrades list */}
          <div className="space-y-2">
            {UPGRADE_CATALOG.filter((u) => u.category === forgeTab).map((upgrade) => {
              const currentTier = accountProg.upgrades[upgrade.id] ?? 0;
              const isMaxed = currentTier >= upgrade.maxTier;
              const nextCost = getNextTierCost(upgrade, currentTier);
              const canAfford = nextCost !== null && accountProg.soulEmbers >= nextCost;

              return (
                <div
                  key={upgrade.id}
                  className={`flex items-center justify-between px-3 py-2.5 border rounded transition-colors ${
                    isMaxed ? "border-gold/20 bg-gold/5" : "border-stone-700/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-[family-name:var(--font-display)] text-sm tracking-wide ${isMaxed ? "text-gold" : "text-stone-200"}`}>
                        {upgrade.name}
                      </span>
                      <span className="text-stone-600 font-[family-name:var(--font-mono)] text-xs">
                        {currentTier}/{upgrade.maxTier}
                      </span>
                    </div>
                    <div className="text-stone-500 font-[family-name:var(--font-mono)] text-xs mt-0.5">
                      {isMaxed
                        ? upgrade.tiers.map((t) => t.effect).join(", ") + " (maxed)"
                        : upgrade.tiers[currentTier].effect}
                    </div>
                  </div>
                  {isMaxed ? (
                    <span className="text-gold font-[family-name:var(--font-mono)] text-xs ml-2">&#x2713;</span>
                  ) : (
                    <button
                      onClick={() => handlePurchase(upgrade.id)}
                      disabled={!canAfford}
                      className={`ml-2 px-2.5 py-1 text-xs font-[family-name:var(--font-mono)] rounded border transition-colors shrink-0 ${
                        canAfford
                          ? "text-torch border-torch/40 hover:bg-torch/10 hover:border-torch/60 cursor-pointer"
                          : "text-stone-700 border-stone-800 cursor-not-allowed"
                      }`}
                    >
                      {nextCost}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
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
  embersEarned,
  accountProg,
}: {
  state: GameState;
  leaderboard: LeaderboardEntry[];
  burnStatus: string;
  onRetry: () => void;
  embersEarned: number | null;
  accountProg: AccountProgression;
}) {
  const multiplier = computeMetaBonuses(accountProg.upgrades).emberMultiplier;
  const emberBreakdown = calculateSoulEmbers(state.floor, state.hero.level, state.killCount, multiplier);
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

        {/* Soul Ember Award */}
        <div className="card mt-6 text-center">
          <p className="font-[family-name:var(--font-display)] text-torch tracking-wide text-sm mb-3">
            &#x2726; {embersEarned ?? emberBreakdown.total} Soul Embers Earned &#x2726;
          </p>
          <div className="space-y-1 font-[family-name:var(--font-mono)] text-xs">
            {emberBreakdown.breakdown.map((b, i) => (
              <div key={i} className="flex justify-between text-stone-500">
                <span>{b.label}</span>
                <span className="text-stone-400">+{b.value}</span>
              </div>
            ))}
            <div className="border-t border-stone-700/50 mt-2 pt-2 flex justify-between text-torch">
              <span>Total</span>
              <span>{embersEarned ?? emberBreakdown.total}</span>
            </div>
          </div>
        </div>

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

// ─── Level-Up Overlay ───
function LevelUpOverlay({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<import("@/lib/game/types").GameAction>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm">
      <div className="card max-w-lg w-full mx-4 text-center fade-in">
        <div className="text-gold-bright text-2xl mb-2">&#x2726;</div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-stone-200 tracking-wide mb-1">
          Level {state.hero.level}
        </h2>
        <p className="text-stone-500 font-[family-name:var(--font-mono)] text-xs mb-6">
          Choose a perk
        </p>
        <div className="grid gap-3">
          {state.levelUpChoices.map((choice, i) => (
            <button
              key={choice.id}
              onClick={() => dispatch({ type: "CHOOSE_LEVEL_UP", choiceIndex: i })}
              className="text-left px-4 py-3 border border-stone-700/50 rounded hover:border-gold/40 hover:bg-gold/5 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="text-stone-500 font-[family-name:var(--font-mono)] text-sm group-hover:text-gold">
                  [{i + 1}]
                </span>
                <div>
                  <div className="font-[family-name:var(--font-display)] text-stone-200 tracking-wide text-sm">
                    {choice.name}
                  </div>
                  <div className="text-stone-400 font-[family-name:var(--font-mono)] text-xs mt-0.5">
                    {choice.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
        <p className="text-stone-600 font-[family-name:var(--font-mono)] text-xs mt-4">
          Press 1, 2, or 3 to choose
        </p>
      </div>
    </div>
  );
}

// ─── Shop Overlay ───
function ShopOverlay({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<import("@/lib/game/types").GameAction>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm">
      <div className="card max-w-md w-full mx-4 fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-stone-200 tracking-wide">
            Shopkeeper&apos;s Wares
          </h2>
          <span className="font-[family-name:var(--font-mono)] text-sm text-gold-bright">
            Gold: {state.hero.gold}
          </span>
        </div>
        {state.shopItems.length === 0 ? (
          <p className="text-stone-500 font-[family-name:var(--font-mono)] text-sm text-center py-4">
            Sold out!
          </p>
        ) : (
          <div className="space-y-2">
            {state.shopItems.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-3 py-2 border border-stone-700/50 rounded hover:border-gold/30 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`${RARITY_COLORS[item.rarity]} font-[family-name:var(--font-mono)]`}>
                    {item.glyph}
                  </span>
                  <div className="min-w-0">
                    <div className={`text-sm font-[family-name:var(--font-mono)] truncate ${RARITY_COLORS[item.rarity]}`}>
                      {item.name}
                    </div>
                    <div className="text-xs text-stone-500 font-[family-name:var(--font-mono)] truncate">
                      {item.description}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => dispatch({ type: "BUY_ITEM", itemIndex: i })}
                  disabled={state.hero.gold < item.value || state.hero.inventory.length >= 10}
                  className={`ml-2 px-2 py-1 text-xs font-[family-name:var(--font-mono)] rounded border transition-colors shrink-0 ${
                    state.hero.gold >= item.value && state.hero.inventory.length < 10
                      ? "text-gold border-gold/40 hover:bg-gold/10 hover:border-gold/60 cursor-pointer"
                      : "text-stone-700 border-stone-800 cursor-not-allowed"
                  }`}
                >
                  {item.value}g
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => dispatch({ type: "CLOSE_SHOP" })}
            className="text-stone-500 hover:text-stone-300 font-[family-name:var(--font-mono)] text-xs border border-stone-700/50 hover:border-stone-500 px-4 py-1.5 rounded transition-colors"
          >
            Leave Shop (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Help Overlay ───
function HelpOverlay({ onClose }: { onClose: () => void }) {
  const bindings = [
    ["W/A/S/D / Arrows", "Move"],
    ["G / ,", "Pick up item"],
    ["> / .", "Descend stairs"],
    ["Space", "Wait a turn"],
    ["E", "Interact (shrine/door)"],
    ["1 / 2 / 3", "Use ability"],
    ["X", "Auto-explore"],
    ["M", "Toggle minimap"],
    ["?", "Toggle this help"],
    ["Esc", "Cancel / close"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm" onClick={onClose}>
      <div className="card max-w-sm w-full mx-4 fade-in" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-[family-name:var(--font-display)] text-lg text-stone-200 tracking-wide mb-4 text-center">
          Key Bindings
        </h2>
        <div className="space-y-1.5">
          {bindings.map(([key, desc]) => (
            <div key={key} className="flex justify-between text-xs font-[family-name:var(--font-mono)]">
              <span className="text-gold">{key}</span>
              <span className="text-stone-400">{desc}</span>
            </div>
          ))}
        </div>
        <p className="text-stone-600 font-[family-name:var(--font-mono)] text-xs mt-4 text-center">
          Press ? or Esc to close
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
