import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services";
import { useWorkspace } from "@/features/workspaces/WorkspaceProvider";
import type { PlanKey } from "@/types";

export const billingKeys = {
  subscription: (ws: string) => ["subscription", ws] as const,
  entitlements: (ws: string) => ["entitlements", ws] as const,
};

export function useSubscription() {
  const { workspace } = useWorkspace();
  return useQuery({ queryKey: billingKeys.subscription(workspace.id), queryFn: () => api.billing.subscription(workspace.id) });
}
/** Entitlements come from the database (trusted subscription state) — never from the checkout redirect. */
export function useEntitlements() {
  const { workspace } = useWorkspace();
  return useQuery({ queryKey: billingKeys.entitlements(workspace.id), queryFn: () => api.billing.entitlements(workspace.id) });
}
export function useBillingRefresh() {
  const qc = useQueryClient();
  return () => Promise.all(["subscription", "entitlements", "projects", "members"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}
export function useStartCheckout() {
  const { workspace } = useWorkspace();
  return useMutation({ mutationFn: (plan: Exclude<PlanKey, "free">) => api.billing.startCheckout(workspace.id, plan) });
}
export function useOpenPortal() {
  const { workspace } = useWorkspace();
  return useMutation({ mutationFn: () => api.billing.openPortal(workspace.id) });
}
