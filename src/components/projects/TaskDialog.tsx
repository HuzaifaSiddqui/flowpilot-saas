import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { useMembers } from "@/features/team/hooks";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/config";
import { fieldErrors, taskSchema } from "@/lib/validation";
import type { TaskInput } from "@/services/api";
import type { Task, TaskStatus } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  task?: Task;
  defaultStatus?: TaskStatus;
  busy?: boolean;
  onSubmit: (input: TaskInput) => void;
  onDelete?: () => void;
}

export function TaskDialog({ open, onClose, task, defaultStatus = "todo", busy, onSubmit, onDelete }: Props) {
  const members = useMembers();
  const [form, setForm] = useState({
    title: task?.title ?? "", status: task?.status ?? defaultStatus, priority: task?.priority ?? "medium",
    assignedTo: task?.assignedTo ?? "", dueDate: task?.dueDate ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = taskSchema.safeParse(form);
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    setErrors({});
    onSubmit(parsed.data);
  }

  return (
    <Dialog open={open} onClose={onClose} title={task ? "Edit task" : "New task"}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Title" error={errors.title}>{(id, d) => <Input id={id} aria-describedby={d} value={form.title} onChange={set("title")} placeholder="What needs to be done?" autoFocus invalid={Boolean(errors.title)} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">{(id) => <Select id={id} value={form.status} onChange={set("status")}>{TASK_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>}</Field>
          <Field label="Priority">{(id) => <Select id={id} value={form.priority} onChange={set("priority")}>{TASK_PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</Select>}</Field>
          <Field label="Assignee">{(id) => <Select id={id} value={form.assignedTo} onChange={set("assignedTo")}><option value="">Unassigned</option>{(members.data ?? []).map((m) => <option key={m.userId} value={m.userId}>{m.fullName}</option>)}</Select>}</Field>
          <Field label="Due date">{(id) => <Input id={id} type="date" value={form.dueDate} onChange={set("dueDate")} />}</Field>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          {onDelete ? <Button variant="ghost" onClick={onDelete} className="text-rose-600 hover:bg-rose-50"><Trash2 className="size-4" />Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={busy}>{task ? "Save" : "Add task"}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
