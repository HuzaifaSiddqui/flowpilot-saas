import type {
  Activity, Client, DashboardStats, Entitlements, Member, Project, Role, Subscription, Task, TaskStatus, User, Workspace,
} from "@/types";
import { PLANS } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { isoDate, isOverdue } from "@/lib/utils";
import type { Api } from "./api";
import { createSeed, type DemoDb, type DemoUser } from "./demoSeed";

const STORAGE_KEY = "flowpilot-demo-v1";
const listeners = new Set<(u: User | null) => void>();

function load(): DemoDb {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) return JSON.parse(raw) as DemoDb;
  } catch { /* corrupted storage → reseed */ }
  return createSeed();
}

let db: DemoDb = load();
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* storage unavailable */ } };
const uid = (prefix: string) => `${prefix}-${++db.seq}`;
const now = () => new Date().toISOString();
const toUser = (u: DemoUser): User => ({ id: u.id, email: u.email, fullName: u.fullName });

export function resetDemo(): void { db = createSeed(); save(); listeners.forEach((l) => l(null)); }
/** Test hook: replace the whole database. */
export function __setDemoDb(next: DemoDb): void { db = next; }

// ── guards: mirror what RLS + RPCs enforce in Postgres ─────────────────────
function me(): DemoUser {
  const u = db.users.find((x) => x.id === db.sessionUserId);
  if (!u) throw new AppError("UNAUTHORIZED", "Your session has expired. Please sign in again.");
  return u;
}
const roleIn = (workspaceId: string): Role | null => db.members.find((m) => m.workspaceId === workspaceId && m.userId === me().id)?.role ?? null;
function assertMember(workspaceId: string): Role {
  const r = roleIn(workspaceId);
  if (!r) throw new AppError("NOT_FOUND", "We couldn't find what you were looking for."); // RLS returns no rows, not "forbidden"
  return r;
}
function assertAdmin(workspaceId: string): Role {
  const r = assertMember(workspaceId);
  if (r === "member") throw new AppError("FORBIDDEN", "You don't have permission to do that.");
  return r;
}
function assertOwner(workspaceId: string): void {
  if (assertMember(workspaceId) !== "owner") throw new AppError("FORBIDDEN", "You don't have permission to do that.");
}
const sub = (workspaceId: string): Subscription =>
  db.subscriptions.find((s) => s.workspaceId === workspaceId) ?? { workspaceId, plan: "free", status: "active", cancelAtPeriodEnd: false, hasCustomer: false };
const effectivePlan = (workspaceId: string) => { const s = sub(workspaceId); return s.status === "active" || s.status === "trialing" ? s.plan : "free"; };
const log = (workspaceId: string, action: string, entityType: string, entityName: string) =>
  db.activity.unshift({ id: uid("a"), workspaceId, actorId: me().id, actorName: me().fullName, action, entityType, entityName, createdAt: now() });

function entitlements(workspaceId: string): Entitlements {
  assertMember(workspaceId);
  const plan = effectivePlan(workspaceId);
  const cfg = PLANS[plan];
  const projectsUsed = db.projects.filter((p) => p.workspaceId === workspaceId && p.status !== "archived").length;
  const seatsUsed = db.members.filter((m) => m.workspaceId === workspaceId).length + db.invitations.filter((i) => i.workspaceId === workspaceId).length;
  return {
    plan, maxProjects: cfg.maxProjects, maxSeats: cfg.maxSeats, projectsUsed, seatsUsed,
    canCreateProject: cfg.maxProjects === null || projectsUsed < cfg.maxProjects,
    canInvite: seatsUsed < cfg.maxSeats,
  };
}

function ensureProjectSlot(workspaceId: string) {
  if (!entitlements(workspaceId).canCreateProject) throw new AppError("PLAN_LIMIT_PROJECTS", "You've reached the project limit for your plan. Upgrade to add more.");
}

const clone = <T,>(v: T): T => structuredClone(v);

