"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateAuthParams,
  buildGoogleLoginUrl,
  serializeKeypair,
  savePreauth,
} from "@/lib/zklogin";
import { useZkLogin } from "@/lib/zklogin-context";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useZkLogin();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (!sessionLoading && session) {
      router.push("/game");
    }
  }, [sessionLoading, session, router]);

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    try {
      const { ephemeralKeyPair, randomness, maxEpoch, nonce } =
        await generateAuthParams();

      // Store pre-auth params for the callback page
      savePreauth({
        ephemeralKeyPairB64: serializeKeypair(ephemeralKeyPair),
        randomness,
        maxEpoch,
      });

      const redirectUri = `${window.location.origin}/auth/callback`;
      const loginUrl = buildGoogleLoginUrl(nonce, redirectUri);
      window.location.href = loginUrl;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start login",
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh stone-bg noise flex items-center justify-center px-6">
      <div className="w-full max-w-sm fade-in">
        <div className="text-center mb-8">
          <div className="glyph mb-4">&#x2726; &middot; &#x2726; &middot; &#x2726;</div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-stone-200 tracking-[0.08em] mb-2">
            Enter the Crypts
          </h1>
          <p className="text-stone-500 text-sm font-[family-name:var(--font-body)]">
            Sign in with Google to begin your descent
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full cta-btn flex items-center justify-center gap-3 py-3 disabled:opacity-50"
        >
          {loading ? (
            <span className="text-stone-400 font-[family-name:var(--font-mono)] text-sm animate-pulse">
              Preparing...
            </span>
          ) : (
            <>
              <GoogleIcon />
              <span>Sign in with Google</span>
            </>
          )}
        </button>

        {error && (
          <p className="mt-4 text-blood text-sm text-center font-[family-name:var(--font-mono)]">
            {error}
          </p>
        )}

        <p className="mt-8 text-center text-stone-700 text-xs font-[family-name:var(--font-body)] leading-relaxed">
          Your Google account creates a Sui wallet via zkLogin.
          <br />
          No extensions. No seed phrases. No gas fees.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
