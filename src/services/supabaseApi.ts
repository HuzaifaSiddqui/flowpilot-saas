import type { SupabaseClient, User as AuthUser } from "@supabase/supabase-js";
import type {
  Activity, Client, DashboardStats, Entitlements, Invitation, Member, Project, Subscription, Task, TaskStatus, User, Workspace,
} from "@/types";
import { AppError, toAppError } from "@/lib/errors";
import { isoDate, isOverdue } from "@/lib/utils";
import type { Api } from "./api";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const toUser = (u: AuthUser, fullName?: string): User => ({
  id: u.id, email: u.email ?? "", fullName: fullName ?? (u.user_metadata?.full_name as string | undefined) ?? (u.email ?? "").split("@")[0],
});
const mapClient = (r: Row): Client => ({ id: r.id, workspaceId: r.workspace_id, name: r.name, email: r.email, company: r.company, notes: r.notes, createdAt: r.created_at });
const mapProject = (r: Row): Project => ({ id: r.id, workspaceId: r.workspace_id, clientId: r.client_id, name: r.name, description: r.description, status: r.status, dueDate: r.due_date, createdAt: r.created_at, updatedAt: r.updated_at });
const mapTask = (r: Row): Task => ({ id: r.id, workspaceId: r.workspace_id, projectId: r.project_id, title: r.title, description: r.description, status: r.status, priority: r.priority, dueDate: r.due_date, assignedTo: r.assigned_to, position: r.position, createdAt: r.created_at });
const mapInvitation = (r: Row): Invitation => ({ id: r.id, workspaceId: r.workspace_id, email: r.email, role: r.role, createdAt: r.created_at, expiresAt: r.expires_at, workspaceName: r.workspaces?.name });

/** Unwrap a Supabase response, converting any error into a typed AppError. */
function ok<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw toAppError(res.error);
  return res.data as T;
}
const missing = () => new AppError("NOT_FOUND", "We couldn't find what you were looking for.");

