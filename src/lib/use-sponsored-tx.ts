"use client";

import { useCallback, useState } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64, fromBase64 } from "@mysten/sui/utils";
import {
  useCurrentAccount,
  useSignTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";

interface SponsoredTxResult {
  digest: string;
}

/**
 * Hook for executing sponsored transactions.
 *
 * Usage:
 *   const { execute, loading, error } = useSponsoredTx();
 *   const result = await execute((tx) => {
 *     tx.moveCall({ target: "0x...::module::function" });
 *   });
 */
export function useSponsoredTx() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (
      build: (tx: Transaction) => void
    ): Promise<SponsoredTxResult | null> => {
      if (!account) {
        setError("Wallet not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Build the transaction kind (no gas info yet)
        const tx = new Transaction();
        build(tx);
        const kindBytes = await tx.build({
          client: suiClient,
          onlyTransactionKind: true,
        });

        // 2. Send to our gas station
        const res = await fetch("/api/sponsor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txKindBytes: toBase64(kindBytes),
            sender: account.address,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Sponsor request failed");
        }

        const { sponsoredTxBytes, sponsorSignature } = await res.json();

        // 3. Player signs the sponsored transaction
        const { signature: senderSignature } = await signTransaction({
          transaction: Transaction.from(fromBase64(sponsoredTxBytes)),
        });

        // 4. Submit with both signatures
        const result = await suiClient.executeTransactionBlock({
          transactionBlock: sponsoredTxBytes,
          signature: [senderSignature, sponsorSignature],
          options: { showEffects: true },
        });

        return { digest: result.digest };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transaction failed";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [account, suiClient, signTransaction]
  );

  return { execute, loading, error };
}
