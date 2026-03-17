"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (authClient as any).forgetPassword({
      email,
      redirectTo: "/reset-password",
    });

    if (error) {
      setError(error.message || "Something went wrong");
    } else {
      setSent(true);
    }

    setLoading(false);
  };

  return (
    <div className="h-dvh flex flex-col items-center justify-center stone-bg noise px-6">
      <div className="fade-in text-center w-full max-w-sm">
        <div className="glyph mb-6">&#x2726; &middot; &#x2726; &middot; &#x2726;</div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-stone-200 tracking-[0.08em] mb-2">
          Forgotten Passphrase
        </h1>

        {sent ? (
          <div className="mt-6">
            <p className="text-stone-400 font-[family-name:var(--font-body)] text-lg mb-4">
              If an account exists for <span className="text-gold">{email}</span>, a reset link has been sent.
            </p>
            <p className="text-stone-600 text-sm font-[family-name:var(--font-body)]">
              Check your email and follow the link to reset your password.
            </p>
            <Link href="/login" className="inline-block mt-8 cta-btn">
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <p className="text-stone-500 font-[family-name:var(--font-body)] text-lg mb-8">
              Enter your email to receive a reset link.
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

              {error && (
                <p className="text-blood text-xs font-[family-name:var(--font-mono)]">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="cta-btn w-full disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            <p className="mt-6 text-stone-600 text-sm font-[family-name:var(--font-body)]">
              Remember your password?{" "}
              <Link href="/login" className="text-gold hover:text-gold-bright transition">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
