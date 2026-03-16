import { NextRequest, NextResponse } from "next/server";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64, fromBase64 } from "@mysten/sui/utils";
import client from "@/lib/sui-client";
import { getSponsorKeypair, getSponsorAddress } from "@/lib/sponsor";

export const maxDuration = 15;

/**
 * Gas Station API
 *
 * POST /api/sponsor
 * Body: { txKindBytes: string (base64), sender: string }
 *
 * Returns: { sponsoredTxBytes: string (base64), sponsorSignature: string (base64) }
 *
 * The frontend then:
 * 1. Deserializes sponsoredTxBytes
 * 2. Signs as the sender
 * 3. Submits with both signatures
 */
export async function POST(req: NextRequest) {
  try {
    const { txKindBytes, sender } = await req.json();

    if (!txKindBytes || !sender) {
      return NextResponse.json(
        { error: "Missing txKindBytes or sender" },
        { status: 400 }
      );
    }

    const sponsorKeypair = getSponsorKeypair();
    const sponsorAddress = getSponsorAddress();

    // Build the sponsored transaction from the kind bytes
    const tx = Transaction.fromKind(fromBase64(txKindBytes));
    tx.setSender(sender);
    tx.setGasOwner(sponsorAddress);

    // Get a gas coin owned by the sponsor
    const coins = await client.getCoins({ owner: sponsorAddress, coinType: "0x2::sui::SUI" });
    if (!coins.data.length) {
      return NextResponse.json(
        { error: "Sponsor wallet has no gas coins. Fund it from the testnet faucet." },
        { status: 503 }
      );
    }

    // Use the largest coin for gas
    const gasCoin = coins.data.sort(
      (a, b) => Number(BigInt(b.balance) - BigInt(a.balance))
    )[0];

    tx.setGasPayment([
      {
        objectId: gasCoin.coinObjectId,
        version: gasCoin.version,
        digest: gasCoin.digest,
      },
    ]);

    tx.setGasBudget(50_000_000); // 0.05 SUI — generous for testnet

    // Build and sign as sponsor
    const builtBytes = await tx.build({ client });
    const sponsorSig = await sponsorKeypair.signTransaction(builtBytes);

    return NextResponse.json({
      sponsoredTxBytes: toBase64(builtBytes),
      sponsorSignature: sponsorSig.signature,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Sponsor error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/sponsor — check sponsor wallet status
export async function GET() {
  try {
    const address = getSponsorAddress();
    const balance = await client.getBalance({ owner: address });

    return NextResponse.json({
      address,
      balance: balance.totalBalance,
      balanceSui: (Number(balance.totalBalance) / 1e9).toFixed(4),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
