"use client";

import { useState, Suspense } from "react";
import { authClient } from "@/lib/auth-client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const tokenError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(tokenError === "INVALID_TOKEN" ? "Reset link has expired. Please request a new one." : "");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token || tokenError) {
    return (
      <div className="text-center">
        <p className="text-blood font-[family-name:var(--font-mono)] text-sm mb-6">
          {error || "Invalid or missing reset token."}
        </p>
        <Link href="/forgot-password" className="cta-btn">
          Request New Link
        </Link>
      </div>
    );
  }

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (authClient as any).resetPassword({
      newPassword: password,
      token,
    });

    if (error) {
      setError(error.message || "Reset failed");
    } else {
      setSuccess(true);
    }

    setLoading(false);
  };

  if (success) {
    return (
      <div className="text-center">
        <p className="text-heal font-[family-name:var(--font-body)] text-lg mb-6">
          Password reset successfully.
        </p>
        <Link href="/login" className="cta-btn">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      <div>
        <label className="block text-stone-500 text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider mb-1">
          New Password
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
          Confirm New Password
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
        {loading ? "Resetting..." : "Reset Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="h-dvh flex flex-col items-center justify-center stone-bg noise px-6">
      <div className="fade-in text-center w-full max-w-sm">
        <div className="glyph mb-6">&#x2726; &middot; &#x2726; &middot; &#x2726;</div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-stone-200 tracking-[0.08em] mb-8">
          New Passphrase
        </h1>
        <Suspense fallback={<p className="text-stone-600 text-sm">Loading...</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
