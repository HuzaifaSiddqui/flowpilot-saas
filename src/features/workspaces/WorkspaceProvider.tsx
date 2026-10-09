import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Role, Workspace } from "@/types";

const STORAGE_KEY = "flowpilot-workspace";
interface WsValue {
  workspaces: Workspace[];
  workspace: Workspace;
  role: Role;
  switchWorkspace: (id: string) => void;
  refresh: () => Promise<void>;
}
const Ctx = createContext<WsValue | null>(null);
export const workspacesKey = (userId?: string) => ["workspaces", userId] as const;

export function WorkspaceProvider({ children }: { children: (state: { loading: boolean; error: unknown; retry: () => void; empty: boolean }) => ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: workspacesKey(user?.id), queryFn: () => api.workspaces.list(), enabled: Boolean(user) });
  const [selected, setSelected] = useState<string | null>(() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } });

  const workspaces = useMemo(() => q.data ?? [], [q.data]);
  const workspace = workspaces.find((w) => w.id === selected) ?? workspaces[0];

  useEffect(() => { if (workspace && workspace.id !== selected) setSelected(workspace.id); }, [workspace, selected]);
  const switchWorkspace = useCallback((id: string) => {
    setSelected(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* storage unavailable */ }
  }, []);
  const refresh = useCallback(async () => { await qc.invalidateQueries({ queryKey: ["workspaces"] }); }, [qc]);

  const value = useMemo<WsValue | null>(() => workspace ? { workspaces, workspace, role: workspace.role, switchWorkspace, refresh } : null, [workspaces, workspace, switchWorkspace, refresh]);
  const state = { loading: q.isLoading, error: q.error, retry: () => { void q.refetch(); }, empty: !q.isLoading && !q.error && !workspace };

  return <Ctx.Provider value={value}>{children(state)}</Ctx.Provider>;
}

export function useWorkspace(): WsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used inside an active workspace");
  return v;
}
