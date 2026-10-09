import { useState, type FormEvent } from "react";
import { Check, Mail, Minus, Plus, ShieldCheck, UserMinus, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { Progress } from "@/components/ui/Progress";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/AuthProvider";
import { UpgradeDialog } from "@/features/billing/UpgradeDialog";
import { useEntitlements } from "@/features/billing/hooks";
import { useChangeRole, useInvitations, useInvite, useMembers, useRemoveMember, useRevokeInvitation } from "@/features/team/hooks";
import { useWorkspace } from "@/features/workspaces/WorkspaceProvider";
import { can, ROLE_LABEL } from "@/lib/config";
import { isPlanLimit, toAppError } from "@/lib/errors";
import { fieldErrors, inviteSchema } from "@/lib/validation";
import { cn, formatDate } from "@/lib/utils";
import type { Member, Role } from "@/types";

const roleTone: Record<Role, string> = { owner: "bg-indigo-50 text-indigo-700", admin: "bg-amber-50 text-amber-700", member: "bg-stone-100 text-stone-600" };

const MATRIX: { action: string; owner: boolean | string; admin: boolean | string; member: boolean | string }[] = [
  { action: "Read workspace projects", owner: true, admin: true, member: true },
  { action: "Create and update tasks", owner: true, admin: true, member: true },
  { action: "Manage client records", owner: true, admin: true, member: "Limited" },
  { action: "Invite team members", owner: true, admin: true, member: false },
  { action: "Change team roles", owner: true, admin: false, member: false },
  { action: "Manage subscription", owner: true, admin: false, member: false },
  { action: "Delete workspace", owner: true, admin: false, member: false },
];
const Cell = ({ v }: { v: boolean | string }) => v === true ? <Check className="mx-auto size-4 text-emerald-600" aria-label="Yes" /> : v === false ? <Minus className="mx-auto size-4 text-stone-300" aria-label="No" /> : <span className="text-xs font-medium text-amber-700">{v}</span>;

function InviteDialog({ onClose, onLimit }: { onClose: () => void; onLimit: () => void }) {
  const invite = useInvite();
  const toast = useToast();
  const { role } = useWorkspace();
  const [form, setForm] = useState<{ email: string; role: "admin" | "member" }>({ email: "", role: "member" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = inviteSchema.safeParse(form);
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    setErrors({});
    invite.mutate(parsed.data, {
      onSuccess: () => { toast.success(`Invitation sent to ${parsed.data.email}`); onClose(); },
      onError: (err) => { if (isPlanLimit(err)) { onClose(); onLimit(); } else setErrors({ form: toAppError(err).message }); },
    });
  }
  return (
    <Dialog open onClose={onClose} title="Invite a teammate" description="They'll see the invitation as soon as they sign in with this email.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {errors.form && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{errors.form}</p>}
        <Field label="Email address" error={errors.email}>{(id, d) => <Input id={id} aria-describedby={d} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="teammate@company.com" autoFocus invalid={Boolean(errors.email)} />}</Field>
        <Field label="Role" hint={role === "owner" ? "Admins can invite people and manage clients." : "Only the owner can invite admins."}>
          {(id) => <Select id={id} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "member" })}><option value="member">Member</option>{role === "owner" && <option value="admin">Admin</option>}</Select>}
        </Field>
        <div className="flex justify-end gap-2 pt-1"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={invite.isPending}>Send invitation</Button></div>
      </form>
    </Dialog>
  );
}

