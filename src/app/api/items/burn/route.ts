import { NextRequest, NextResponse } from "next/server";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import client from "@/lib/sui-client";
import { getSponsorKeypair, getSponsorAddress } from "@/lib/sponsor";
import { itemTarget } from "@/lib/contracts";

export const maxDuration = 15;

/**
 * POST /api/items/burn
 * Builds a sponsored burn_item transaction for the player to sign.
 * Accepts a single item or multiple items to burn in one PTB.
 *
 * Body: { itemObjectIds: string[], sender: string }
 * Returns: { sponsoredTxBytes, sponsorSignature }
 */
export async function POST(req: NextRequest) {
  try {
    const { itemObjectIds, sender } = await req.json();

    if (!itemObjectIds?.length || !sender) {
      return NextResponse.json(
        { error: "Missing itemObjectIds or sender" },
        { status: 400 },
      );
    }

    const sponsorKeypair = getSponsorKeypair();
    const sponsorAddress = getSponsorAddress();

    const tx = new Transaction();

    // Add a burn_item call for each item
    for (const objectId of itemObjectIds) {
      tx.moveCall({
        target: itemTarget("burn_item"),
        arguments: [tx.object(objectId)],
      });
    }

    tx.setSender(sender);
    tx.setGasOwner(sponsorAddress);

    const coins = await client.getCoins({
      owner: sponsorAddress,
      coinType: "0x2::sui::SUI",
    });
    if (!coins.data.length) {
      return NextResponse.json(
        { error: "Sponsor wallet has no gas coins" },
        { status: 503 },
      );
    }

    const gasCoin = coins.data.sort(
      (a, b) => Number(BigInt(b.balance) - BigInt(a.balance)),
    )[0];

    tx.setGasPayment([
      {
        objectId: gasCoin.coinObjectId,
        version: gasCoin.version,
        digest: gasCoin.digest,
      },
    ]);
    tx.setGasBudget(50_000_000);

    const builtBytes = await tx.build({ client });
    const sponsorSig = await sponsorKeypair.signTransaction(builtBytes);

    return NextResponse.json({
      sponsoredTxBytes: toBase64(builtBytes),
      sponsorSignature: sponsorSig.signature,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Item burn build error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
