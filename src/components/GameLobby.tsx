"use client";

import { useState } from "react";

interface Props {
  address: string;
}

export function GameLobby({ address }: Props) {
  const [heroName, setHeroName] = useState("");

  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="w-full max-w-2xl fade-up">
      <div className="text-center mb-8">
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-stone-200 mb-1">
          The Tavern
        </h2>
        <p className="text-stone-500 text-sm">
          Connected as <span className="font-[family-name:var(--font-mono)] text-stone-400">{shortAddr}</span>
        </p>
      </div>

      {/* Mint Hero Card */}
      <div className="card mb-6">
        <h3 className="font-[family-name:var(--font-display)] text-lg text-stone-200 mb-4">
          Create a New Hero
        </h3>
        <p className="text-stone-500 text-sm mb-4">
          Name your hero and descend into the crypts. Each hero is an on-chain object minted to your wallet.
          Choose wisely — permadeath is permanent.
        </p>

        <div className="flex gap-3">
          <input
            type="text"
            value={heroName}
            onChange={(e) => setHeroName(e.target.value)}
            placeholder="Enter hero name..."
            maxLength={24}
            className="flex-1 bg-stone-900 border border-stone-700 rounded px-3 py-2 text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-stone-500 font-[family-name:var(--font-mono)] text-sm"
          />
          <button
            disabled={!heroName.trim()}
            className="bg-gold/20 text-gold border border-gold/30 px-5 py-2 rounded font-[family-name:var(--font-display)] text-sm tracking-wider hover:bg-gold/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Mint Hero
          </button>
        </div>
      </div>

      {/* Hero Roster */}
      <div className="card">
        <h3 className="font-[family-name:var(--font-display)] text-lg text-stone-200 mb-4">
          Your Heroes
        </h3>
        <div className="text-center py-8 text-stone-600 text-sm">
          No heroes yet. Mint one above to begin your journey.
        </div>
      </div>

      {/* Graveyard teaser */}
      <div className="mt-6 text-center">
        <p className="text-stone-600 text-xs uppercase tracking-widest">
          ☠ The Graveyard remembers all who fell ☠
        </p>
      </div>
    </div>
  );
}
