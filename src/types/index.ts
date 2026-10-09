export type Role = "owner" | "admin" | "member";
export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type PlanKey = "free" | "pro" | "team";

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
}

export interface Profile {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  role: Role; // the signed-in user's role in this workspace
  createdAt: string;
}

export interface Member {
  userId: string;
  fullName: string;
  email?: string;
  role: Role;
  joinedAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
  workspaceId: string;
  workspaceName?: string;
}

export interface Client {
  id: string;
  workspaceId: string;
  name: string;
  email?: string | null;
  company?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  clientId?: string | null;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  assignedTo?: string | null;
  position: number;
  createdAt: string;
}

export interface Activity {
  id: string;
  workspaceId: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityName: string | null;
  createdAt: string;
}

export interface Subscription {
  workspaceId: string;
  plan: PlanKey;
  status: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  hasCustomer: boolean;
}

export interface Entitlements {
  plan: PlanKey; // the EFFECTIVE plan (paid plans only apply while status is active/trialing)
  maxProjects: number | null;
  maxSeats: number;
  projectsUsed: number;
  seatsUsed: number;
  canCreateProject: boolean;
  canInvite: boolean;
}

export interface DashboardStats {
  activeProjects: number;
  openTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionRate: number; // 0..100
  tasksByStatus: Record<TaskStatus, number>;
  weeklyCompleted: { label: string; value: number }[];
}
