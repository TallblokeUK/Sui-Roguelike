import { NextRequest, NextResponse } from "next/server";

const PROVER_URL = "https://prover-dev.mystenlabs.com/v1";

export const maxDuration = 30;

/**
 * POST /api/zklogin/proof
 * Proxies the ZK proof request to Mysten's prover service.
 * This avoids CORS issues when calling from the browser.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(PROVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Prover error:", res.status, text);
      return NextResponse.json(
        { error: `Prover returned ${res.status}` },
        { status: res.status },
      );
    }

    const proof = await res.json();
    return NextResponse.json(proof);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Proof proxy error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
