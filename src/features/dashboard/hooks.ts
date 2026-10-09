import { useQuery } from "@tanstack/react-query";
import { api } from "@/services";
import { useWorkspace } from "@/features/workspaces/WorkspaceProvider";

export const dashboardKeys = {
  stats: (ws: string) => ["dashboard", ws] as const,
  activity: (ws: string) => ["activity", ws] as const,
};

export function useDashboardStats() {
  const { workspace } = useWorkspace();
  return useQuery({ queryKey: dashboardKeys.stats(workspace.id), queryFn: () => api.dashboard.stats(workspace.id) });
}
export function useActivity(limit = 8) {
  const { workspace } = useWorkspace();
  return useQuery({ queryKey: [...dashboardKeys.activity(workspace.id), limit], queryFn: () => api.dashboard.activity(workspace.id, limit) });
}
