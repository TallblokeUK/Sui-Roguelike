// Run with: npx tsx scripts/generate-sponsor-key.ts
// Generates a new Ed25519 keypair for the gas sponsor wallet

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const keypair = new Ed25519Keypair();

console.log("=== Gas Sponsor Wallet ===");
console.log(`Address:     ${keypair.getPublicKey().toSuiAddress()}`);
console.log(`Secret Key:  ${keypair.getSecretKey()}`);
console.log("");
console.log("Add this to your .env.local:");
console.log(`SPONSOR_SECRET_KEY=${keypair.getSecretKey()}`);
