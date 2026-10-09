import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, CreditCard, ExternalLink, FlaskConical, Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { Progress } from "@/components/ui/Progress";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useBillingRefresh, useEntitlements, useOpenPortal, useStartCheckout, useSubscription } from "@/features/billing/hooks";
import { useWorkspace } from "@/features/workspaces/WorkspaceProvider";
import { can, PLAN_ORDER, PLANS } from "@/lib/config";
import { toAppError } from "@/lib/errors";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/services";
import type { PlanKey } from "@/types";

type Paid = Exclude<PlanKey, "free">;

function TestCheckout({ plan, onClose, onPaid }: { plan: Paid; onClose: () => void; onPaid: () => Promise<void> }) {
  const { workspace } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const cfg = PLANS[plan];
  return (
    <Dialog open onClose={onClose} title="Test checkout" description="Simulated Stripe Checkout — no real payment is taken.">
      <div className="mb-5 rounded-xl border border-line bg-sunken/60 p-4">
        <div className="flex items-baseline justify-between"><span className="font-semibold">FlowPilot {cfg.name}</span><span className="text-lg font-semibold tabular">${cfg.priceMonthly}<span className="text-sm font-normal text-muted"> / month</span></span></div>
        <p className="mt-1 text-[13px] text-muted">{cfg.tagline}</p>
      </div>
      <Field label="Test card" hint="Stripe's published test number.">{(id) => <Input id={id} readOnly value="4242 4242 4242 4242" className="font-mono" />}</Field>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="accent" loading={busy} onClick={async () => { setBusy(true); try { await api.billing.simulate!.completeCheckout(workspace.id, plan); } finally { setBusy(false); } await onPaid(); }} data-testid="pay">
          <Lock className="size-3.5" />Pay ${cfg.priceMonthly}
        </Button>
      </div>
    </Dialog>
  );
}