export const demoApi: Api = {
  mode: "demo",

  auth: {
    async getUser() { const u = db.users.find((x) => x.id === db.sessionUserId); return u ? toUser(u) : null; },
    async signIn(email, password) {
      const u = db.users.find((x) => x.email === email.trim().toLowerCase());
      if (!u || u.password !== password) throw new AppError("UNAUTHORIZED", "Incorrect email or password.");
      db.sessionUserId = u.id; save(); listeners.forEach((l) => l(toUser(u)));
      return toUser(u);
    },
    async signUp(fullName, email, password) {
      const e = email.trim().toLowerCase();
      if (db.users.some((x) => x.email === e)) throw new AppError("VALIDATION", "An account with this email already exists.");
      const u: DemoUser = { id: uid("u"), email: e, fullName: fullName.trim(), password };
      db.users.push(u);
      const wsId = uid("ws");
      db.workspaces.push({ id: wsId, name: `${u.fullName.split(" ")[0]}'s workspace`, ownerId: u.id, createdAt: now() });
      db.members.push({ workspaceId: wsId, userId: u.id, fullName: u.fullName, email: u.email, role: "owner", joinedAt: now() });
      db.subscriptions.push({ workspaceId: wsId, plan: "free", status: "active", cancelAtPeriodEnd: false, hasCustomer: false });
      db.sessionUserId = u.id; save(); listeners.forEach((l) => l(toUser(u)));
      return { user: toUser(u), needsConfirmation: false };
    },
    async signOut() { db.sessionUserId = null; save(); listeners.forEach((l) => l(null)); },
    async resetPassword() { /* demo: pretend the email was sent */ },
    async updatePassword(password) { me().password = password; save(); },
    async updateProfile(fullName) {
      const u = me(); u.fullName = fullName.trim();
      db.members.filter((m) => m.userId === u.id).forEach((m) => { m.fullName = u.fullName; });
      save(); return toUser(u);
    },
    onChange(cb) { listeners.add(cb); return () => { listeners.delete(cb); }; },
  },

  workspaces: {
    async list() {
      const u = me();
      return clone(db.members.filter((m) => m.userId === u.id).map((m) => {
        const w = db.workspaces.find((x) => x.id === m.workspaceId)!;
        return { ...w, role: m.role } as Workspace;
      }));
    },
    async create(name) {
      const u = me();
      const w = { id: uid("ws"), name: name.trim(), ownerId: u.id, createdAt: now() };
      db.workspaces.push(w);
      db.members.push({ workspaceId: w.id, userId: u.id, fullName: u.fullName, email: u.email, role: "owner", joinedAt: now() });
      db.subscriptions.push({ workspaceId: w.id, plan: "free", status: "active", cancelAtPeriodEnd: false, hasCustomer: false });
      save(); return { ...w, role: "owner" };
    },
    async rename(id, name) { assertAdmin(id); db.workspaces.find((w) => w.id === id)!.name = name.trim(); save(); },
    async remove(id) {
      assertOwner(id);
      const keep = <T extends { workspaceId: string }>(a: T[]) => a.filter((x) => x.workspaceId !== id);
      db.workspaces = db.workspaces.filter((w) => w.id !== id);
      db.members = keep(db.members); db.projects = keep(db.projects); db.tasks = keep(db.tasks); db.clients = keep(db.clients);
      db.invitations = keep(db.invitations); db.activity = keep(db.activity); db.subscriptions = keep(db.subscriptions);
      save();
    },
  },

  members: {
    async list(workspaceId) { assertMember(workspaceId); return clone(db.members.filter((m) => m.workspaceId === workspaceId) as Member[]); },
    async invitations(workspaceId) { assertAdmin(workspaceId); return clone(db.invitations.filter((i) => i.workspaceId === workspaceId)); },
    async invite(workspaceId, email, role) {
      const r = assertAdmin(workspaceId);
      if (role === "admin" && r !== "owner") throw new AppError("FORBIDDEN", "Only the owner can invite admins.");
      if (!entitlements(workspaceId).canInvite) throw new AppError("PLAN_LIMIT_SEATS", "You've used every seat on your plan. Upgrade to invite more people.");
      const e = email.trim().toLowerCase();
      db.invitations = db.invitations.filter((i) => !(i.workspaceId === workspaceId && i.email === e));
      db.invitations.push({ id: uid("inv"), workspaceId, email: e, role, createdAt: now(), expiresAt: new Date(Date.now() + 14 * 86400000).toISOString() });
      save();
    },
    async revokeInvitation(id) {
      const inv = db.invitations.find((i) => i.id === id);
      if (!inv) throw new AppError("NOT_FOUND", "We couldn't find what you were looking for.");
      assertAdmin(inv.workspaceId); db.invitations = db.invitations.filter((i) => i.id !== id); save();
    },
    async changeRole(workspaceId, userId, role) {
      assertOwner(workspaceId);
      const m = db.members.find((x) => x.workspaceId === workspaceId && x.userId === userId);
      if (!m) throw new AppError("NOT_FOUND", "We couldn't find what you were looking for.");
      if (m.role === "owner") throw new AppError("FORBIDDEN", "You can't change the owner's role.");
      m.role = role; save();
    },
    async remove(workspaceId, userId) {
      const actor = assertMember(workspaceId);
      const m = db.members.find((x) => x.workspaceId === workspaceId && x.userId === userId);
      if (!m) throw new AppError("NOT_FOUND", "We couldn't find what you were looking for.");
      if (m.role === "owner") throw new AppError("FORBIDDEN", "The owner can't be removed.");
      const self = userId === me().id;
      if (!self && actor === "member") throw new AppError("FORBIDDEN", "You don't have permission to do that.");
      if (!self && m.role === "admin" && actor !== "owner") throw new AppError("FORBIDDEN", "Only the owner can remove admins.");
      db.members = db.members.filter((x) => x !== m);
      db.tasks.filter((t) => t.workspaceId === workspaceId && t.assignedTo === userId).forEach((t) => { t.assignedTo = null; });
      save();
    },
    async myInvitations() {
      const email = me().email;
      return clone(db.invitations.filter((i) => i.email === email).map((i) => ({ ...i, workspaceName: db.workspaces.find((w) => w.id === i.workspaceId)?.name })));
    },
    async acceptInvitation(id) {
      const u = me();
      const inv = db.invitations.find((i) => i.id === id);
      if (!inv || inv.email !== u.email) throw new AppError("NOT_FOUND", "We couldn't find what you were looking for.");
      db.members.push({ workspaceId: inv.workspaceId, userId: u.id, fullName: u.fullName, email: u.email, role: inv.role, joinedAt: now() });
      db.invitations = db.invitations.filter((i) => i.id !== id); save();
    },
  },

  clients: {
    async list(workspaceId) { assertMember(workspaceId); return clone(db.clients.filter((c) => c.workspaceId === workspaceId).sort((a, b) => a.name.localeCompare(b.name))); },
    async create(workspaceId, input) {
      assertMember(workspaceId);
      const c: Client = { id: uid("c"), workspaceId, ...input, createdAt: now() };
      db.clients.push(c); log(workspaceId, "created", "client", c.name); save(); return clone(c);
    },
    async update(id, input) {
      const c = db.clients.find((x) => x.id === id);
      if (!c) throw new AppError("NOT_FOUND", "We couldn't find what you were looking for.");
      assertMember(c.workspaceId); Object.assign(c, input); save(); return clone(c);
    },
    async remove(id) {
      const c = db.clients.find((x) => x.id === id);
      if (!c) throw new AppError("NOT_FOUND", "We couldn't find what you were looking for.");
      assertAdmin(c.workspaceId);
      db.projects.filter((p) => p.clientId === id).forEach((p) => { p.clientId = null; });
      db.clients = db.clients.filter((x) => x.id !== id); save();
    },
  },

  projects: {
    async list(workspaceId) { assertMember(workspaceId); return clone(db.projects.filter((p) => p.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); },
    async get(id) {
      const p = db.projects.find((x) => x.id === id);
      if (!p || !roleIn(p.workspaceId)) throw new AppError("NOT_FOUND", "We couldn't find what you were looking for.");
      return clone(p);
    },
    async create(workspaceId, input) {
      assertMember(workspaceId); ensureProjectSlot(workspaceId);
      if (input.clientId && !db.clients.some((c) => c.id === input.clientId && c.workspaceId === workspaceId))
        throw new AppError("VALIDATION", "That client belongs to a different workspace.");
      const p: Project = { id: uid("p"), workspaceId, name: input.name, description: input.description ?? null, clientId: input.clientId ?? null, dueDate: input.dueDate ?? null, status: "active", createdAt: now(), updatedAt: now() };
      db.projects.push(p); log(workspaceId, "created", "project", p.name); save(); return clone(p);
    },
    async update(id, patch) {
      const p = db.projects.find((x) => x.id === id);
      if (!p) throw new AppError("NOT_FOUND", "We couldn't find what you were looking for.");
      assertMember(p.workspaceId);
      if (patch.status && patch.status !== "archived" && p.status === "archived") ensureProjectSlot(p.workspaceId);
      if (patch.clientId && !db.clients.some((c) => c.id === patch.clientId && c.workspaceId === p.workspaceId))
        throw new AppError("VALIDATION", "That client belongs to a different workspace.");
      if (patch.status === "archived" && p.status !== "archived") log(p.workspaceId, "archived", "project", p.name);
      Object.assign(p, patch, { updatedAt: now() }); save(); return clone(p);
    },
  },

  tasks: {
    async listByProject(projectId) {
      const p = db.projects.find((x) => x.id === projectId);
      if (!p) throw new AppError("NOT_FOUND", "We couldn't find what you were looking for.");
      assertMember(p.workspaceId);
      return clone(db.tasks.filter((t) => t.projectId === projectId).sort((a, b) => a.position - b.position));
    },
    async listByWorkspace(workspaceId) { assertMember(workspaceId); return clone(db.tasks.filter((t) => t.workspaceId === workspaceId)); },
    async create(workspaceId, projectId, input) {
      assertMember(workspaceId);
      if (!db.projects.some((p) => p.id === projectId && p.workspaceId === workspaceId)) throw new AppError("VALIDATION", "That project belongs to a different workspace.");
      if (input.assignedTo && !db.members.some((m) => m.workspaceId === workspaceId && m.userId === input.assignedTo)) throw new AppError("VALIDATION", "Assignee must be a workspace member.");
      const t: Task = { id: uid("t"), workspaceId, projectId, title: input.title, status: input.status, priority: input.priority, assignedTo: input.assignedTo ?? null, dueDate: input.dueDate ?? null, position: Date.now(), createdAt: now() };
      db.tasks.push(t); log(workspaceId, "created", "task", t.title); save(); return clone(t);
    },
    async update(id, patch) {
      const t = db.tasks.find((x) => x.id === id);
      if (!t) throw new AppError("NOT_FOUND", "We couldn't find what you were looking for.");
      assertMember(t.workspaceId);
      if (patch.assignedTo && !db.members.some((m) => m.workspaceId === t.workspaceId && m.userId === patch.assignedTo)) throw new AppError("VALIDATION", "Assignee must be a workspace member.");
      if (patch.status && patch.status !== t.status) log(t.workspaceId, `moved to ${patch.status.replace("_", " ")}`, "task", t.title);
      Object.assign(t, patch); save(); return clone(t);
    },
    async remove(id) {
      const t = db.tasks.find((x) => x.id === id);
      if (!t) throw new AppError("NOT_FOUND", "We couldn't find what you were looking for.");
      assertMember(t.workspaceId); db.tasks = db.tasks.filter((x) => x.id !== id); save();
    },
  },

  dashboard: {
    async stats(workspaceId): Promise<DashboardStats> {
      assertMember(workspaceId);
      const tasks = db.tasks.filter((t) => t.workspaceId === workspaceId);
      const byStatus: Record<TaskStatus, number> = { todo: 0, in_progress: 0, review: 0, done: 0 };
      tasks.forEach((t) => { byStatus[t.status]++; });
      const done = byStatus.done;
      // weekly throughput is derived from the activity log (same rule as the Postgres adapter)
      const weekly = Array.from({ length: 7 }, (_, i) => {
        const day = isoDate(i - 6);
        const label = new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });
        const value = db.activity.filter((a) => a.workspaceId === workspaceId && a.action === "moved to done" && isoDate(0, new Date(a.createdAt)) === day).length;
        return { label, value };
      });
      return {
        activeProjects: db.projects.filter((p) => p.workspaceId === workspaceId && p.status === "active").length,
        openTasks: tasks.length - done, completedTasks: done,
        overdueTasks: tasks.filter((t) => isOverdue(t.dueDate, t.status === "done")).length,
        completionRate: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
        tasksByStatus: byStatus, weeklyCompleted: weekly,
      };
    },
    async activity(workspaceId, limit = 8): Promise<Activity[]> {
      assertMember(workspaceId);
      return clone(db.activity.filter((a) => a.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit));
    },
  },

  billing: {
    async subscription(workspaceId) { assertMember(workspaceId); return clone(sub(workspaceId)); },
    async entitlements(workspaceId) { return entitlements(workspaceId); },
    async startCheckout(workspaceId) { assertOwner(workspaceId); return { simulated: true }; },
    async openPortal(workspaceId) { assertOwner(workspaceId); return { simulated: true }; },
    simulate: {
      async completeCheckout(workspaceId, plan) {
        assertOwner(workspaceId);
        const s = db.subscriptions.find((x) => x.workspaceId === workspaceId);
        const next: Subscription = { workspaceId, plan, status: "active", currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(), cancelAtPeriodEnd: false, hasCustomer: true };
        if (s) Object.assign(s, next); else db.subscriptions.push(next);
        save();
      },
      async failPayment(workspaceId) { assertOwner(workspaceId); const s = sub(workspaceId); if (s.hasCustomer) { s.status = "past_due"; save(); } },
      async cancel(workspaceId) { assertOwner(workspaceId); const s = sub(workspaceId); if (s.hasCustomer) { s.cancelAtPeriodEnd = true; save(); } },
    },
  },
};
