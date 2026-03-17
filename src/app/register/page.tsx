"use client";

import { useState } from "react";
import { signUp } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    await signUp.email(
      { name, email, password },
      {
        onSuccess: () => router.push("/game"),
        onError: (ctx) => setError(ctx.error.message || "Registration failed"),
      }
    );

    setLoading(false);
  };

  return (
    <div className="h-dvh flex flex-col items-center justify-center stone-bg noise px-6">
      <div className="fade-in text-center w-full max-w-sm">
        <div className="glyph mb-6">&#x2726; &middot; &#x2726; &middot; &#x2726;</div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-stone-200 tracking-[0.08em] mb-2">
          Join the Descent
        </h1>
        <p className="text-stone-500 font-[family-name:var(--font-body)] text-lg mb-8">
          Create an account to begin.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-stone-500 text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-stone-900 border border-stone-700 rounded px-4 py-3 text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-gold/40 font-[family-name:var(--font-mono)] text-sm"
              placeholder="Your adventurer name"
            />
          </div>

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
              placeholder="Min 8 characters"
            />
          </div>

          <div>
            <label className="block text-stone-500 text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-stone-600 text-sm font-[family-name:var(--font-body)]">
          Already have an account?{" "}
          <Link href="/login" className="text-gold hover:text-gold-bright transition">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
