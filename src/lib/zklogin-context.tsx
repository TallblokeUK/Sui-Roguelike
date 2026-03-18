"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  type ZkLoginSession,
  loadSession,
  saveSession,
  clearSession,
  decodeJwt,
} from "./zklogin";

interface ZkLoginContextType {
  session: ZkLoginSession | null;
  loading: boolean;
  setSession: (session: ZkLoginSession) => void;
  signOut: () => void;
}

const ZkLoginContext = createContext<ZkLoginContextType>({
  session: null,
  loading: true,
  setSession: () => {},
  signOut: () => {},
});

export function ZkLoginProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<ZkLoginSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = loadSession();
    if (stored) {
      // Check if JWT is expired
      try {
        const payload = decodeJwt(stored.jwt);
        if (payload.exp * 1000 < Date.now()) {
          clearSession();
        } else {
          setSessionState(stored);
        }
      } catch {
        clearSession();
      }
    }
    setLoading(false);
  }, []);

  const setSession = useCallback((s: ZkLoginSession) => {
    saveSession(s);
    setSessionState(s);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setSessionState(null);
  }, []);

  return (
    <ZkLoginContext.Provider value={{ session, loading, setSession, signOut }}>
      {children}
    </ZkLoginContext.Provider>
  );
}

export function useZkLogin() {
  return useContext(ZkLoginContext);
}
