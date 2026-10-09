import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services";
import type { ClientInput } from "@/services/api";
import { useWorkspace } from "@/features/workspaces/WorkspaceProvider";

export const clientKeys = { all: (ws: string) => ["clients", ws] as const };

export function useClients() {
  const { workspace } = useWorkspace();
  return useQuery({ queryKey: clientKeys.all(workspace.id), queryFn: () => api.clients.list(workspace.id) });
}
function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all(["clients", "projects", "activity"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}
export function useCreateClient() {
  const { workspace } = useWorkspace(); const refresh = useRefresh();
  return useMutation({ mutationFn: (input: ClientInput) => api.clients.create(workspace.id, input), onSettled: refresh });
}
export function useUpdateClient() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: ClientInput }) => api.clients.update(id, input), onSettled: refresh });
}
export function useDeleteClient() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (id: string) => api.clients.remove(id), onSettled: refresh });
}
