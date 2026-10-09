import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services";
import { useWorkspace } from "@/features/workspaces/WorkspaceProvider";
import { can } from "@/lib/config";
import type { Role } from "@/types";

export const teamKeys = {
  members: (ws: string) => ["members", ws] as const,
  invitations: (ws: string) => ["invitations", ws] as const,
  mine: () => ["my-invitations"] as const,
};

export function useMembers() {
  const { workspace } = useWorkspace();
  return useQuery({ queryKey: teamKeys.members(workspace.id), queryFn: () => api.members.list(workspace.id) });
}
export function useInvitations() {
  const { workspace, role } = useWorkspace();
  return useQuery({ queryKey: teamKeys.invitations(workspace.id), queryFn: () => api.members.invitations(workspace.id), enabled: can.inviteMembers(role) });
}
export function useMyInvitations() {
  return useQuery({ queryKey: teamKeys.mine(), queryFn: () => api.members.myInvitations() });
}
function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all(["members", "invitations", "entitlements", "my-invitations", "workspaces"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}
export function useInvite() {
  const { workspace } = useWorkspace(); const refresh = useRefresh();
  return useMutation({ mutationFn: (v: { email: string; role: Exclude<Role, "owner"> }) => api.members.invite(workspace.id, v.email, v.role), onSettled: refresh, meta: { silent: true } });
}
export function useChangeRole() {
  const { workspace } = useWorkspace(); const refresh = useRefresh();
  return useMutation({ mutationFn: (v: { userId: string; role: Exclude<Role, "owner"> }) => api.members.changeRole(workspace.id, v.userId, v.role), onSettled: refresh });
}
export function useRemoveMember() {
  const { workspace } = useWorkspace(); const refresh = useRefresh();
  return useMutation({ mutationFn: (userId: string) => api.members.remove(workspace.id, userId), onSettled: refresh });
}
export function useRevokeInvitation() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (id: string) => api.members.revokeInvitation(id), onSettled: refresh });
}
export function useAcceptInvitation() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (id: string) => api.members.acceptInvitation(id), onSettled: refresh });
}
