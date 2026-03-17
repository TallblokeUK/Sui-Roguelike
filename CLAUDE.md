# Crypts of Sui

On-chain roguelike dungeon crawler built on Sui blockchain.

## Project Overview

- **Stack**: Next.js 16 (App Router, TypeScript, Turbopack), Tailwind v4, Better Auth, Vercel Postgres, @mysten/sui, @mysten/dapp-kit
- **Package manager**: pnpm
- **Deployment**: Vercel (https://sui-roguelike.vercel.app)
- **Repo**: https://github.com/TallblokeUK/Sui-Roguelike
- **Network**: Sui Testnet

## Architecture

### Move Smart Contracts
Deployed on Sui Testnet. Package ID: `0x60401a78e4cf91b377388cfcebaff0fc040d3fef4387b580e5f39e9ebce468e0`
- `move/crypts_of_sui/sources/hero.move` — Hero mint/burn + HeroDeath events
- `move/crypts_of_sui/sources/items.move` — Item mint + ItemMint events
- Sponsor keypair is both sender and gas payer for all on-chain transactions (no wallet needed from users)

### On-Chain Integration (Hybrid Model)
Game logic (dungeon gen, combat, FOV, movement) runs client-side in React useReducer.
Sui blockchain handles key moments:
1. **Hero mint** — `POST /api/hero/mint` creates a Hero object on Sui when game starts
2. **Item mint** — `POST /api/items/mint` creates Item objects on Sui when loot is picked up (fire-and-forget)
3. **Hero burn** — `POST /api/hero/burn` burns Hero on death, emitting HeroDeath event with final stats

### Landing Page Data
Stats, death feed, and loot feed are pulled from Sui events (not a database):
- `GET /api/stats` queries `HeroDeath` and `ItemMint` events via Sui JSON-RPC
- `src/components/LiveFeeds.tsx` — client component that fetches and renders live data

### Gas Sponsorship
Players don't pay gas. A server-side sponsor keypair signs as gas payer for every transaction.
- `src/lib/sponsor.ts` — keypair management from `SPONSOR_SECRET_KEY` env var
- `src/app/api/sponsor/route.ts` — POST accepts `txKindBytes` + `sender`, returns sponsored tx bytes + sponsor signature

### Key Directories
- `src/app/` — Next.js pages and API routes
- `src/components/` — React components
- `src/lib/` — Sui client, sponsor, hooks, utilities, contract constants
- `move/crypts_of_sui/` — Move smart contracts
- `scripts/` — Tooling (keypair generation, DB migrations)

### Authentication
Users register with email + password. Better Auth handles sessions, password hashing, and reset flows.
- `src/lib/auth.ts` — Better Auth server config (Postgres + Resend)
- `src/lib/auth-client.ts` — Client-side auth hooks (`useSession`, `signIn`, `signUp`, `signOut`)
- `src/app/api/auth/[...all]/route.ts` — Catch-all auth API route
- Auth pages: `/login`, `/register`, `/forgot-password`, `/reset-password`

### Leaderboard
Server-side leaderboard stored in Postgres `runs` table. Death records are also saved to DB when hero is burned on-chain.
- `src/app/api/leaderboard/route.ts` — GET (top 20 runs) / POST (save run, requires auth)
- `scripts/migrate.ts` — Creates `runs` table (run with `npx tsx scripts/migrate.ts`)

### Environment Variables
- `NEXT_PUBLIC_PACKAGE_ID` — Deployed Move package address on Sui testnet
- `POSTGRES_URL` — Vercel Postgres connection string (auto-injected by Vercel)
- `BETTER_AUTH_SECRET` — Random secret string for auth sessions
- `RESEND_API_KEY` — Resend API key for password reset emails
- `EMAIL_FROM` — Sender email for password resets (optional, defaults to noreply@cryptsofsui.com)
- `SPONSOR_SECRET_KEY` — Sui Ed25519 private key for gas sponsorship (set in `.env.local` and Vercel)

## Commands

```bash
pnpm dev                    # Local dev server
pnpm build                  # Production build
pnpm lint                   # Lint
npx auth migrate            # Run Better Auth DB migrations (creates user/session/account/verification tables)
npx tsx scripts/migrate.ts  # Run custom DB migrations (creates runs table)
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
