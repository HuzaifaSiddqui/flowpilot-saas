import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useClients } from "@/features/clients/hooks";
import { fieldErrors, projectSchema } from "@/lib/validation";
import type { ProjectInput } from "@/services/api";
import type { Project } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  project?: Project;
  busy?: boolean;
  onSubmit: (input: ProjectInput) => Promise<void> | void;
}

export function ProjectDialog({ open, onClose, project, busy, onSubmit }: Props) {
  const clients = useClients();
  const [form, setForm] = useState({
    name: project?.name ?? "", description: project?.description ?? "", clientId: project?.clientId ?? "", dueDate: project?.dueDate ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = projectSchema.safeParse(form);
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    setErrors({});
    void onSubmit({ name: parsed.data.name, description: parsed.data.description, clientId: parsed.data.clientId, dueDate: parsed.data.dueDate });
  }

  return (
    <Dialog open={open} onClose={onClose} title={project ? "Edit project" : "New project"} description={project ? undefined : "Projects hold tasks and can be linked to a client."}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Project name" error={errors.name}>
          {(id, d) => <Input id={id} aria-describedby={d} value={form.name} onChange={set("name")} placeholder="e.g. Website redesign" autoFocus invalid={Boolean(errors.name)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client" error={errors.clientId}>
            {(id) => (
              <Select id={id} value={form.clientId} onChange={set("clientId")}>
                <option value="">No client</option>
                {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Due date" error={errors.dueDate}>{(id) => <Input id={id} type="date" value={form.dueDate} onChange={set("dueDate")} />}</Field>
        </div>
        <Field label="Description" error={errors.description}>{(id, d) => <Textarea id={id} aria-describedby={d} value={form.description} onChange={set("description")} placeholder="What is this project about?" />}</Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>{project ? "Save changes" : "Create project"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
