"use client";

import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { GameLobby } from "@/components/GameLobby";

export default function Home() {
  const account = useCurrentAccount();

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
        <h1 className="font-[family-name:var(--font-display)] text-xl tracking-wider text-stone-300">
          Crypts of Sui
        </h1>
        <ConnectButton />
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-6">
        {account ? (
          <GameLobby address={account.address} />
        ) : (
          <HeroScreen />
        )}
      </main>
    </div>
  );
}

function HeroScreen() {
  return (
    <div className="text-center max-w-lg fade-up">
      {/* Torch icon */}
      <div className="torch-glow text-6xl mb-6">🔥</div>

      <h2 className="font-[family-name:var(--font-display)] text-4xl text-stone-200 mb-4 tracking-wide">
        The Crypts Await
      </h2>

      <p className="text-stone-400 mb-2 leading-relaxed">
        A fully on-chain roguelike built on Sui.
      </p>
      <p className="text-stone-500 text-sm mb-8 leading-relaxed">
        Mint a hero. Descend into the crypts. Fight monsters, find loot, survive — or die trying.
        Every item is a real object on Sui. Permadeath means your hero is gone forever.
      </p>

      <div className="flex justify-center gap-8 text-sm text-stone-500 mb-10">
        <Stat label="Dungeon Depth" value="∞" />
        <Stat label="Permadeath" value="Yes" />
        <Stat label="Loot" value="On-chain" />
        <Stat label="Gas Cost" value="~0" />
      </div>

      <div className="flex justify-center">
        <ConnectButton />
      </div>

      <p className="text-stone-600 text-xs mt-6">
        Connect a Sui wallet to begin. Runs on Sui Testnet.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-[family-name:var(--font-display)] text-stone-300 text-lg">{value}</div>
      <div className="text-xs uppercase tracking-wider">{label}</div>
    </div>
  );
}
