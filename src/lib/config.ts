import type { PlanKey, Role, TaskPriority, TaskStatus, ProjectStatus } from "@/types";

/** Single source of truth for plans. The database has its own copy (plan_limits) — keep in sync. */
export interface PlanConfig {
  key: PlanKey;
  name: string;
  priceMonthly: number;
  tagline: string;
  maxProjects: number | null;
  maxSeats: number;
  features: string[];
}

export const PLANS: Record<PlanKey, PlanConfig> = {
  free: {
    key: "free", name: "Free", priceMonthly: 0, tagline: "For trying FlowPilot solo.",
    maxProjects: 2, maxSeats: 2,
    features: ["2 active projects", "2 workspace seats", "Unlimited tasks & clients", "Activity feed"],
  },
  pro: {
    key: "pro", name: "Pro", priceMonthly: 19, tagline: "For freelancers and small studios.",
    maxProjects: null, maxSeats: 5,
    features: ["Unlimited projects", "5 workspace seats", "Priority support", "Everything in Free"],
  },
  team: {
    key: "team", name: "Team", priceMonthly: 49, tagline: "For growing agencies.",
    maxProjects: null, maxSeats: 10,
    features: ["Unlimited projects", "10 workspace seats", "Role-based permissions", "Everything in Pro"],
  },
};
export const PLAN_ORDER: PlanKey[] = ["free", "pro", "team"];

export const TASK_STATUSES: { key: TaskStatus; label: string; dot: string }[] = [
  { key: "todo", label: "To do", dot: "bg-stone-400" },
  { key: "in_progress", label: "In progress", dot: "bg-indigo-500" },
  { key: "review", label: "In review", dot: "bg-amber-500" },
  { key: "done", label: "Done", dot: "bg-emerald-500" },
];

export const TASK_PRIORITIES: { key: TaskPriority; label: string; tone: string }[] = [
  { key: "low", label: "Low", tone: "text-stone-500 bg-stone-100" },
  { key: "medium", label: "Medium", tone: "text-sky-700 bg-sky-50" },
  { key: "high", label: "High", tone: "text-amber-700 bg-amber-50" },
  { key: "urgent", label: "Urgent", tone: "text-rose-700 bg-rose-50" },
];

export const PROJECT_STATUSES: { key: ProjectStatus; label: string; tone: string }[] = [
  { key: "active", label: "Active", tone: "text-emerald-700 bg-emerald-50" },
  { key: "on_hold", label: "On hold", tone: "text-amber-700 bg-amber-50" },
  { key: "completed", label: "Completed", tone: "text-indigo-700 bg-indigo-50" },
  { key: "archived", label: "Archived", tone: "text-stone-500 bg-stone-100" },
];

export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member" };

/** Mirrors the permission matrix enforced by RLS + RPCs. UI uses this only to hide controls; the DB is the authority. */
export const can = {
  inviteMembers: (r: Role) => r === "owner" || r === "admin",
  changeRoles: (r: Role) => r === "owner",
  manageBilling: (r: Role) => r === "owner",
  deleteClients: (r: Role) => r === "owner" || r === "admin",
  renameWorkspace: (r: Role) => r === "owner" || r === "admin",
  deleteWorkspace: (r: Role) => r === "owner",
};
