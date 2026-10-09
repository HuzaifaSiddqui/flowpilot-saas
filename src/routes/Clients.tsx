import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, Pencil, Plus, Search, Trash2, UserSquare2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useClients, useCreateClient, useDeleteClient, useUpdateClient } from "@/features/clients/hooks";
import { useProjects } from "@/features/projects/hooks";
import { useWorkspace } from "@/features/workspaces/WorkspaceProvider";
import { can } from "@/lib/config";
import { clientSchema, fieldErrors } from "@/lib/validation";
import { pluralize } from "@/lib/utils";
import type { ClientInput } from "@/services/api";
import type { Client } from "@/types";

function ClientDialog({ client, onClose, onSubmit, busy }: { client?: Client; onClose: () => void; onSubmit: (i: ClientInput) => void; busy: boolean }) {
  const [form, setForm] = useState({ name: client?.name ?? "", email: client?.email ?? "", company: client?.company ?? "", notes: client?.notes ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = clientSchema.safeParse(form);
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    onSubmit(parsed.data);
  }
  return (
    <Dialog open onClose={onClose} title={client ? "Edit client" : "Add client"}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact name" error={errors.name}>{(id, d) => <Input id={id} aria-describedby={d} value={form.name} onChange={set("name")} autoFocus invalid={Boolean(errors.name)} />}</Field>
          <Field label="Company" error={errors.company}>{(id) => <Input id={id} value={form.company} onChange={set("company")} />}</Field>
        </div>
        <Field label="Email" error={errors.email}>{(id, d) => <Input id={id} aria-describedby={d} type="email" value={form.email} onChange={set("email")} invalid={Boolean(errors.email)} />}</Field>
        <Field label="Notes" error={errors.notes}>{(id) => <Textarea id={id} value={form.notes} onChange={set("notes")} placeholder="Preferences, billing details, anything useful" />}</Field>
        <div className="flex justify-end gap-2 pt-1"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>{client ? "Save changes" : "Add client"}</Button></div>
      </form>
    </Dialog>
  );
}

export default function Clients() {
  const { role } = useWorkspace();
  const clients = useClients();
  const projects = useProjects();
  const create = useCreateClient();
  const update = useUpdateClient();
  const remove = useDeleteClient();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ client?: Client } | null>(null);
  const [toDelete, setToDelete] = useState<Client | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    (projects.data ?? []).filter((p) => p.status !== "archived").forEach((p) => p.clientId && m.set(p.clientId, (m.get(p.clientId) ?? 0) + 1));
    return m;
  }, [projects.data]);
  const q = query.toLowerCase();
  const visible = (clients.data ?? []).filter((c) => [c.name, c.company, c.email].some((v) => v?.toLowerCase().includes(q)));

  return (
    <>
      <PageHeader title="Clients" description="Everyone you do work for, and the projects tied to them." actions={<Button onClick={() => setDialog({})}><Plus className="size-4" />Add client</Button>} />
      <div className="relative mb-5 w-full sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <Input aria-label="Search clients" placeholder="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>

      {clients.isLoading ? <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[72px]" />)}</div>
        : clients.error ? <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />
        : visible.length === 0 ? <EmptyState icon={UserSquare2} title={query ? "No matching clients" : "No clients yet"} description={query ? "Try a different search." : "Add your first client to link them to projects."} action={!query && <Button onClick={() => setDialog({})}><Plus className="size-4" />Add client</Button>} />
        : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {visible.map((c) => {
                const n = counts.get(c.id) ?? 0;
                return (
                  <li key={c.id} className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-sunken/50">
                    <Avatar name={c.company || c.name} size="lg" />
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-[15px] font-semibold">{c.company || c.name}</p>
                      <p className="truncate text-[13px] text-muted">{c.company ? c.name : "Individual client"}</p>
                    </div>
                    {c.email && <a href={`mailto:${c.email}`} className="hidden items-center gap-1.5 text-[13px] text-ink-2 hover:text-accent md:inline-flex"><Mail className="size-3.5" aria-hidden />{c.email}</a>}
                    <Link to="/projects" className="rounded-full bg-sunken px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-line">{pluralize(n, "active project")}</Link>
                    <div className="flex gap-1 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => setDialog({ client: c })}><Pencil className="size-4" /></Button>
                      {can.deleteClients(role) && <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={() => setToDelete(c)}><Trash2 className="size-4" /></Button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

      {dialog && (
        <ClientDialog client={dialog.client} onClose={() => setDialog(null)} busy={create.isPending || update.isPending}
          onSubmit={(input) => {
            const done = () => { setDialog(null); toast.success(dialog.client ? "Client updated" : "Client added"); };
            if (dialog.client) update.mutate({ id: dialog.client.id, input }, { onSuccess: done }); else create.mutate(input, { onSuccess: done });
          }} />
      )}
      <ConfirmDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} destructive confirmLabel="Delete client" loading={remove.isPending}
        title={`Delete ${toDelete?.company || toDelete?.name || "client"}?`} description="Their projects stay, but are no longer linked to this client."
        onConfirm={() => toDelete && remove.mutate(toDelete.id, { onSuccess: () => { setToDelete(null); toast.success("Client deleted"); }, onError: () => setToDelete(null) })} />
    </>
  );
}
