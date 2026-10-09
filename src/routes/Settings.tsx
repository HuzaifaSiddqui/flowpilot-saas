import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspaces/WorkspaceProvider";
import { can, ROLE_LABEL } from "@/lib/config";
import { toAppError } from "@/lib/errors";
import { fieldErrors, passwordSchema, workspaceSchema } from "@/lib/validation";
import { api } from "@/services";

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const { workspace, role, refresh } = useWorkspace();
  const toast = useToast();
  const nav = useNavigate();
  const [name, setName] = useState(user?.fullName ?? "");
  const [nameErr, setNameErr] = useState<string>();
  const [wsName, setWsName] = useState(workspace.name);
  const [wsErr, setWsErr] = useState<string>();
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);
  const [danger, setDanger] = useState<"delete" | "leave" | null>(null);
  const [confirmText, setConfirmText] = useState("");

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try { await fn(); } catch (err) { toast.error(toAppError(err).message); } finally { setBusy(null); }
  }

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { setNameErr("Enter your name"); return; }
    setNameErr(undefined);
    void run("profile", async () => { setUser(await api.auth.updateProfile(name.trim())); await refresh(); toast.success("Profile saved"); });
  };
  const saveWorkspace = (e: FormEvent) => {
    e.preventDefault();
    const parsed = workspaceSchema.safeParse({ name: wsName });
    if (!parsed.success) { setWsErr(fieldErrors(parsed.error).name); return; }
    setWsErr(undefined);
    void run("ws", async () => { await api.workspaces.rename(workspace.id, parsed.data.name); await refresh(); toast.success("Workspace updated"); });
  };
  const savePassword = (e: FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(pw);
    if (!parsed.success) { setPwErr(parsed.error.issues[0].message); return; }
    setPwErr(undefined);
    void run("pw", async () => { await api.auth.updatePassword(pw); setPw(""); toast.success("Password updated"); });
  };
  const confirmDanger = () => void run("danger", async () => {
    if (danger === "delete") await api.workspaces.remove(workspace.id); else await api.members.remove(workspace.id, user!.id);
    setDanger(null); await refresh(); toast.success(danger === "delete" ? "Workspace deleted" : "You left the workspace"); nav("/dashboard");
  });

  return (
    <>
      <PageHeader title="Settings" description="Your profile and this workspace's preferences." />
      <div className="max-w-2xl space-y-5">
        <Card>
          <CardHeader title="Profile" description="How you appear to teammates." />
          <form onSubmit={saveProfile} className="space-y-4 p-5" noValidate>
            <Field label="Full name" error={nameErr}>{(id, d) => <Input id={id} aria-describedby={d} value={name} onChange={(e) => setName(e.target.value)} invalid={Boolean(nameErr)} />}</Field>
            <Field label="Email" hint="Your sign-in address.">{(id) => <Input id={id} value={user?.email ?? ""} readOnly disabled />}</Field>
            <Button type="submit" loading={busy === "profile"}>Save profile</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Workspace" description={`You are the ${ROLE_LABEL[role].toLowerCase()} of this workspace.`} />
          <form onSubmit={saveWorkspace} className="space-y-4 p-5" noValidate>
            <Field label="Workspace name" error={wsErr}>{(id, d) => <Input id={id} aria-describedby={d} value={wsName} onChange={(e) => setWsName(e.target.value)} disabled={!can.renameWorkspace(role)} invalid={Boolean(wsErr)} />}</Field>
            {can.renameWorkspace(role) ? <Button type="submit" loading={busy === "ws"}>Save workspace</Button> : <p className="text-sm text-muted">Only owners and admins can rename the workspace.</p>}
          </form>
        </Card>

        <Card>
          <CardHeader title="Password" description="Use a long, unique password." />
          <form onSubmit={savePassword} className="space-y-4 p-5" noValidate>
            <Field label="New password" error={pwErr} hint="At least 8 characters, with a letter and a number.">{(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} invalid={Boolean(pwErr)} />}</Field>
            <Button type="submit" variant="secondary" loading={busy === "pw"}>Update password</Button>
          </form>
        </Card>

        <Card className="border-rose-200">
          <CardHeader title="Danger zone" description="These actions can't be undone." />
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            {can.deleteWorkspace(role)
              ? <><p className="max-w-sm text-sm text-ink-2">Permanently delete <strong>{workspace.name}</strong> with all its clients, projects, tasks and billing.</p><Button variant="danger" onClick={() => { setConfirmText(""); setDanger("delete"); }}>Delete workspace</Button></>
              : <><p className="max-w-sm text-sm text-ink-2">Leave <strong>{workspace.name}</strong>. You'll lose access to its projects and clients.</p><Button variant="danger" onClick={() => setDanger("leave")}>Leave workspace</Button></>}
          </div>
        </Card>
      </div>

      <Dialog open={danger !== null} onClose={() => setDanger(null)} title={danger === "delete" ? "Delete workspace?" : "Leave workspace?"} description={danger === "delete" ? `Type "${workspace.name}" to confirm. This permanently deletes all of its data.` : "You can be re-invited by an owner or admin."}>
        {danger === "delete" && <div className="mb-5"><Input aria-label="Type the workspace name to confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={workspace.name} /></div>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDanger(null)}>Cancel</Button>
          <Button variant="danger" loading={busy === "danger"} disabled={danger === "delete" && confirmText !== workspace.name} onClick={confirmDanger}>{danger === "delete" ? "Delete forever" : "Leave"}</Button>
        </div>
      </Dialog>
    </>
  );
}
