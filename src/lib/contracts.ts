// Deployed Move package address on Sui testnet.
// Set via NEXT_PUBLIC_PACKAGE_ID after `sui client publish`.
export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";

// Move call targets
export const heroTarget = (fn: string) => `${PACKAGE_ID}::hero::${fn}` as const;
export const itemTarget = (fn: string) => `${PACKAGE_ID}::items::${fn}` as const;

// Event type strings for queryEvents
export const HERO_MINT_EVENT = `${PACKAGE_ID}::hero::HeroMint`;
export const HERO_DEATH_EVENT = `${PACKAGE_ID}::hero::HeroDeath`;
export const ITEM_MINT_EVENT = `${PACKAGE_ID}::items::ItemMint`;
