"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useZkLogin } from "@/lib/zklogin-context";

export function AuthButtons({ variant }: { variant: "header" | "cta" }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <AuthButtonsInner variant={variant} />;
}

function AuthButtonsInner({ variant }: { variant: "header" | "cta" }) {
  const { session, loading } = useZkLogin();

  if (loading) return null;

  if (variant === "header") {
    return session ? (
      <Link href="/game" className="cta-btn text-xs py-2 px-4">
        Play
      </Link>
    ) : (
      <Link href="/login" className="cta-btn text-xs py-2 px-4">
        Sign In
      </Link>
    );
  }

  // CTA variant
  return session ? (
    <Link href="/game" className="cta-btn">
      Enter the Crypts
    </Link>
  ) : (
    <Link href="/login" className="cta-btn">
      Sign in with Google
    </Link>
  );
}
