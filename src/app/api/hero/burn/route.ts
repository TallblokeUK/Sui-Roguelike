import { NextRequest, NextResponse } from "next/server";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import client from "@/lib/sui-client";
import { getSponsorKeypair, getSponsorAddress } from "@/lib/sponsor";
import { heroTarget } from "@/lib/contracts";

export const maxDuration = 15;

/**
 * POST /api/hero/burn
 * Builds a sponsored burn_hero transaction for the player to sign.
 * The hero object is owned by the player (zkLogin address), so only they can burn it.
 * Server handles: object resolution, tx building, sponsor signing.
 * Client handles: ephemeral key signing + zkLogin wrapping + execution.
 *
 * Body: { heroObjectId, level, floor, kills, turns, causeOfDeath, sender }
 * Returns: { sponsoredTxBytes, sponsorSignature }
 */
export async function POST(req: NextRequest) {
  try {
    const { heroObjectId, level, floor, kills, turns, causeOfDeath, sender } =
      await req.json();

    if (!heroObjectId || !sender) {
      return NextResponse.json(
        { error: "Missing heroObjectId or sender" },
        { status: 400 },
      );
    }

    // Verify the hero object exists and is owned by the sender
    const heroObj = await client.getObject({
      id: heroObjectId,
      options: { showOwner: true },
    });

    if (heroObj.error || !heroObj.data) {
      return NextResponse.json(
        { error: `Hero object not found: ${heroObj.error?.code || "unknown"}` },
        { status: 404 },
      );
    }

    const sponsorKeypair = getSponsorKeypair();
    const sponsorAddress = getSponsorAddress();

    // Build the burn transaction
    const tx = new Transaction();
    tx.moveCall({
      target: heroTarget("burn_hero"),
      arguments: [
        tx.object(heroObjectId),
        tx.pure.u64(level || 1),
        tx.pure.u64(floor || 1),
        tx.pure.u64(kills || 0),
        tx.pure.u64(turns || 0),
        tx.pure.string(causeOfDeath || "Unknown"),
      ],
    });

    tx.setSender(sender);
    tx.setGasOwner(sponsorAddress);

    // Get gas coin
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

    // Build and sign as sponsor
    const builtBytes = await tx.build({ client });
    const sponsorSig = await sponsorKeypair.signTransaction(builtBytes);

    return NextResponse.json({
      sponsoredTxBytes: toBase64(builtBytes),
      sponsorSignature: sponsorSig.signature,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Hero burn build error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
