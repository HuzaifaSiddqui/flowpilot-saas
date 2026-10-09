import { AlertTriangle, CheckCircle2, FolderKanban, ListChecks, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { ActivityFeed, StatCard, StatusBreakdown, ViewAll, WeeklyChart } from "@/components/dashboard/widgets";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";
import { ErrorState, PageSkeleton } from "@/components/ui/States";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspaces/WorkspaceProvider";
import { useActivity, useDashboardStats } from "@/features/dashboard/hooks";
import { useProjects } from "@/features/projects/hooks";
import { useWorkspaceTasks } from "@/features/tasks/hooks";
import { formatDate } from "@/lib/utils";

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const stats = useDashboardStats();
  const activity = useActivity(7);
  const projects = useProjects();
  const tasks = useWorkspaceTasks();

  if (stats.isLoading) return <><PageHeader title="Dashboard" /><PageSkeleton /></>;
  if (stats.error || !stats.data) return <><PageHeader title="Dashboard" /><ErrorState error={stats.error} onRetry={() => void stats.refetch()} /></>;
  const s = stats.data;
  const totalTasks = s.openTasks + s.completedTasks;

  const live = (projects.data ?? []).filter((p) => p.status === "active").slice(0, 4).map((p) => {
    const list = (tasks.data ?? []).filter((t) => t.projectId === p.id);
    const done = list.filter((t) => t.status === "done").length;
    return { p, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
  });

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.fullName.split(" ")[0] ?? "there"}`}
        description={<>Here's where things stand in <span className="font-medium text-ink-2">{workspace.name}</span>.</>}
        actions={<Link to="/projects?new=1"><Button><Plus className="size-4" />New project</Button></Link>}
      />

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Active projects" value={s.activeProjects} icon={FolderKanban} hint="Currently in progress" />
        <StatCard label="Open tasks" value={s.openTasks} icon={ListChecks} hint={`${s.completedTasks} completed`} />
        <StatCard label="Overdue" value={s.overdueTasks} icon={AlertTriangle} tone={s.overdueTasks ? "text-rose-600" : "text-ink"} hint={s.overdueTasks ? "Needs attention" : "All on schedule"} />
        <StatCard label="Completion" value={`${s.completionRate}%`} icon={CheckCircle2} tone="text-accent" hint="Of all tasks" />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <WeeklyChart data={s.weeklyCompleted} />
          <Card>
            <CardHeader title="Projects in flight" action={<ViewAll to="/projects">View all</ViewAll>} />
            <ul className="divide-y divide-line px-5 pb-2 pt-2">
              {live.length === 0 && <li className="py-8 text-center text-sm text-muted">No active projects yet.</li>}
              {live.map(({ p, total, pct }) => (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-3.5 transition-colors hover:bg-sunken/70">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="mt-0.5 text-xs text-muted">{total} tasks{p.dueDate ? ` · due ${formatDate(p.dueDate)}` : ""}</p>
                    </div>
                    <div className="hidden w-32 sm:block"><Progress value={pct} label={`${p.name} progress`} /></div>
                    <Badge className="w-12 justify-center bg-sunken text-ink-2 tabular">{pct}%</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="space-y-4">
          <StatusBreakdown data={s.tasksByStatus} total={totalTasks} />
          <ActivityFeed items={activity.data ?? []} />
        </div>
      </div>
    </>
  );
}
