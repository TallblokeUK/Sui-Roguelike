"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ZkLoginProvider } from "@/lib/zklogin-context";

const queryClient = new QueryClient();

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ZkLoginProvider>
        {children}
      </ZkLoginProvider>
    </QueryClientProvider>
  );
}
