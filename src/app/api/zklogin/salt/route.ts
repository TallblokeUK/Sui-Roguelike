import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const SALT_SECRET =
  process.env.ZKLOGIN_SALT_SECRET ||
  process.env.BETTER_AUTH_SECRET ||
  "crypts-of-sui-salt-secret";

/**
 * POST /api/zklogin/salt
 * Body: { jwt: string }
 * Returns: { salt: string }
 *
 * Derives a deterministic salt from the JWT's `sub` claim using HMAC.
 * Same user always gets the same salt → same Sui address.
 */
export async function POST(req: NextRequest) {
  try {
    const { jwt } = await req.json();
    if (!jwt) {
      return NextResponse.json({ error: "JWT required" }, { status: 400 });
    }

    // Decode JWT payload to get sub claim
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString(),
    );
    const sub = payload.sub;
    if (!sub) {
      return NextResponse.json(
        { error: "Invalid JWT: missing sub" },
        { status: 400 },
      );
    }

    // Derive salt deterministically: HMAC-SHA256(secret, sub) → 128-bit BigInt
    const hmac = crypto
      .createHmac("sha256", SALT_SECRET)
      .update(sub)
      .digest();
    const salt = BigInt("0x" + hmac.slice(0, 16).toString("hex")).toString();

    return NextResponse.json({ salt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Salt error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
