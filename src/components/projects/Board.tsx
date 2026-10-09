import { useState } from "react";
import { Calendar, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/config";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import type { Member, Task, TaskStatus } from "@/types";

function TaskCard({ task, assignee, onOpen, onDragStart, dragging }: { task: Task; assignee?: Member; onOpen: () => void; onDragStart: (e: React.DragEvent) => void; dragging: boolean }) {
  const priority = TASK_PRIORITIES.find((p) => p.key === task.priority)!;
  const late = isOverdue(task.dueDate, task.status === "done");
  return (
    <button
      draggable onDragStart={onDragStart} onClick={onOpen} data-testid="task-card" aria-label={`Task: ${task.title}. Open to edit or change status.`}
      className={cn(
        "block w-full cursor-grab rounded-xl border border-line bg-surface p-3.5 text-left shadow-card transition-all duration-150 active:cursor-grabbing",
        "hover:border-line-strong hover:shadow-pop hover:-translate-y-px", dragging && "opacity-40",
      )}
    >
      <p className={cn("text-sm font-medium leading-snug", task.status === "done" && "text-muted line-through decoration-stone-300")}>{task.title}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge className={priority.tone}>{priority.label}</Badge>
          {task.dueDate && (
            <span className={cn("inline-flex items-center gap-1 text-xs", late ? "font-medium text-rose-600" : "text-muted")}>
              <Calendar className="size-3" aria-hidden />{formatDate(task.dueDate)}
            </span>
          )}
        </div>
        {assignee ? <Avatar name={assignee.fullName} size="sm" /> : <span className="size-6 rounded-full border border-dashed border-line-strong" aria-label="Unassigned" />}
      </div>
    </button>
  );
}

interface BoardProps {
  tasks: Task[];
  members: Member[];
  onMove: (taskId: string, status: TaskStatus) => void;
  onOpen: (task: Task) => void;
  onAdd: (status: TaskStatus) => void;
}

/** Four-column kanban. Cards drag between columns; every card also opens an editor with a status select (keyboard-friendly). */
export function Board({ tasks, members, onMove, onOpen, onAdd }: BoardProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const byId = new Map(members.map((m) => [m.userId, m]));

  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8 xl:mx-0 xl:grid xl:grid-cols-4 xl:overflow-visible xl:px-0" data-testid="board">
      {TASK_STATUSES.map((col) => {
        const items = tasks.filter((t) => t.status === col.key);
        return (
          <section
            key={col.key} aria-label={`${col.label}, ${items.length} tasks`} data-testid={`col-${col.key}`}
            onDragOver={(e) => { e.preventDefault(); setOver(col.key); }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragId; if (id) onMove(id, col.key); setDragId(null); setOver(null); }}
            className={cn("flex w-[290px] shrink-0 snap-start flex-col rounded-2xl bg-sunken/70 p-2.5 transition-colors xl:w-auto", over === col.key && "bg-indigo-50 ring-2 ring-indigo-200")}
          >
            <header className="flex items-center justify-between px-2 pb-3 pt-1.5">
              <h3 className="flex items-center gap-2 text-[13px] font-semibold"><span className={cn("size-2 rounded-full", col.dot)} aria-hidden />{col.label}<span className="font-medium text-faint tabular">{items.length}</span></h3>
              <button onClick={() => onAdd(col.key)} aria-label={`Add task to ${col.label}`} className="rounded-md p-1 text-muted hover:bg-white hover:text-ink"><Plus className="size-4" /></button>
            </header>
            <div className="flex min-h-24 flex-1 flex-col gap-2.5">
              {items.map((t) => (
                <TaskCard key={t.id} task={t} assignee={t.assignedTo ? byId.get(t.assignedTo) : undefined} dragging={dragId === t.id}
                  onOpen={() => onOpen(t)} onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; setDragId(t.id); }} />
              ))}
              {items.length === 0 && <p className="rounded-xl border border-dashed border-line-strong px-3 py-6 text-center text-xs text-faint">Drop tasks here</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
