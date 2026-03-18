// Original package address — used for event types and existing function calls.
export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";

// Upgraded package address — needed for calling functions added in upgrades.
// On Sui, new functions are only callable via the upgraded package ID.
export const UPGRADED_PACKAGE_ID = process.env.NEXT_PUBLIC_UPGRADED_PACKAGE_ID || PACKAGE_ID;

// Move call targets (use upgraded ID so new functions like record_death work)
export const heroTarget = (fn: string) => `${UPGRADED_PACKAGE_ID}::hero::${fn}` as const;
export const itemTarget = (fn: string) => `${UPGRADED_PACKAGE_ID}::items::${fn}` as const;

// Event type strings for queryEvents
export const HERO_MINT_EVENT = `${PACKAGE_ID}::hero::HeroMint`;
export const HERO_DEATH_EVENT = `${PACKAGE_ID}::hero::HeroDeath`;
export const ITEM_MINT_EVENT = `${PACKAGE_ID}::items::ItemMint`;
