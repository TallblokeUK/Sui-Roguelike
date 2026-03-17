import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

let _keypair: Ed25519Keypair | null = null;

export function getSponsorKeypair(): Ed25519Keypair {
  if (!_keypair) {
    const secret = process.env.SPONSOR_SECRET_KEY?.trim();
    if (!secret) throw new Error("SPONSOR_SECRET_KEY not set");
    _keypair = Ed25519Keypair.fromSecretKey(secret);
  }
  return _keypair;
}

export function getSponsorAddress(): string {
  return getSponsorKeypair().getPublicKey().toSuiAddress();
}
