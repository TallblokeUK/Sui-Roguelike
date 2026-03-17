"use client";

import dynamic from "next/dynamic";

const GameScreen = dynamic(
  () => import("@/components/game/GameScreen").then((m) => m.GameScreen),
  { ssr: false }
);

export default function GamePage() {
  return <GameScreen />;
}
