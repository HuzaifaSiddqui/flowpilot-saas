import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services";
import type { TaskInput } from "@/services/api";
import { useWorkspace } from "@/features/workspaces/WorkspaceProvider";
import type { Task } from "@/types";

export const taskKeys = { byProject: (id: string) => ["tasks", id] as const };

export function useProjectTasks(projectId: string) {
  return useQuery({ queryKey: taskKeys.byProject(projectId), queryFn: () => api.tasks.listByProject(projectId) });
}

function useRefreshAfterTask() {
  const qc = useQueryClient();
  return () => Promise.all(["dashboard", "activity", "tasks-all"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export function useCreateTask(projectId: string) {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const refresh = useRefreshAfterTask();
  return useMutation({
    mutationFn: (input: TaskInput) => api.tasks.create(workspace.id, projectId, input),
    onSettled: async () => { await qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) }); await refresh(); },
  });
}

/** Optimistic: the card moves instantly, and rolls back if the database rejects the change. */
export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  const refresh = useRefreshAfterTask();
  const key = taskKeys.byProject(projectId);
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TaskInput> & { position?: number } }) => api.tasks.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Task[]>(key);
      qc.setQueryData<Task[]>(key, (old) => old?.map((t) => (t.id === id ? { ...t, ...patch, assignedTo: patch.assignedTo === undefined ? t.assignedTo : patch.assignedTo } : t)));
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(key, ctx.previous); },
    onSettled: async () => { await qc.invalidateQueries({ queryKey: key }); await refresh(); },
  });
}

export function useDeleteTask(projectId: string) {
  const qc = useQueryClient();
  const refresh = useRefreshAfterTask();
  return useMutation({
    mutationFn: (id: string) => api.tasks.remove(id),
    onSettled: async () => { await qc.invalidateQueries({ queryKey: taskKeys.byProject(projectId) }); await refresh(); },
  });
}

export function useWorkspaceTasks() {
  const { workspace } = useWorkspace();
  return useQuery({ queryKey: ["tasks-all", workspace.id], queryFn: () => api.tasks.listByWorkspace(workspace.id) });
}