export function createSupabaseApi(sb: SupabaseClient): Api {
  async function invokeFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const { data, error } = await sb.functions.invoke(name, { body });
    if (error) {
      // FunctionsHttpError carries the response; surface the server's safe message when present
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const payload = await ctx.json().catch(() => null);
        if (payload?.error) throw new AppError(ctx.status === 403 ? "FORBIDDEN" : ctx.status === 401 ? "UNAUTHORIZED" : "UNKNOWN", payload.error, error);
      }
      throw toAppError(error);
    }
    return data as T;
  }

  const api: Api = {
    mode: "supabase",

    auth: {
      async getUser() {
        const { data } = await sb.auth.getUser();
        if (!data.user) return null;
        const p = await sb.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle();
        return toUser(data.user, p.data?.full_name || undefined);
      },
      async signIn(email, password) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new AppError("UNAUTHORIZED", /confirm/i.test(error.message) ? "Please verify your email before signing in." : "Incorrect email or password.", error);
        return toUser(data.user);
      },
      async signUp(fullName, email, password) {
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw new AppError("VALIDATION", error.message, error);
        return { user: data.user ? toUser(data.user, fullName) : null, needsConfirmation: !data.session };
      },
      async signOut() { await sb.auth.signOut(); },
      async resetPassword(email) {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw toAppError(error);
      },
      async updatePassword(password) {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw new AppError("VALIDATION", error.message, error);
      },
      async updateProfile(fullName) {
        const { data } = await sb.auth.getUser();
        if (!data.user) throw new AppError("UNAUTHORIZED", "Your session has expired. Please sign in again.");
        ok(await sb.from("profiles").update({ full_name: fullName }).eq("id", data.user.id));
        return toUser(data.user, fullName);
      },
      onChange(cb) {
        const { data } = sb.auth.onAuthStateChange((_event, session) => { cb(session?.user ? toUser(session.user) : null); });
        return () => data.subscription.unsubscribe();
      },
    },

    workspaces: {
      async list() {
        const rows = ok(await sb.from("workspace_members").select("role, workspaces(id, name, owner_id, created_at)").order("created_at"));
        return (rows as Row[]).filter((r) => r.workspaces).map((r): Workspace => ({
          id: r.workspaces.id, name: r.workspaces.name, ownerId: r.workspaces.owner_id, createdAt: r.workspaces.created_at, role: r.role,
        }));
      },
      async create(name) {
        const id = ok(await sb.rpc("create_workspace", { p_name: name })) as string;
        const list = await api.workspaces.list();
        const ws = list.find((w) => w.id === id);
        if (!ws) throw missing();
        return ws;
      },
      async rename(id, name) { ok(await sb.from("workspaces").update({ name }).eq("id", id)); },
      async remove(id) { ok(await sb.from("workspaces").delete().eq("id", id)); },
    },

    members: {
      async list(workspaceId) {
        const rows = ok(await sb.from("workspace_members").select("user_id, role, created_at, profiles(full_name)").eq("workspace_id", workspaceId).order("created_at"));
        return (rows as Row[]).map((r): Member => ({ userId: r.user_id, role: r.role, joinedAt: r.created_at, fullName: r.profiles?.full_name || "Member" }));
      },
      async invitations(workspaceId) {
        return (ok(await sb.from("workspace_invitations").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false })) as Row[]).map(mapInvitation);
      },
      async invite(workspaceId, email, role) { ok(await sb.rpc("invite_member", { p_workspace: workspaceId, p_email: email, p_role: role })); },
      async revokeInvitation(id) { ok(await sb.rpc("revoke_invitation", { p_invitation: id })); },
      async changeRole(workspaceId, userId, role) { ok(await sb.rpc("change_member_role", { p_workspace: workspaceId, p_user: userId, p_role: role })); },
      async remove(workspaceId, userId) { ok(await sb.rpc("remove_member", { p_workspace: workspaceId, p_user: userId })); },
      async myInvitations() {
        const { data } = await sb.auth.getUser();
        const email = data.user?.email?.toLowerCase();
        if (!email) return [];
        return (ok(await sb.from("workspace_invitations").select("*, workspaces(name)").eq("email", email)) as Row[]).map(mapInvitation);
      },
      async acceptInvitation(id) { ok(await sb.rpc("accept_invitation", { p_invitation: id })); },
    },

    clients: {
      async list(workspaceId) { return (ok(await sb.from("clients").select("*").eq("workspace_id", workspaceId).order("name")) as Row[]).map(mapClient); },
      async create(workspaceId, input) { return mapClient(ok(await sb.from("clients").insert({ workspace_id: workspaceId, ...input }).select().single())); },
      async update(id, input) { return mapClient(ok(await sb.from("clients").update({ ...input }).eq("id", id).select().single())); },
      async remove(id) { ok(await sb.from("clients").delete().eq("id", id)); },
    },

    projects: {
      async list(workspaceId) { return (ok(await sb.from("projects").select("*").eq("workspace_id", workspaceId).order("updated_at", { ascending: false })) as Row[]).map(mapProject); },
      async get(id) { const r = ok(await sb.from("projects").select("*").eq("id", id).maybeSingle()); if (!r) throw missing(); return mapProject(r); },
      async create(workspaceId, input) {
        return mapProject(ok(await sb.from("projects").insert({
          workspace_id: workspaceId, name: input.name, description: input.description ?? null, client_id: input.clientId ?? null, due_date: input.dueDate ?? null,
        }).select().single()));
      },
      async update(id, patch) {
        const body: Row = {};
        if (patch.name !== undefined) body.name = patch.name;
        if (patch.description !== undefined) body.description = patch.description;
        if (patch.clientId !== undefined) body.client_id = patch.clientId;
        if (patch.dueDate !== undefined) body.due_date = patch.dueDate;
        if (patch.status !== undefined) body.status = patch.status;
        return mapProject(ok(await sb.from("projects").update(body).eq("id", id).select().single()));
      },
    },

    tasks: {
      async listByProject(projectId) { return (ok(await sb.from("tasks").select("*").eq("project_id", projectId).order("position")) as Row[]).map(mapTask); },
      async listByWorkspace(workspaceId) { return (ok(await sb.from("tasks").select("*").eq("workspace_id", workspaceId).limit(1000)) as Row[]).map(mapTask); },
      async create(workspaceId, projectId, input) {
        return mapTask(ok(await sb.from("tasks").insert({
          workspace_id: workspaceId, project_id: projectId, title: input.title, status: input.status, priority: input.priority,
          assigned_to: input.assignedTo ?? null, due_date: input.dueDate ?? null, position: Date.now() % 2147483647,
        }).select().single()));
      },
      async update(id, patch) {
        const body: Row = {};
        if (patch.title !== undefined) body.title = patch.title;
        if (patch.status !== undefined) body.status = patch.status;
        if (patch.priority !== undefined) body.priority = patch.priority;
        if (patch.assignedTo !== undefined) body.assigned_to = patch.assignedTo;
        if (patch.dueDate !== undefined) body.due_date = patch.dueDate;
        if (patch.position !== undefined) body.position = patch.position;
        return mapTask(ok(await sb.from("tasks").update(body).eq("id", id).select().single()));
      },
      async remove(id) { ok(await sb.from("tasks").delete().eq("id", id)); },
    },

    dashboard: {
      async stats(workspaceId): Promise<DashboardStats> {
        const [tasks, projects, done] = await Promise.all([
          sb.from("tasks").select("status, due_date").eq("workspace_id", workspaceId).limit(5000),
          sb.from("projects").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "active"),
          sb.from("activity_logs").select("created_at").eq("workspace_id", workspaceId).eq("action", "moved to done").gte("created_at", new Date(Date.now() - 8 * 86400000).toISOString()),
        ]);
        const rows = ok(tasks) as Row[];
        const byStatus: Record<TaskStatus, number> = { todo: 0, in_progress: 0, review: 0, done: 0 };
        rows.forEach((t) => { byStatus[t.status as TaskStatus]++; });
        if (projects.error) throw toAppError(projects.error);
        const doneRows = ok(done) as Row[];
        const weekly = Array.from({ length: 7 }, (_, i) => {
          const day = isoDate(i - 6);
          return {
            label: new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" }),
            value: doneRows.filter((r) => isoDate(0, new Date(r.created_at)) === day).length,
          };
        });
        return {
          activeProjects: projects.count ?? 0, openTasks: rows.length - byStatus.done, completedTasks: byStatus.done,
          overdueTasks: rows.filter((t) => isOverdue(t.due_date, t.status === "done")).length,
          completionRate: rows.length ? Math.round((byStatus.done / rows.length) * 100) : 0,
          tasksByStatus: byStatus, weeklyCompleted: weekly,
        };
      },
      async activity(workspaceId, limit = 8): Promise<Activity[]> {
        const rows = ok(await sb.from("activity_logs").select("*, profiles:actor_id(full_name)").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(limit)) as Row[];
        return rows.map((r) => ({
          id: r.id, workspaceId: r.workspace_id, actorId: r.actor_id, actorName: r.profiles?.full_name ?? "Someone",
          action: r.action, entityType: r.entity_type, entityName: r.entity_name, createdAt: r.created_at,
        }));
      },
    },

    billing: {
      async subscription(workspaceId): Promise<Subscription> {
        const r = ok(await sb.from("subscriptions").select("*").eq("workspace_id", workspaceId).maybeSingle()) as Row | null;
        if (!r) return { workspaceId, plan: "free", status: "active", cancelAtPeriodEnd: false, hasCustomer: false };
        return { workspaceId, plan: r.plan, status: r.status, currentPeriodEnd: r.current_period_end, cancelAtPeriodEnd: r.cancel_at_period_end, hasCustomer: Boolean(r.stripe_customer_id) };
      },
      async entitlements(workspaceId): Promise<Entitlements> {
        const r = ok(await sb.rpc("get_entitlements", { p_workspace: workspaceId })) as Row;
        return { plan: r.plan, maxProjects: r.maxProjects, maxSeats: r.maxSeats, projectsUsed: r.projectsUsed, seatsUsed: r.seatsUsed, canCreateProject: r.canCreateProject, canInvite: r.canInvite };
      },
      async startCheckout(workspaceId, plan) { return invokeFn<{ url: string }>("create-checkout", { workspaceId, plan }); },
      async openPortal(workspaceId) { return invokeFn<{ url: string }>("billing-portal", { workspaceId }); },
    },
  };
  return api;
}
