import { Link } from "react-router-dom";
import { ArrowRight, Check, CreditCard, FolderKanban, History, Lock, ShieldCheck, UserSquare2, Users } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";
import { PLANS, PLAN_ORDER } from "@/lib/config";
import { cn } from "@/lib/utils";
import { isDemo } from "@/services";
import { useAuth } from "@/features/auth/AuthProvider";

const FEATURES = [
  { icon: FolderKanban, title: "Projects & tasks", body: "Kanban boards with priorities, deadlines and assignees. Drag a card, and the whole workspace updates." },
  { icon: UserSquare2, title: "Client directory", body: "Keep every client and their projects in one place, so context never lives in someone's inbox." },
  { icon: Users, title: "Teams & roles", body: "Invite teammates as owners, admins or members — each role enforced by the database, not just the UI." },
  { icon: History, title: "Activity feed", body: "A running log of what changed and who changed it, so nobody asks “what's the status?” twice." },
  { icon: CreditCard, title: "Built-in billing", body: "Stripe subscriptions with plan limits that are checked on the server, every time." },
  { icon: ShieldCheck, title: "Isolated by design", body: "Every workspace's data is separated with Postgres Row-Level Security. One tenant can't see another." },
];

function ProductPreview() {
  const col = (title: string, dot: string, cards: [string, string, string][]) => (
    <div className="flex-1 rounded-xl bg-stone-100/80 p-2">
      <div className="mb-2 flex items-center gap-1.5 px-1.5 pt-1 text-[10px] font-semibold text-stone-600"><span className={cn("size-1.5 rounded-full", dot)} />{title}<span className="text-stone-400">{cards.length}</span></div>
      <div className="space-y-2">
        {cards.map(([t, tag, tone]) => (
          <div key={t} className="rounded-lg border border-stone-200 bg-white p-2.5 shadow-sm">
            <p className="text-[11px] font-medium leading-snug text-stone-800">{t}</p>
            <div className="mt-2 flex items-center justify-between"><span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium", tone)}>{tag}</span><span className="size-4 rounded-full bg-indigo-100" /></div>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div aria-hidden className="relative mx-auto mt-16 max-w-5xl text-left">
      <div className="absolute -inset-x-8 -top-8 bottom-0 -z-10 rounded-[40px] bg-gradient-to-b from-indigo-100/70 via-indigo-50/40 to-transparent blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_80px_-20px_rgb(12_10_9/0.25)]">
        <div className="flex items-center gap-1.5 border-b border-line bg-stone-50 px-4 py-3">
          {[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-stone-300" />)}
          <span className="mx-auto rounded-md bg-white px-12 py-1 text-[10px] text-stone-400 ring-1 ring-stone-200">app.flowpilot.dev/projects</span>
        </div>
        <div className="flex min-h-[320px] bg-canvas">
          <div className="hidden w-44 shrink-0 space-y-1.5 border-r border-line p-3 sm:block">
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-white p-2"><span className="size-5 rounded-md bg-indigo-100" /><span className="h-2 w-16 rounded bg-stone-200" /></div>
            {["Dashboard", "Projects", "Clients", "Team", "Billing"].map((n, i) => (
              <div key={n} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium", i === 1 ? "bg-stone-900 text-white" : "text-stone-500")}><span className={cn("size-3 rounded", i === 1 ? "bg-white/30" : "bg-stone-200")} />{n}</div>
            ))}
          </div>
          <div className="min-w-0 flex-1 p-5">
            <p className="text-[15px] font-semibold text-stone-900">Lumen patient portal</p>
            <div className="mb-4 mt-1.5 flex items-center gap-3"><div className="h-1.5 w-40 overflow-hidden rounded-full bg-stone-200"><div className="h-full w-[38%] rounded-full bg-indigo-600" /></div><span className="text-[10px] font-medium text-stone-500">38%</span></div>
            <div className="flex gap-3">
              {col("To do", "bg-stone-400", [["Accessibility review (WCAG AA)", "Medium", "bg-sky-50 text-sky-700"], ["Usability test — 6 participants", "Low", "bg-stone-100 text-stone-500"]])}
              {col("In progress", "bg-indigo-500", [["Appointment booking wireframes", "High", "bg-amber-50 text-amber-700"]])}
              <div className="hidden flex-1 md:block">{col("In review", "bg-amber-500", [["Design tokens & component library", "Medium", "bg-sky-50 text-sky-700"]])}</div>
              <div className="hidden flex-1 lg:block">{col("Done", "bg-emerald-500", [["Audit current patient flows", "High", "bg-amber-50 text-amber-700"]])}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { status } = useAuth();
  const authed = status === "authed";
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" aria-label="FlowPilot home"><Logo /></Link>
          <nav aria-label="Primary" className="hidden items-center gap-8 text-sm font-medium text-ink-2 md:flex">
            <a href="#features" className="hover:text-ink">Features</a><a href="#security" className="hover:text-ink">Security</a><a href="#pricing" className="hover:text-ink">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            {authed ? <Link to="/dashboard"><Button size="sm">Open app<ArrowRight className="size-3.5" /></Button></Link> : (
              <><Link to="/login" className="hidden sm:block"><Button variant="ghost" size="sm">Sign in</Button></Link><Link to="/signup"><Button size="sm">Get started</Button></Link></>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-24 pt-20 text-center sm:pt-28">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink-2 shadow-card">
            <span className="size-1.5 rounded-full bg-emerald-500" />Projects · Clients · Teams · Billing
          </p>
          <h1 className="mx-auto mt-7 max-w-3xl text-[44px] font-semibold leading-[1.04] sm:text-[68px]">Run your studio from one <span className="text-accent">calm</span> workspace.</h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">FlowPilot brings clients, projects, tasks and your team together — with the permissions and billing of a real product built in.</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to={authed ? "/dashboard" : "/signup"}><Button size="lg" className="w-full sm:w-auto">{authed ? "Open dashboard" : "Start free"}<ArrowRight className="size-4" /></Button></Link>
            <Link to="/login"><Button size="lg" variant="secondary" className="w-full sm:w-auto" data-testid="hero-demo">{isDemo ? "Try the live demo" : "Sign in"}</Button></Link>
          </div>
          <p className="mt-4 text-[13px] text-faint">Free for small teams · No credit card required</p>
          <ProductPreview />
        </section>

        <section id="features" className="border-y border-line bg-surface py-24">
          <div className="mx-auto max-w-6xl px-5">
            <div className="max-w-xl"><p className="text-sm font-semibold text-accent">Everything in one place</p><h2 className="mt-3 text-[34px] font-semibold leading-tight">The essentials, without the clutter.</h2></div>
            <ul className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-sunken text-ink"><Icon className="size-5" aria-hidden /></span>
                  <h3 className="mt-5 text-[17px] font-semibold">{title}</h3><p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="security" className="bg-ink py-24 text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-300"><Lock className="size-4" aria-hidden />Security you can verify</p>
              <h2 className="mt-3 text-[34px] font-semibold leading-tight">Your data is protected where it lives — in the database.</h2>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-stone-400">Hiding a button isn't security. FlowPilot enforces access with Postgres Row-Level Security, validates plan limits on the server, and only trusts billing state that Stripe has signed.</p>
              <ul className="mt-8 space-y-3 text-[15px] text-stone-300">
                {["Tenant isolation on every table", "Roles checked by policies and RPCs", "Signature-verified, idempotent Stripe webhooks"].map((t) => <li key={t} className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-indigo-300" aria-hidden />{t}</li>)}
              </ul>
            </div>
            <pre aria-label="Example row-level security policy" className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] p-6 font-mono text-[12.5px] leading-relaxed text-stone-300"><code>{`create policy "projects: members read"
  on public.projects for select
  to authenticated
  using (private.is_member(workspace_id));

-- Alice can read Alice's workspace.
-- Alice cannot read Bob's — even
-- with Bob's project ID.`}</code></pre>
          </div>
        </section>

        <section id="pricing" className="py-24">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mx-auto max-w-xl text-center"><p className="text-sm font-semibold text-accent">Pricing</p><h2 className="mt-3 text-[34px] font-semibold leading-tight">Simple plans that grow with you.</h2><p className="mt-3 text-muted">Start free. Upgrade when you need more projects or seats.</p></div>
            <div className="mx-auto mt-14 grid max-w-5xl gap-4 lg:grid-cols-3">
              {PLAN_ORDER.map((k) => {
                const p = PLANS[k];
                return (
                  <div key={k} className={cn("flex flex-col rounded-2xl border bg-surface p-7 shadow-card", k === "pro" ? "border-ink ring-1 ring-ink" : "border-line")}>
                    <h3 className="text-lg font-semibold">{p.name}</h3><p className="mt-1 text-sm text-muted">{p.tagline}</p>
                    <p className="mt-6 flex items-baseline gap-1"><span className="text-5xl font-semibold tabular">${p.priceMonthly}</span><span className="text-sm text-muted">/ month</span></p>
                    <ul className="mt-7 flex-1 space-y-3 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2.5 text-ink-2"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />{f}</li>)}</ul>
                    <Link to="/signup" className="mt-8"><Button variant={k === "pro" ? "accent" : "secondary"} className="w-full" size="lg">{k === "free" ? "Start free" : `Choose ${p.name}`}</Button></Link>
                  </div>
                );
              })}
            </div>
            <p className="mt-6 text-center text-[13px] text-faint">Prices shown are portfolio demo tiers — checkout runs in Stripe test mode.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-muted sm:flex-row">
          <Logo className="opacity-80" /><p>© {new Date().getFullYear()} FlowPilot — a SaaS engineering case study.</p>
        </div>
      </footer>
    </div>
  );
}
