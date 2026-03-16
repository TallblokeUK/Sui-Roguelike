# Crypts of Sui

On-chain roguelike dungeon crawler built on Sui blockchain.

## Project Overview

- **Stack**: Next.js 16 (App Router, TypeScript, Turbopack), Tailwind v4, @mysten/sui, @mysten/dapp-kit
- **Package manager**: pnpm
- **Deployment**: Vercel (https://sui-roguelike.vercel.app)
- **Repo**: https://github.com/TallblokeUK/Sui-Roguelike
- **Network**: Sui Testnet

## Architecture

### Gas Sponsorship
Players don't pay gas. A server-side sponsor keypair signs as gas payer for every transaction.
- `src/lib/sponsor.ts` — keypair management from `SPONSOR_SECRET_KEY` env var
- `src/app/api/sponsor/route.ts` — POST accepts `txKindBytes` + `sender`, returns sponsored tx bytes + sponsor signature
- `src/lib/use-sponsored-tx.ts` — React hook for seamless frontend integration

### Key Directories
- `src/app/` — Next.js pages and API routes
- `src/components/` — React components
- `src/lib/` — Sui client, sponsor, hooks, utilities
- `src/providers/` — Wallet/query providers
- `scripts/` — Tooling (keypair generation)

### Environment Variables
- `SPONSOR_SECRET_KEY` — Sui Ed25519 private key for gas sponsorship (set in `.env.local` and Vercel)

## Game Design (Planned)

- **Hero**: Mint a character (owned Sui object) with name, HP, ATK, DEF, XP, level
- **Dungeon**: Shared room objects with monsters, traps, loot tables
- **Combat**: Deterministic resolution with on-chain randomness for loot drops
- **Loot**: Weapon/armor/potion objects with rarity tiers — real owned objects
- **Permadeath**: Hero object is deleted (burned) on death — permanent and public
- **Move contracts**: To be deployed on Sui testnet (hero.move, dungeon.move, items.move, combat.move)

## Commands

```bash
pnpm dev          # Local dev server
pnpm build        # Production build
pnpm lint         # Lint
npx vercel --prod # Deploy to production
```

## Sponsor Wallet

- Address: `0xc42efe22dd1586be2635f3454a9d98d30b4b97f9e4607edec1ffd7213a04fb0e`
- Fund from faucet: `curl -X POST https://faucet.testnet.sui.io/v2/gas -H 'Content-Type: application/json' -d '{"FixedAmountRequest":{"recipient":"0xc42efe22dd1586be2635f3454a9d98d30b4b97f9e4607edec1ffd7213a04fb0e"}}'`
- Check balance: `GET /api/sponsor`