export default function Billing() {
  const { workspace, role } = useWorkspace();
  const sub = useSubscription();
  const ent = useEntitlements();
  const checkout = useStartCheckout();
  const portal = useOpenPortal();
  const refresh = useBillingRefresh();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [testPlan, setTestPlan] = useState<Paid | null>(null);
  const owner = can.manageBilling(role);
  const demo = api.billing.simulate !== undefined;

  // Returning from Stripe: the redirect itself proves nothing — poll until the webhook has updated the DB.
  const returned = params.get("checkout");
  useEffect(() => {
    if (returned === "canceled") { toast.error("Checkout was canceled — you haven't been charged."); params.delete("checkout"); setParams(params, { replace: true }); return; }
    if (returned !== "success") return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries++; await refresh();
      if (tries >= 6) { clearInterval(timer); params.delete("checkout"); setParams(params, { replace: true }); }
    }, 2000);
    toast.success("Thanks! Confirming your subscription…");
    return () => clearInterval(timer);
  }, [returned]);

  if (sub.isLoading || ent.isLoading) return <><PageHeader title="Billing" /><div className="space-y-4"><Skeleton className="h-40" /><div className="grid gap-4 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-96" />)}</div></div></>;
  if (sub.error || ent.error || !sub.data || !ent.data) return <><PageHeader title="Billing" /><ErrorState error={sub.error ?? ent.error} onRetry={() => { void sub.refetch(); void ent.refetch(); }} /></>;

  const s = sub.data, e = ent.data;
  const effective = PLANS[e.plan];
  const pastDue = s.plan !== "free" && !["active", "trialing"].includes(s.status);

  async function go(fn: () => Promise<{ url?: string; simulated?: boolean }>, plan?: Paid) {
    try {
      const r = await fn();
      if (r.url) window.location.assign(r.url);
      else if (r.simulated && plan) setTestPlan(plan);
      else if (r.simulated) toast.success("Demo mode: the Stripe customer portal would open here.");
    } catch (err) { toast.error(toAppError(err).message); }
  }

  return (
    <>
      <PageHeader title="Billing" description="Plans, usage and payment details for this workspace."
        actions={owner && s.hasCustomer && <Button variant="secondary" loading={portal.isPending} onClick={() => void go(() => portal.mutateAsync())}><CreditCard className="size-4" />Manage billing<ExternalLink className="size-3.5 text-muted" /></Button>} />

      {pastDue && (
        <div role="alert" className="mb-4 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" aria-hidden />
          <p><strong>Your last payment didn't go through.</strong> {PLANS[s.plan].name} features are paused and the workspace is on Free limits until payment succeeds.{owner ? " Update your card in Manage billing." : " Ask the workspace owner to update the payment method."}</p>
        </div>
      )}
      {!owner && <p className="mb-4 flex items-center gap-2 rounded-xl bg-sunken px-4 py-3 text-sm text-ink-2"><Lock className="size-4 text-muted" aria-hidden />Only the workspace owner can change the plan.</p>}

      <Card className="mb-6">
        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[13px] font-medium text-muted">Current plan</p>
            <div className="mt-1.5 flex items-center gap-3">
              <h2 className="text-[26px] font-semibold" data-testid="current-plan">{effective.name}</h2>
              <Badge className={pastDue ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}>{pastDue ? "Payment failed" : s.cancelAtPeriodEnd ? "Cancels soon" : "Active"}</Badge>
            </div>
            <p className="mt-1.5 text-sm text-muted">
              {s.plan === "free" ? "Free forever." : s.cancelAtPeriodEnd ? `Access until ${formatDate(s.currentPeriodEnd, { month: "long", day: "numeric", year: "numeric" })}, then back to Free.` : `Renews ${formatDate(s.currentPeriodEnd, { month: "long", day: "numeric", year: "numeric" })} · $${PLANS[s.plan].priceMonthly}/month`}
            </p>
          </div>
          <div className="grid w-full gap-5 sm:grid-cols-2 md:max-w-md">
            <div>
              <div className="mb-2 flex justify-between text-[13px]"><span className="text-muted">Projects</span><span className="font-medium tabular">{e.projectsUsed}{e.maxProjects ? ` / ${e.maxProjects}` : " · unlimited"}</span></div>
              <Progress value={e.maxProjects ? (e.projectsUsed / e.maxProjects) * 100 : 8} label="Projects used" />
            </div>
            <div>
              <div className="mb-2 flex justify-between text-[13px]"><span className="text-muted">Seats</span><span className="font-medium tabular">{e.seatsUsed} / {e.maxSeats}</span></div>
              <Progress value={(e.seatsUsed / e.maxSeats) * 100} label="Seats used" />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_ORDER.map((key) => {
          const p = PLANS[key];
          const current = key === s.plan;
          const higher = PLAN_ORDER.indexOf(key) > PLAN_ORDER.indexOf(s.plan);
          return (
            <Card key={key} className={cn("relative flex flex-col p-6", key === "pro" && "border-ink ring-1 ring-ink")} data-testid={`plan-${key}`}>
              {key === "pro" && <Badge className="absolute right-5 top-5 bg-ink text-white">Recommended</Badge>}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-sm text-muted">{p.tagline}</p>
              <p className="mt-5 flex items-baseline gap-1"><span className="text-[40px] font-semibold leading-none tabular">${p.priceMonthly}</span><span className="text-sm text-muted">/ month</span></p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {p.features.map((f) => <li key={f} className="flex gap-2.5 text-ink-2"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />{f}</li>)}
              </ul>
              <div className="mt-7">
                {current ? <Button variant="secondary" className="w-full" disabled>Current plan</Button>
                  : !owner ? <Button variant="secondary" className="w-full" disabled>Owner only</Button>
                  : higher && key !== "free" ? <Button variant={key === "pro" ? "accent" : "primary"} className="w-full" loading={checkout.isPending && checkout.variables === key} onClick={() => void go(() => checkout.mutateAsync(key as Paid), key as Paid)}>Upgrade to {p.name}</Button>
                  : <Button variant="secondary" className="w-full" onClick={() => void go(() => portal.mutateAsync())}>Change in billing portal</Button>}
              </div>
            </Card>
          );
        })}
      </div>

      {demo && owner && (
        <Card className="mt-6 border-dashed">
          <CardHeader title={<span className="flex items-center gap-2"><FlaskConical className="size-4 text-accent" aria-hidden />Demo controls</span>} description="Stand-ins for Stripe webhook events. With Supabase and Stripe connected, these happen automatically." />
          <div className="flex flex-wrap gap-2 px-5 pb-5 pt-4">
            <Button variant="secondary" size="sm" disabled={!s.hasCustomer || pastDue} onClick={async () => { await api.billing.simulate!.failPayment(workspace.id); await refresh(); toast.error("Simulated invoice.payment_failed"); }}>Simulate payment failure</Button>
            <Button variant="secondary" size="sm" disabled={!s.hasCustomer || s.cancelAtPeriodEnd} onClick={async () => { await api.billing.simulate!.cancel(workspace.id); await refresh(); toast.success("Simulated cancellation at period end"); }}>Simulate cancellation</Button>
          </div>
        </Card>
      )}

      {testPlan && <TestCheckout plan={testPlan} onClose={() => setTestPlan(null)} onPaid={async () => { await refresh(); setTestPlan(null); toast.success(`Welcome to ${PLANS[testPlan].name}!`); }} />}
    </>
  );
}
