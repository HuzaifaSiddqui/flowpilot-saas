import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services";
import type { ProjectInput } from "@/services/api";
import { useWorkspace } from "@/features/workspaces/WorkspaceProvider";
import type { ProjectStatus } from "@/types";

export const projectKeys = {
  all: (ws: string) => ["projects", ws] as const,
  one: (id: string) => ["project", id] as const,
};

export function useProjects() {
  const { workspace } = useWorkspace();
  return useQuery({ queryKey: projectKeys.all(workspace.id), queryFn: () => api.projects.list(workspace.id) });
}
export function useProject(id: string) {
  return useQuery({ queryKey: projectKeys.one(id), queryFn: () => api.projects.get(id), retry: false });
}

/** Everything that depends on project counts / status must refresh together. */
function useRefreshWorkspaceData() {
  const qc = useQueryClient();
  const { workspace } = useWorkspace();
  return () => Promise.all(["projects", "project", "entitlements", "dashboard", "activity"].map((k) => qc.invalidateQueries({ queryKey: [k] }))).then(() => workspace.id);
}

export function useCreateProject() {
  const { workspace } = useWorkspace();
  const refresh = useRefreshWorkspaceData();
  return useMutation({ mutationFn: (input: ProjectInput) => api.projects.create(workspace.id, input), onSettled: refresh, meta: { silent: true } });
}
export function useUpdateProject() {
  const refresh = useRefreshWorkspaceData();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ProjectInput> & { status?: ProjectStatus } }) => api.projects.update(id, patch),
    onSettled: refresh,
  });
}
