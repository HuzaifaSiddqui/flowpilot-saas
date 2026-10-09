import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { LogoMark } from "@/components/layout/Logo";
import { api } from "@/services";
import { workspaceSchema, fieldErrors } from "@/lib/validation";
import { toAppError } from "@/lib/errors";

/** Shown when a user belongs to no workspace (e.g. they were removed from their last one). */
export function NoWorkspace() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = workspaceSchema.safeParse({ name });
    if (!parsed.success) { setError(fieldErrors(parsed.error).name); return; }
    setBusy(true);
    try { await api.workspaces.create(parsed.data.name); await qc.invalidateQueries({ queryKey: ["workspaces"] }); }
    catch (err) { setError(toAppError(err).message); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <LogoMark />
      <div><h1 className="text-2xl font-semibold">Create your workspace</h1><p className="mt-1 text-sm text-muted">You're not part of a workspace yet. Start one to begin.</p></div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Workspace name" error={error}>{(id, d) => <Input id={id} aria-describedby={d} value={name} onChange={(e) => setName(e.target.value)} invalid={Boolean(error)} />}</Field>
        <Button type="submit" className="w-full" loading={busy}>Create workspace</Button>
      </form>
    </div>
  );
}
