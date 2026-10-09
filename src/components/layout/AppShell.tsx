import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, X, Info, RotateCcw } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import { SidebarContent } from "./SidebarContent";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/Button";
import { useMyInvitations, useAcceptInvitation } from "@/features/team/hooks";
import { useToast } from "@/components/ui/Toast";
import { isDemo } from "@/services";
import { resetDemo } from "@/services/demoApi";

const BANNER_KEY = "flowpilot-demo-banner-dismissed";

function DemoBanner() {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(BANNER_KEY) === "1"; } catch { return false; } });
  if (!isDemo || hidden) return null;
  return (
    <div role="note" data-testid="demo-banner" className="flex items-center justify-center gap-3 bg-ink px-4 py-2 text-[13px] text-stone-300">
      <Info className="size-3.5 shrink-0 text-indigo-300" aria-hidden />
      <span><strong className="font-semibold text-white">Demo mode</strong> — data is stored in your browser. Add Supabase keys to go live.</span>
      <button onClick={() => { resetDemo(); window.location.assign("/login"); }} className="hidden items-center gap-1 text-stone-400 underline-offset-2 hover:text-white hover:underline sm:inline-flex"><RotateCcw className="size-3" />Reset</button>
      <button aria-label="Dismiss demo notice" onClick={() => { try { localStorage.setItem(BANNER_KEY, "1"); } catch { /* ignore */ } setHidden(true); }} className="text-stone-500 hover:text-white"><X className="size-3.5" /></button>
    </div>
  );
}

function InvitationBanner() {
  const { data } = useMyInvitations();
  const accept = useAcceptInvitation();
  const toast = useToast();
  const first = data?.[0];
  if (!first) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-accent-soft px-4 py-3 text-sm">
      <p>You've been invited to join <strong>{first.workspaceName ?? "a workspace"}</strong> as {first.role}.</p>
      <Button size="sm" variant="accent" loading={accept.isPending} onClick={() => accept.mutate(first.id, { onSuccess: () => toast.success("Invitation accepted") })}>Accept invitation</Button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (drawer && !d.open) d.showModal();
    if (!drawer && d.open) d.close();
  }, [drawer]);
  useEffect(() => { setDrawer(false); }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 border-r border-line bg-canvas lg:block" aria-label="Sidebar">
          <SidebarContent />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <DemoBanner />
          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur lg:hidden">
            <Link to="/dashboard"><Logo /></Link>
            <Button variant="secondary" size="icon" aria-label="Open navigation" onClick={() => setDrawer(true)}><Menu className="size-4" /></Button>
          </div>
          <main id="main" className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-8 sm:py-9">
            <InvitationBanner />
            <div className="fp-fade-up" key={pathname}>{children}</div>
          </main>
        </div>
      </div>

      <dialog
        ref={ref} onClose={() => setDrawer(false)} onMouseDown={(e) => { if (e.target === ref.current) setDrawer(false); }}
        aria-label="Navigation" className="m-0 h-dvh max-h-dvh w-[min(86vw,300px)] border-r border-line bg-canvas p-0 shadow-pop"
      >
        {drawer && <SidebarContent onNavigate={() => setDrawer(false)} />}
      </dialog>
    </div>
  );
}
