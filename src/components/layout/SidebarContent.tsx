import { NavLink, Link } from "react-router-dom";
import { CreditCard, FolderKanban, LayoutDashboard, LogOut, Settings, Sparkles, Users, UserSquare2 } from "lucide-react";
import { Logo } from "./Logo";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { Avatar } from "@/components/ui/Avatar";
import { Progress } from "@/components/ui/Progress";
import { useAuth } from "@/features/auth/AuthProvider";
import { useEntitlements } from "@/features/billing/hooks";
import { PLANS } from "@/lib/config";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/clients", label: "Clients", icon: UserSquare2 },
  { to: "/team", label: "Team", icon: Users },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
];

function UsageCard() {
  const { data } = useEntitlements();
  if (!data) return null;
  const plan = PLANS[data.plan];
  const limited = data.maxProjects !== null;
  const pct = limited ? (data.projectsUsed / data.maxProjects!) * 100 : 0;
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold">{plan.name} plan</span>
        {limited && <Link to="/billing" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"><Sparkles className="size-3" aria-hidden />Upgrade</Link>}
      </div>
      {limited ? (
        <>
          <Progress value={pct} className="mt-3" label="Projects used" />
          <p className="mt-2 text-xs text-muted tabular">{data.projectsUsed} of {data.maxProjects} projects used</p>
        </>
      ) : (
        <p className="mt-1.5 text-xs text-muted tabular">Unlimited projects · {data.seatsUsed} of {data.maxSeats} seats</p>
      )}
    </div>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  return (
    <div className="flex h-full flex-col gap-5 p-4">
      <Link to="/dashboard" onClick={onNavigate} className="px-1.5 pt-1"><Logo /></Link>
      <WorkspaceSwitcher onNavigate={onNavigate} />
      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to} to={to} onClick={onNavigate}
            className={({ isActive }) => cn(
              "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-ink text-white shadow-card" : "text-ink-2 hover:bg-sunken",
            )}
          >
            <Icon className="size-[18px]" aria-hidden />{label}
          </NavLink>
        ))}
      </nav>
      <UsageCard />
      {user && (
        <div className="flex items-center gap-2.5 border-t border-line pt-4">
          <Avatar name={user.fullName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight">{user.fullName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <button onClick={() => void signOut()} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-muted hover:bg-sunken hover:text-ink"><LogOut className="size-4" /></button>
        </div>
      )}
    </div>
  );
}
