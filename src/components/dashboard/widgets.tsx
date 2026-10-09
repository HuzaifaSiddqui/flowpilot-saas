import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardHeader } from "@/components/ui/Card";
import { TASK_STATUSES } from "@/lib/config";
import { cn, timeAgo } from "@/lib/utils";
import type { Activity, DashboardStats } from "@/types";

export function StatCard({ label, value, hint, icon: Icon, tone = "text-ink" }: { label: string; value: string | number; hint?: string; icon: LucideIcon; tone?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-lg bg-sunken text-muted"><Icon className="size-4" aria-hidden /></span>
      </div>
      <p className={cn("mt-4 text-[34px] font-semibold leading-none tabular", tone)}>{value}</p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

/** Minimal SVG bar chart: tasks completed per day over the last 7 days (derived from the activity log). */
export function WeeklyChart({ data }: { data: DashboardStats["weeklyCompleted"] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0);
  const W = 560, H = 190, padB = 28, padT = 12, gap = 14;
  const bw = (W - gap * (data.length - 1)) / data.length;
  const usable = H - padB - padT;
  return (
    <Card>
      <CardHeader title="Completed this week" description={`${total} task${total === 1 ? "" : "s"} moved to Done in the last 7 days`} />
      <div className="px-5 pb-5 pt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Bar chart of tasks completed per day. ${data.map((d) => `${d.label}: ${d.value}`).join(", ")}`}>
          {[0, 0.5, 1].map((f) => <line key={f} x1="0" x2={W} y1={padT + usable * (1 - f)} y2={padT + usable * (1 - f)} stroke="var(--color-line)" strokeDasharray={f === 0 ? undefined : "3 5"} />)}
          {data.map((d, i) => {
            const h = Math.max(d.value ? 6 : 2, (d.value / max) * usable);
            const x = i * (bw + gap);
            const last = d.value === max && max > 0;   // emphasise the best day
            return (
              <g key={d.label + i}>
                <rect x={x} y={padT + usable - h} width={bw} height={h} rx="6" fill={last ? "var(--color-accent)" : "#c7d2fe"} />
                {d.value > 0 && <text x={x + bw / 2} y={padT + usable - h - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-ink-2)">{d.value}</text>}
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-muted)">{d.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </Card>
  );
}

export function StatusBreakdown({ data, total }: { data: DashboardStats["tasksByStatus"]; total: number }) {
  return (
    <Card>
      <CardHeader title="Task status" description={`${total} tasks across all projects`} />
      <div className="px-5 pb-5 pt-4">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-sunken" role="img" aria-label="Task status distribution">
          {TASK_STATUSES.map((s) => data[s.key] > 0 && <div key={s.key} className={cn(s.dot, "first:rounded-l-full last:rounded-r-full")} style={{ width: `${(data[s.key] / Math.max(1, total)) * 100}%` }} />)}
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3.5">
          {TASK_STATUSES.map((s) => (
            <li key={s.key} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-ink-2"><span className={cn("size-2 rounded-full", s.dot)} aria-hidden />{s.label}</span>
              <span className="font-semibold tabular">{data[s.key]}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function ActivityFeed({ items }: { items: Activity[] }) {
  return (
    <Card>
      <CardHeader title="Recent activity" description="What your team has been up to" />
      <ul className="px-5 pb-3 pt-3">
        {items.length === 0 && <li className="py-8 text-center text-sm text-muted">No activity yet — create a project to get started.</li>}
        {items.map((a) => (
          <li key={a.id} className="flex gap-3 border-b border-line py-3.5 last:border-0">
            <Avatar name={a.actorName} size="sm" className="mt-0.5" />
            <div className="min-w-0 flex-1 text-sm leading-snug">
              <p className="text-ink-2"><span className="font-semibold text-ink">{a.actorName.split(" ")[0]}</span> {a.action} {a.entityType} <span className="font-medium text-ink">{a.entityName}</span></p>
              <p className="mt-0.5 text-xs text-faint">{timeAgo(a.createdAt)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ViewAll({ to, children }: { to: string; children: string }) {
  return <Link to={to} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">{children}<ArrowUpRight className="size-3.5" aria-hidden /></Link>;
}
