"use client";

import { useEffect, useState } from "react";

interface StatsData {
  heroesLost: number;
  deepestFloor: number;
  itemsFound: number;
  recentDeaths: {
    hero: string;
    level: number;
    cause: string;
    floor: number;
    time: string;
  }[];
  recentLoot: {
    hero: string;
    item: string;
    rarity: string;
    floor: number;
  }[];
}

const RARITY_COLORS: Record<string, string> = {
  common: "text-stone-400",
  rare: "text-ice",
  epic: "text-mana",
  legendary: "text-gold-bright",
};

export function LiveFeeds() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Stats row */}
      <div className="relative flex gap-10 sm:gap-16 mt-14 fade-up" style={{ animationDelay: "0.6s" }}>
        <HeroStat value={stats ? String(stats.heroesLost) : "—"} label="Heroes Lost" />
        <HeroStat value={stats ? String(stats.deepestFloor) : "—"} label="Deepest Floor" />
        <HeroStat value={stats ? String(stats.itemsFound) : "—"} label="Items Found" />
        <HeroStat value="0" label="Gas Cost" />
      </div>

      {/* Live feed section */}
      {stats && (stats.recentDeaths.length > 0 || stats.recentLoot.length > 0) && (
        <section className="w-full max-w-5xl mx-auto px-6 py-24">
          <div className="rune-divider mb-16 text-sm font-[family-name:var(--font-display)] tracking-[0.2em] uppercase">
            From the Depths
          </div>

          <div className="grid sm:grid-cols-2 gap-8">
            {/* Death feed */}
            <div className="card">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-blood text-lg" style={{ animation: "skullFloat 4s ease-in-out infinite" }}>&#x2620;</span>
                <h3 className="font-[family-name:var(--font-display)] text-sm tracking-[0.15em] text-stone-400 uppercase">
                  Recent Deaths
                </h3>
              </div>
              {stats.recentDeaths.length === 0 ? (
                <p className="text-stone-700 text-sm font-[family-name:var(--font-mono)]">
                  No deaths yet. Be the first to fall.
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.recentDeaths.map((d, i) => (
                    <div key={i} className="feed-item flex items-start gap-3" style={{ animationDelay: `${i * 0.08}s` }}>
                      <span className="text-stone-700 font-[family-name:var(--font-mono)] text-xs mt-0.5 shrink-0">
                        F{d.floor}
                      </span>
                      <div className="min-w-0">
                        <div className="text-stone-300 text-sm font-medium truncate">
                          {d.hero}
                          <span className="text-stone-600 text-xs ml-2">Lv.{d.level}</span>
                        </div>
                        <div className="text-stone-600 text-xs truncate">{d.cause}</div>
                      </div>
                      <span className="text-stone-700 text-xs ml-auto shrink-0">{d.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Loot feed */}
            <div className="card">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-gold torch-glow text-lg">&#x2666;</span>
                <h3 className="font-[family-name:var(--font-display)] text-sm tracking-[0.15em] text-stone-400 uppercase">
                  Loot Discovered
                </h3>
              </div>
              {stats.recentLoot.length === 0 ? (
                <p className="text-stone-700 text-sm font-[family-name:var(--font-mono)]">
                  No loot found yet. The crypts await.
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.recentLoot.map((l, i) => (
                    <div key={i} className="feed-item flex items-start gap-3" style={{ animationDelay: `${i * 0.08}s` }}>
                      <span className="text-stone-700 font-[family-name:var(--font-mono)] text-xs mt-0.5 shrink-0">
                        F{l.floor}
                      </span>
                      <div className="min-w-0">
                        <div className={`text-sm font-medium truncate ${RARITY_COLORS[l.rarity]}`}>
                          {l.item}
                        </div>
                        <div className="text-stone-600 text-xs">found by {l.hero}</div>
                      </div>
                      <span className="text-stone-700 text-xs ml-auto shrink-0 capitalize">{l.rarity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl text-stone-300 tracking-wide">
        {value}
      </div>
      <div className="text-stone-600 text-xs tracking-[0.15em] uppercase mt-1">{label}</div>
    </div>
  );
}
