import type { Metadata } from "next";
import { Cinzel, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/providers/WalletProvider";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Crypts of Sui — On-Chain Roguelike",
  description:
    "A fully on-chain roguelike dungeon crawler built on Sui. Mint heroes, explore dungeons, fight monsters, collect loot. Permadeath is real.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cinzel.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="antialiased">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