export default function Team() {
  const { user } = useAuth();
  const { role } = useWorkspace();
  const members = useMembers();
  const invitations = useInvitations();
  const ent = useEntitlements();
  const changeRole = useChangeRole();
  const removeMember = useRemoveMember();
  const revoke = useRevokeInvitation();
  const toast = useToast();
  const [inviting, setInviting] = useState(false);
  const [upgrade, setUpgrade] = useState(false);
  const [toRemove, setToRemove] = useState<Member | null>(null);

  const canRemove = (m: Member) => m.role !== "owner" && (m.userId === user?.id || (can.inviteMembers(role) && (m.role !== "admin" || role === "owner")));

  return (
    <>
      <PageHeader title="Team" description="People in this workspace and what they can do."
        actions={can.inviteMembers(role) && <Button data-testid="invite" onClick={() => (ent.data && !ent.data.canInvite ? setUpgrade(true) : setInviting(true))}><Plus className="size-4" />Invite member</Button>} />

      {ent.data && (
        <Card className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
          <div className="min-w-48 flex-1">
            <div className="mb-2 flex items-center justify-between text-[13px]"><span className="font-medium">Seats</span><span className="tabular text-muted">{ent.data.seatsUsed} of {ent.data.maxSeats} used</span></div>
            <Progress value={(ent.data.seatsUsed / ent.data.maxSeats) * 100} label="Seats used" />
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Members" description={members.data ? `${members.data.length} in this workspace` : undefined} />
        <div className="px-5 pb-2 pt-3">
          {members.isLoading ? <div className="space-y-3 py-2">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
            : members.error ? <div className="pb-3"><ErrorState error={members.error} onRetry={() => void members.refetch()} /></div>
            : (
              <ul className="divide-y divide-line">
                {(members.data ?? []).map((m) => (
                  <li key={m.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                    <Avatar name={m.fullName} size="lg" />
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="truncate text-sm font-semibold">{m.fullName}{m.userId === user?.id && <span className="ml-2 text-xs font-normal text-faint">you</span>}</p>
                      <p className="truncate text-[13px] text-muted">{m.email ?? `Joined ${formatDate(m.joinedAt, { month: "short", year: "numeric" })}`}</p>
                    </div>
                    {can.changeRoles(role) && m.role !== "owner" ? (
                      <Select aria-label={`Role for ${m.fullName}`} value={m.role} className="h-9 w-32 text-[13px]" disabled={changeRole.isPending}
                        onChange={(e) => changeRole.mutate({ userId: m.userId, role: e.target.value as "admin" | "member" }, { onSuccess: () => toast.success("Role updated") })}>
                        <option value="admin">Admin</option><option value="member">Member</option>
                      </Select>
                    ) : <Badge className={cn("px-2.5 py-1", roleTone[m.role])}>{ROLE_LABEL[m.role]}</Badge>}
                    <div className="w-9">{canRemove(m) && <Button variant="ghost" size="icon" aria-label={m.userId === user?.id ? "Leave workspace" : `Remove ${m.fullName}`} onClick={() => setToRemove(m)}><UserMinus className="size-4" /></Button>}</div>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </Card>

      {can.inviteMembers(role) && (invitations.data?.length ?? 0) > 0 && (
        <Card className="mt-4">
          <CardHeader title="Pending invitations" />
          <ul className="divide-y divide-line px-5 pb-2 pt-2">
            {invitations.data!.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3.5">
                <span className="flex size-8 items-center justify-center rounded-full bg-sunken text-muted"><Mail className="size-4" aria-hidden /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{i.email}</p><p className="text-xs text-muted">{ROLE_LABEL[i.role]} · expires {formatDate(i.expiresAt)}</p></div>
                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(i.id, { onSuccess: () => toast.success("Invitation revoked") })}><X className="size-3.5" />Revoke</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="Roles & permissions" description="Enforced by database policies — not just hidden buttons." action={<ShieldCheck className="size-5 text-emerald-600" aria-hidden />} />
        <div className="overflow-x-auto px-5 pb-4 pt-3">
          <table className="w-full min-w-[460px] text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="pb-2 font-medium">Action</th>{(["owner", "admin", "member"] as Role[]).map((r) => <th key={r} className="w-24 pb-2 text-center font-medium">{ROLE_LABEL[r]}</th>)}</tr></thead>
            <tbody>{MATRIX.map((row) => <tr key={row.action} className="border-t border-line"><td className="py-2.5 text-ink-2">{row.action}</td><td className="text-center"><Cell v={row.owner} /></td><td className="text-center"><Cell v={row.admin} /></td><td className="text-center"><Cell v={row.member} /></td></tr>)}</tbody>
          </table>
        </div>
      </Card>

      {inviting && <InviteDialog onClose={() => setInviting(false)} onLimit={() => setUpgrade(true)} />}
      <UpgradeDialog open={upgrade} onClose={() => setUpgrade(false)} reason="seats" />
      <ConfirmDialog open={Boolean(toRemove)} onClose={() => setToRemove(null)} destructive loading={removeMember.isPending}
        confirmLabel={toRemove?.userId === user?.id ? "Leave" : "Remove"} title={toRemove?.userId === user?.id ? "Leave this workspace?" : `Remove ${toRemove?.fullName}?`}
        description={toRemove?.userId === user?.id ? "You'll lose access to its projects and clients." : "They'll lose access immediately. Tasks assigned to them become unassigned."}
        onConfirm={() => toRemove && removeMember.mutate(toRemove.userId, { onSuccess: () => { setToRemove(null); toast.success("Done"); }, onError: () => setToRemove(null) })} />
    </>
  );
}
