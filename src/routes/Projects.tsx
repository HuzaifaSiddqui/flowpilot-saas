import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Calendar, FolderKanban, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Progress } from "@/components/ui/Progress";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { UpgradeDialog } from "@/features/billing/UpgradeDialog";
import { useEntitlements } from "@/features/billing/hooks";
import { useClients } from "@/features/clients/hooks";
import { useCreateProject, useProjects } from "@/features/projects/hooks";
import { useWorkspaceTasks } from "@/features/tasks/hooks";
import { PROJECT_STATUSES } from "@/lib/config";
import { isPlanLimit, toAppError } from "@/lib/errors";
import { cn, formatDate, isOverdue, pluralize } from "@/lib/utils";
import type { ProjectStatus } from "@/types";

type Filter = "all" | ProjectStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "on_hold", label: "On hold" },
  { key: "completed", label: "Completed" }, { key: "archived", label: "Archived" },
];

export default function Projects() {
  const projects = useProjects();
  const clients = useClients();
  const tasks = useWorkspaceTasks();
  const ent = useEntitlements();
  const create = useCreateProject();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState(false);
  const [upgrade, setUpgrade] = useState(false);

  function startNew() {
    if (ent.data && !ent.data.canCreateProject) setUpgrade(true); else setDialog(true);
  }
  useEffect(() => {
    if (params.get("new") === "1" && ent.data) {
      params.delete("new"); setParams(params, { replace: true }); startNew();
    }
  }, [params, ent.data]);

  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.company || c.name])), [clients.data]);
  const progress = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    (tasks.data ?? []).forEach((t) => { const x = m.get(t.projectId) ?? { total: 0, done: 0 }; x.total++; if (t.status === "done") x.done++; m.set(t.projectId, x); });
    return m;
  }, [tasks.data]);

  const visible = (projects.data ?? []).filter((p) =>
    (filter === "all" ? p.status !== "archived" : p.status === filter) &&
    (p.name.toLowerCase().includes(query.toLowerCase()) || (clientName.get(p.clientId ?? "") ?? "").toLowerCase().includes(query.toLowerCase())));
  const counts = (k: Filter) => (projects.data ?? []).filter((p) => (k === "all" ? p.status !== "archived" : p.status === k)).length;

  return (
    <>
      <PageHeader
        title="Projects"
        description={ent.data ? (ent.data.maxProjects === null ? "Unlimited projects on your plan." : `${ent.data.projectsUsed} of ${ent.data.maxProjects} active projects used.`) : undefined}
        actions={<Button onClick={startNew} data-testid="new-project"><Plus className="size-4" />New project</Button>}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Filter projects">
          {FILTERS.map((f) => (
            <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
              className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors", filter === f.key ? "bg-ink text-white" : "text-ink-2 hover:bg-sunken")}>
              {f.label}<span className={cn("ml-1.5 tabular", filter === f.key ? "text-stone-400" : "text-faint")}>{counts(f.key)}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input aria-label="Search projects" placeholder="Search projects" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
      </div>

      {projects.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : projects.error ? (
        <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState icon={FolderKanban} title={query ? "No matching projects" : "No projects here yet"} description={query ? "Try a different search term." : "Create a project to start organising tasks and clients."}
          action={!query && <Button onClick={startNew}><Plus className="size-4" />Create project</Button>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const pr = progress.get(p.id) ?? { total: 0, done: 0 };
            const pct = pr.total ? Math.round((pr.done / pr.total) * 100) : 0;
            const status = PROJECT_STATUSES.find((s) => s.key === p.status)!;
            const late = isOverdue(p.dueDate, p.status === "completed" || p.status === "archived");
            return (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="group block h-full">
                  <Card className="flex h-full flex-col p-5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-line-strong group-hover:shadow-pop">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-[15px] font-semibold">{p.name}</h2>
                        <p className="mt-0.5 truncate text-[13px] text-muted">{clientName.get(p.clientId ?? "") ?? "Internal"}</p>
                      </div>
                      <Badge className={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-3 line-clamp-2 min-h-10 text-[13px] leading-5 text-ink-2/80">{p.description || "No description yet."}</p>
                    <div className="mt-auto pt-5">
                      <div className="mb-2 flex items-center justify-between text-xs text-muted">
                        <span>{pluralize(pr.total, "task")}</span><span className="font-medium tabular text-ink-2">{pct}%</span>
                      </div>
                      <Progress value={pct} label={`${p.name} progress`} />
                      <p className={cn("mt-3.5 flex items-center gap-1.5 text-xs", late ? "font-medium text-rose-600" : "text-muted")}>
                        <Calendar className="size-3.5" aria-hidden />{p.dueDate ? `${late ? "Overdue · " : "Due "}${formatDate(p.dueDate)}` : "No due date"}
                      </p>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <ProjectDialog
        open={dialog} onClose={() => setDialog(false)} busy={create.isPending}
        onSubmit={(input) => create.mutateAsync(input, {}).then((p) => { setDialog(false); toast.success(`Created "${p.name}"`); })
          .catch((err) => { if (isPlanLimit(err)) { setDialog(false); setUpgrade(true); } else toast.error(toAppError(err).message); })}
      />
      <UpgradeDialog open={upgrade} onClose={() => setUpgrade(false)} reason="projects" />
    </>
  );
}
