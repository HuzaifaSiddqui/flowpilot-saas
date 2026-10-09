import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/features/workspaces/WorkspaceProvider";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/services";
import { workspaceSchema, fieldErrors } from "@/lib/validation";
import { toAppError, reportError } from "@/lib/errors";
import { cn, initials } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/config";

export function WorkspaceSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { workspace, workspaces, switchWorkspace, refresh } = useWorkspace();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const parsed = workspaceSchema.safeParse({ name });
    if (!parsed.success) { setError(fieldErrors(parsed.error).name); return; }
    setBusy(true);
    try {
      const ws = await api.workspaces.create(parsed.data.name);
      await refresh(); qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "workspaces" });
      switchWorkspace(ws.id); setCreating(false); setName(""); setError(undefined);
      toast.success(`Created "${ws.name}"`); onNavigate?.();
    } catch (err) { reportError(err, "create workspace"); setError(toAppError(err).message); } finally { setBusy(false); }
  }

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label="Switch workspace"
        className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-2.5 py-2 text-left shadow-card transition-colors hover:border-line-strong"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-[11px] font-bold text-accent">{initials(workspace.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight">{workspace.name}</span>
          <span className="block text-xs text-muted">{ROLE_LABEL[workspace.role]}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-faint" aria-hidden />
      </button>

      {open && (
        <div role="listbox" aria-label="Workspaces" className="fp-pop absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-xl border border-line bg-surface p-1.5 shadow-pop">
          {workspaces.map((w) => (
            <button
              key={w.id} role="option" aria-selected={w.id === workspace.id}
              onClick={() => { switchWorkspace(w.id); setOpen(false); onNavigate?.(); }}
              className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-sunken", w.id === workspace.id && "bg-sunken")}
            >
              <span className="flex size-6 items-center justify-center rounded-md bg-accent-soft text-[10px] font-bold text-accent">{initials(w.name)}</span>
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.id === workspace.id && <Check className="size-4 text-accent" aria-hidden />}
            </button>
          ))}
          <div className="my-1.5 border-t border-line" />
          <button onClick={() => { setOpen(false); setCreating(true); }} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-ink-2 hover:bg-sunken">
            <span className="flex size-6 items-center justify-center rounded-md border border-dashed border-line-strong"><Plus className="size-3.5" aria-hidden /></span>
            Create workspace
          </button>
        </div>
      )}

      <Dialog open={creating} onClose={() => { setCreating(false); setError(undefined); }} title="Create workspace" description="Workspaces keep clients, projects and billing separate.">
        <form onSubmit={create} className="space-y-5" noValidate>
          <Field label="Workspace name" error={error}>
            {(id, d) => <Input id={id} aria-describedby={d} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Design Co." autoFocus invalid={Boolean(error)} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Create workspace</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
