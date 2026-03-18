import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  jwtToAddress,
  genAddressSeed,
  getZkLoginSignature,
} from "@mysten/sui/zklogin";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const SESSION_KEY = "zklogin_session";
const PREAUTH_KEY = "zklogin_preauth";

// ─── Types ───

export interface PartialZkLoginSignature {
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
}

export interface ZkLoginSession {
  jwt: string;
  sub: string;
  email: string;
  name: string;
  salt: string;
  address: string;
  ephemeralKeyPairB64: string;
  randomness: string;
  maxEpoch: number;
  zkProof: PartialZkLoginSignature | null;
}

export interface JwtPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  email?: string;
  name?: string;
  nonce?: string;
}

// ─── JWT helpers ───

export function decodeJwt(jwt: string): JwtPayload {
  const payload = jwt.split(".")[1];
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(base64));
}

export function getAud(jwt: JwtPayload): string {
  return Array.isArray(jwt.aud) ? jwt.aud[0] : jwt.aud;
}

// ─── Session storage ───

export function saveSession(session: ZkLoginSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): ZkLoginSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PREAUTH_KEY);
}

// ─── Keypair serialization ───

export function serializeKeypair(kp: Ed25519Keypair): string {
  return kp.getSecretKey();
}

export function deserializeKeypair(secret: string): Ed25519Keypair {
  return Ed25519Keypair.fromSecretKey(secret);
}

// ─── Pre-auth: generate params before OAuth redirect ───

export async function generateAuthParams() {
  const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
  const { epoch } = await suiClient.getLatestSuiSystemState();
  const maxEpoch = Number(epoch) + 10;
  const ephemeralKeyPair = new Ed25519Keypair();
  const randomness = generateRandomness();
  const nonce = generateNonce(
    ephemeralKeyPair.getPublicKey(),
    maxEpoch,
    randomness,
  );

  return { ephemeralKeyPair, randomness, maxEpoch, nonce };
}

export function savePreauth(data: {
  ephemeralKeyPairB64: string;
  randomness: string;
  maxEpoch: number;
}) {
  sessionStorage.setItem(PREAUTH_KEY, JSON.stringify(data));
}

export function loadPreauth(): {
  ephemeralKeyPairB64: string;
  randomness: string;
  maxEpoch: number;
} | null {
  try {
    const raw = sessionStorage.getItem(PREAUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPreauth() {
  sessionStorage.removeItem(PREAUTH_KEY);
}

// ─── Google OAuth URL ───

export function buildGoogleLoginUrl(
  nonce: string,
  redirectUri: string,
): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID not set");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "id_token",
    scope: "openid email profile",
    nonce,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ─── zkLogin signature for transactions ───

export function createZkLoginSignature(
  session: ZkLoginSession,
  userSignature: string,
): string {
  if (!session.zkProof) throw new Error("No ZK proof available");

  const decodedJwt = decodeJwt(session.jwt);
  const aud = getAud(decodedJwt);

  const addressSeed = genAddressSeed(
    BigInt(session.salt),
    "sub",
    decodedJwt.sub,
    aud,
  ).toString();

  return getZkLoginSignature({
    inputs: {
      ...session.zkProof,
      addressSeed,
    },
    maxEpoch: session.maxEpoch,
    userSignature,
  });
}

// Re-exports
export {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  jwtToAddress,
};
