import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/services";
import type { User } from "@/types";

type Status = "loading" | "authed" | "anon";
interface AuthValue {
  user: User | null;
  status: Status;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const apply = useCallback((u: User | null) => {
    setUserState(u);
    setStatus(u ? "authed" : "anon");
    if (!u) qc.clear(); // never leak one account's cached data to the next
  }, [qc]);

  useEffect(() => {
    let alive = true;
    api.auth.getUser().then((u) => { if (alive) apply(u); }).catch(() => { if (alive) apply(null); });
    const off = api.auth.onChange((u) => { if (alive) apply(u); });
    return () => { alive = false; off(); };
  }, [apply]);

  const value = useMemo<AuthValue>(() => ({
    user, status,
    signIn: async (email, password) => { apply(await api.auth.signIn(email, password)); },
    signUp: async (fullName, email, password) => {
      const res = await api.auth.signUp(fullName, email, password);
      if (res.user && !res.needsConfirmation) apply(res.user);
      return { needsConfirmation: res.needsConfirmation };
    },
    signOut: async () => { await api.auth.signOut(); apply(null); },
    setUser: setUserState,
  }), [user, status, apply]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
