"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  decodeJwt,
  deserializeKeypair,
  getExtendedEphemeralPublicKey,
  jwtToAddress,
  loadPreauth,
  clearPreauth,
  type ZkLoginSession,
} from "@/lib/zklogin";
import { useZkLogin } from "@/lib/zklogin-context";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { setSession } = useZkLogin();
  const [status, setStatus] = useState("Processing login...");
  const [error, setError] = useState("");

  useEffect(() => {
    async function processCallback() {
      try {
        // 1. Extract id_token from URL hash
        const hash = window.location.hash.slice(1);
        const params = new URLSearchParams(hash);
        const jwt = params.get("id_token");
        if (!jwt) throw new Error("No id_token in callback URL");

        // 2. Retrieve pre-auth params from sessionStorage
        const preauth = loadPreauth();
        if (!preauth) throw new Error("Session expired. Please login again.");
        clearPreauth();

        const { ephemeralKeyPairB64, randomness, maxEpoch } = preauth;

        // 3. Decode JWT
        setStatus("Verifying identity...");
        const decoded = decodeJwt(jwt);

        // 4. Get salt from server
        setStatus("Deriving wallet...");
        const saltRes = await fetch("/api/zklogin/salt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jwt }),
        });
        if (!saltRes.ok) throw new Error("Failed to get salt");
        const { salt } = await saltRes.json();

        // 5. Derive zkLogin address
        const address = jwtToAddress(jwt, BigInt(salt));

        // 6. Get ZK proof from prover (via our proxy)
        setStatus("Generating zero-knowledge proof...");
        const ephemeralKeyPair = deserializeKeypair(ephemeralKeyPairB64);
        const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
          ephemeralKeyPair.getPublicKey(),
        );

        const proofRes = await fetch("/api/zklogin/proof", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jwt,
            extendedEphemeralPublicKey,
            maxEpoch: maxEpoch.toString(),
            jwtRandomness: randomness,
            salt,
            keyClaimName: "sub",
          }),
        });

        if (!proofRes.ok) {
          const errData = await proofRes.json().catch(() => ({}));
          throw new Error(
            errData.error || "Failed to generate ZK proof",
          );
        }
        const zkProof = await proofRes.json();

        // 7. Build and save session
        const session: ZkLoginSession = {
          jwt,
          sub: decoded.sub,
          email: decoded.email || "",
          name: decoded.name || decoded.email || "Adventurer",
          salt,
          address,
          ephemeralKeyPairB64,
          randomness,
          maxEpoch,
          zkProof,
        };

        setSession(session);
        setStatus("Welcome, " + session.name + "!");

        // 8. Redirect to game
        setTimeout(() => router.push("/game"), 500);
      } catch (err) {
        console.error("Auth callback error:", err);
        setError(
          err instanceof Error ? err.message : "Authentication failed",
        );
      }
    }

    processCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-dvh stone-bg noise flex items-center justify-center px-6">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-blood text-lg font-[family-name:var(--font-mono)] mb-4">
              {error}
            </p>
            <button
              onClick={() => router.push("/login")}
              className="cta-btn text-sm"
            >
              Try Again
            </button>
          </>
        ) : (
          <>
            <div
              className="glyph mb-4"
              style={{ animation: "breathe 2s ease-in-out infinite" }}
            >
              &#x2726;
            </div>
            <p className="text-stone-400 font-[family-name:var(--font-mono)] text-sm">
              {status}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
