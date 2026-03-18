# Crypts of Sui

On-chain roguelike dungeon crawler built on Sui blockchain.

## Project Overview

- **Stack**: Next.js 16 (App Router, TypeScript, Turbopack), Tailwind v4, Sui zkLogin, Vercel Postgres, @mysten/sui
- **Package manager**: pnpm
- **Deployment**: Vercel (https://sui-roguelike.vercel.app)
- **Repo**: https://github.com/TallblokeUK/Sui-Roguelike
- **Network**: Sui Testnet

## Architecture

### Move Smart Contracts
Deployed on Sui Testnet. Package ID: `0xaaea1e1a848829be913672b827bf9b0791b950ec0afe029d552bad6dea4e2ce2`
- `move/crypts_of_sui/sources/hero.move` — Hero mint (with recipient) / burn + HeroDeath events
- `move/crypts_of_sui/sources/items.move` — Item mint (with recipient) + ItemMint events
- Mint functions accept a `recipient: address` parameter — sponsor signs but items go to the player's zkLogin address
- Burn requires the owner (player) to call — done client-side with zkLogin signing

### On-Chain Integration (Hybrid Model)
Game logic (dungeon gen, combat, FOV, movement) runs client-side in React useReducer.
Sui blockchain handles key moments:
1. **Hero mint** — `POST /api/hero/mint` sponsor creates a Hero object, transfers to player's zkLogin address
2. **Item mint** — `POST /api/items/mint` sponsor creates Item objects, transfers to player's address (fire-and-forget)
3. **Hero burn** — Client-side zkLogin + sponsored transaction. Player signs with ephemeral key + ZK proof to burn their owned Hero object on death

### Authentication (zkLogin)
Players authenticate via Google OAuth → Sui zkLogin. No wallet extension needed.
- `src/lib/zklogin.ts` — Core zkLogin utilities (JWT decode, session storage, keypair serialization, signature creation)
- `src/lib/zklogin-context.tsx` — React context provider (`useZkLogin` hook)
- `src/app/login/page.tsx` — Google OAuth login with ephemeral key generation
- `src/app/auth/callback/page.tsx` — OAuth callback: processes JWT, gets salt + ZK proof, derives Sui address
- `src/app/api/zklogin/salt/route.ts` — Deterministic salt derivation (HMAC-SHA256 of sub claim)
- `src/app/api/zklogin/proof/route.ts` — Proxy to Mysten's ZK prover service (avoids CORS)

**zkLogin flow:**
1. Generate ephemeral keypair + nonce → redirect to Google OAuth
2. Google returns JWT in URL hash → extract id_token
3. Get salt from server → derive zkLogin Sui address
4. Get ZK proof from Mysten's prover → store session in sessionStorage
5. For client-side transactions: sign with ephemeral key, wrap in zkLogin signature

### Landing Page Data
Stats, death feed, and loot feed are pulled from Sui events (not a database):
- `GET /api/stats` queries `HeroDeath` and `ItemMint` events via Sui JSON-RPC
- `src/components/LiveFeeds.tsx` — client component that fetches and renders live data

### Gas Sponsorship
Players don't pay gas. A server-side sponsor keypair signs as gas payer for every transaction.
- `src/lib/sponsor.ts` — keypair management from `SPONSOR_SECRET_KEY` env var
- `src/app/api/sponsor/route.ts` — POST accepts `txKindBytes` + `sender`, returns sponsored tx bytes + sponsor signature

### Item Ownership
Items (weapons, armor, potions, rings) are real Sui objects owned by the player's zkLogin address.
Players can trade, gift, or equip items across hero lives. Inspired by EVE Frontier's on-chain ownership model.

### Key Directories
- `src/app/` — Next.js pages and API routes
- `src/components/` — React components
- `src/lib/` — Sui client, sponsor, zkLogin, contract constants
- `move/crypts_of_sui/` — Move smart contracts
- `scripts/` — Tooling (keypair generation, DB migrations)

### Leaderboard
Server-side leaderboard stored in Postgres `runs` table. Death records saved when hero dies.
- `src/app/api/leaderboard/route.ts` — GET (top 20 runs) / POST (save run with player name)
- `scripts/migrate.ts` — Creates/updates `runs` table (run with `npx tsx scripts/migrate.ts`)

### Environment Variables
- `NEXT_PUBLIC_PACKAGE_ID` — Deployed Move package address on Sui testnet
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Google OAuth Client ID for zkLogin
- `POSTGRES_URL` — Vercel Postgres connection string
- `ZKLOGIN_SALT_SECRET` — Secret for deterministic salt derivation (falls back to BETTER_AUTH_SECRET)
- `SPONSOR_SECRET_KEY` — Sui Ed25519 private key for gas sponsorship

## Commands

```bash
pnpm dev                    # Local dev server
pnpm build                  # Production build
pnpm lint                   # Lint
npx tsx scripts/migrate.ts  # Run DB migrations (creates/updates runs table)
npx vercel --prod           # Deploy to production
```

### Move Contract Commands
```bash
cd move/crypts_of_sui
~/.local/bin/sui move build                   # Build Move package
~/.local/bin/sui client publish --gas-budget 100000000  # Deploy to testnet
```

## Sponsor Wallet

- Address: `0xc42efe22dd1586be2635f3454a9d98d30b4b97f9e4607edec1ffd7213a04fb0e`
- Fund from faucet: https://faucet.sui.io/?address=0xc42efe22dd1586be2635f3454a9d98d30b4b97f9e4607edec1ffd7213a04fb0e
- Check balance: `GET /api/sponsor`
