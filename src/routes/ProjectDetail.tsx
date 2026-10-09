import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Archive, ArrowLeft, Building2, Calendar, Pencil, RotateCcw, Plus } from "lucide-react";
import { Board } from "@/components/projects/Board";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { TaskDialog } from "@/components/projects/TaskDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Progress } from "@/components/ui/Progress";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { UpgradeDialog } from "@/features/billing/UpgradeDialog";
import { useClients } from "@/features/clients/hooks";
import { useProject, useUpdateProject } from "@/features/projects/hooks";
import { useCreateTask, useDeleteTask, useProjectTasks, useUpdateTask } from "@/features/tasks/hooks";
import { useMembers } from "@/features/team/hooks";
import { PROJECT_STATUSES } from "@/lib/config";
import { isPlanLimit, toAppError } from "@/lib/errors";
import { formatDate, isOverdue, pluralize } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types";

export default function ProjectDetail() {
  const { id = "" } = useParams();
  const toast = useToast();
  const project = useProject(id);
  const tasks = useProjectTasks(id);
  const members = useMembers();
  const clients = useClients();
  const updateProject = useUpdateProject();
  const createTask = useCreateTask(id);
  const updateTask = useUpdateTask(id);
  const deleteTask = useDeleteTask(id);

  const [editProject, setEditProject] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [upgrade, setUpgrade] = useState(false);
  const [taskDialog, setTaskDialog] = useState<{ task?: Task; status?: TaskStatus } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);

  if (project.isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-6 w-1/3" /><div className="grid gap-4 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-72" />)}</div></div>;
  if (project.error || !project.data) {
    const e = toAppError(project.error);
    return (
      <div className="mx-auto max-w-lg py-16">
        <ErrorState error={project.error} onRetry={e.code === "NOT_FOUND" ? undefined : () => void project.refetch()} />
        <div className="mt-4 text-center"><Link to="/projects" className="text-sm font-medium text-accent hover:underline">← Back to projects</Link></div>
      </div>
    );
  }

  const p = project.data;
  const list = tasks.data ?? [];
  const done = list.filter((t) => t.status === "done").length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;
  const status = PROJECT_STATUSES.find((s) => s.key === p.status)!;
  const client = clients.data?.find((c) => c.id === p.clientId);
  const archived = p.status === "archived";
  const late = isOverdue(p.dueDate, p.status === "completed" || archived);

  async function setProjectStatus(next: typeof p.status, message: string) {
    try { await updateProject.mutateAsync({ id: p.id, patch: { status: next } }); toast.success(message); setConfirmArchive(false); }
    catch (err) { setConfirmArchive(false); if (isPlanLimit(err)) setUpgrade(true); else toast.error(toAppError(err).message); }
  }

  return (
    <>
      <Link to="/projects" className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"><ArrowLeft className="size-3.5" />Projects</Link>

      <header className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-semibold leading-tight">{p.name}</h1>
            <Badge className={status.tone}>{status.label}</Badge>
          </div>
          {p.description && <p className="mt-2 text-[15px] text-ink-2/80">{p.description}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5" aria-hidden />{client ? (client.company || client.name) : "Internal project"}</span>
            <span className={late ? "inline-flex items-center gap-1.5 font-medium text-rose-600" : "inline-flex items-center gap-1.5"}><Calendar className="size-3.5" aria-hidden />{p.dueDate ? `Due ${formatDate(p.dueDate, { month: "short", day: "numeric", year: "numeric" })}` : "No due date"}</span>
            <span className="tabular">{pluralize(list.length, "task")} · {done} done</span>
          </div>
          <div className="mt-4 flex max-w-sm items-center gap-3"><Progress value={pct} label="Project progress" /><span className="text-xs font-semibold tabular text-ink-2">{pct}%</span></div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setEditProject(true)}><Pencil className="size-4" />Edit</Button>
          {archived
            ? <Button variant="secondary" onClick={() => void setProjectStatus("active", "Project restored")}><RotateCcw className="size-4" />Restore</Button>
            : <Button variant="secondary" onClick={() => setConfirmArchive(true)}><Archive className="size-4" />Archive</Button>}
          {!archived && <Button onClick={() => setTaskDialog({ status: "todo" })} data-testid="add-task"><Plus className="size-4" />Add task</Button>}
        </div>
      </header>

      {tasks.isLoading ? <div className="grid gap-4 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-72" />)}</div>
        : tasks.error ? <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
        : <Board tasks={list} members={members.data ?? []} onAdd={(s) => setTaskDialog({ status: s })} onOpen={(t) => setTaskDialog({ task: t })}
            onMove={(taskId, s) => { const t = list.find((x) => x.id === taskId); if (t && t.status !== s) updateTask.mutate({ id: taskId, patch: { status: s, position: Date.now() } }); }} />}

      {taskDialog && (
        <TaskDialog
          key={taskDialog.task?.id ?? `new-${taskDialog.status}`} open onClose={() => setTaskDialog(null)} task={taskDialog.task} defaultStatus={taskDialog.status}
          busy={createTask.isPending || updateTask.isPending}
          onSubmit={(input) => {
            const t = taskDialog.task;
            const done = () => { setTaskDialog(null); toast.success(t ? "Task updated" : "Task added"); };
            if (t) updateTask.mutate({ id: t.id, patch: input }, { onSuccess: done }); else createTask.mutate(input, { onSuccess: done });
          }}
          onDelete={taskDialog.task ? () => { setConfirmDelete(taskDialog.task!); setTaskDialog(null); } : undefined}
        />
      )}
      <ConfirmDialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} destructive confirmLabel="Delete task" loading={deleteTask.isPending}
        title="Delete this task?" description={`"${confirmDelete?.title ?? ""}" will be permanently removed.`}
        onConfirm={() => confirmDelete && deleteTask.mutate(confirmDelete.id, { onSuccess: () => { setConfirmDelete(null); toast.success("Task deleted"); }, onError: () => setConfirmDelete(null) })} />
      <ConfirmDialog open={confirmArchive} onClose={() => setConfirmArchive(false)} confirmLabel="Archive project" loading={updateProject.isPending}
        title="Archive this project?" description="Archived projects are hidden from your active list and stop counting toward your plan limit. You can restore it later."
        onConfirm={() => void setProjectStatus("archived", "Project archived")} />
      {editProject && (
        <ProjectDialog open onClose={() => setEditProject(false)} project={p} busy={updateProject.isPending}
          onSubmit={(input) => updateProject.mutateAsync({ id: p.id, patch: input }).then(() => { setEditProject(false); toast.success("Project updated"); }).catch((err) => toast.error(toAppError(err).message))} />
      )}
      <UpgradeDialog open={upgrade} onClose={() => setUpgrade(false)} reason="projects" />
    </>
  );
}
