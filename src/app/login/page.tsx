"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    await signIn.email(
      { email, password },
      {
        onSuccess: () => router.push("/game"),
        onError: (ctx) => setError(ctx.error.message || "Invalid credentials"),
      }
    );

    setLoading(false);
  };

  return (
    <div className="h-dvh flex flex-col items-center justify-center stone-bg noise px-6">
      <div className="fade-in text-center w-full max-w-sm">
        <div className="glyph mb-6">&#x2726; &middot; &#x2726; &middot; &#x2726;</div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-stone-200 tracking-[0.08em] mb-2">
          Return, Adventurer
        </h1>
        <p className="text-stone-500 font-[family-name:var(--font-body)] text-lg mb-8">
          Sign in to continue your descent.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-stone-500 text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-stone-900 border border-stone-700 rounded px-4 py-3 text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-gold/40 font-[family-name:var(--font-mono)] text-sm"
              placeholder="hero@example.com"
            />
          </div>

          <div>
            <label className="block text-stone-500 text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-stone-900 border border-stone-700 rounded px-4 py-3 text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-gold/40 font-[family-name:var(--font-mono)] text-sm"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-blood text-xs font-[family-name:var(--font-mono)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="cta-btn w-full disabled:opacity-50"
          >
            {loading ? "Entering..." : "Enter the Crypts"}
          </button>
        </form>

        <div className="mt-6 space-y-2 text-sm font-[family-name:var(--font-body)]">
          <p>
            <Link href="/forgot-password" className="text-stone-500 hover:text-gold transition">
              Forgot password?
            </Link>
          </p>
          <p className="text-stone-600">
            No account?{" "}
            <Link href="/register" className="text-gold hover:text-gold-bright transition">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
