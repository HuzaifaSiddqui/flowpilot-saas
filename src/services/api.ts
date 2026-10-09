import type {
  Activity, Client, DashboardStats, Entitlements, Invitation, Member, PlanKey, Project, ProjectStatus,
  Role, Subscription, Task, TaskPriority, TaskStatus, User, Workspace,
} from "@/types";

export interface ProjectInput { name: string; description?: string; clientId?: string | null; dueDate?: string | null }
export interface TaskInput { title: string; priority: TaskPriority; status: TaskStatus; assignedTo?: string | null; dueDate?: string | null }
export interface ClientInput { name: string; email?: string; company?: string; notes?: string }

/**
 * The only surface the UI talks to. Two implementations exist:
 *  - supabaseApi: the real backend (Auth + Postgres/RLS + Edge Functions)
 *  - demoApi:     an in-browser simulation with the same rules, used when no Supabase env is configured
 */
export interface Api {
  mode: "supabase" | "demo";

  auth: {
    getUser(): Promise<User | null>;
    signIn(email: string, password: string): Promise<User>;
    signUp(fullName: string, email: string, password: string): Promise<{ user: User | null; needsConfirmation: boolean }>;
    signOut(): Promise<void>;
    resetPassword(email: string): Promise<void>;
    updatePassword(password: string): Promise<void>;
    updateProfile(fullName: string): Promise<User>;
    onChange(cb: (user: User | null) => void): () => void;
  };

  workspaces: {
    list(): Promise<Workspace[]>;
    create(name: string): Promise<Workspace>;
    rename(id: string, name: string): Promise<void>;
    remove(id: string): Promise<void>;
  };

  members: {
    list(workspaceId: string): Promise<Member[]>;
    invitations(workspaceId: string): Promise<Invitation[]>;
    invite(workspaceId: string, email: string, role: Exclude<Role, "owner">): Promise<void>;
    revokeInvitation(id: string): Promise<void>;
    changeRole(workspaceId: string, userId: string, role: Exclude<Role, "owner">): Promise<void>;
    remove(workspaceId: string, userId: string): Promise<void>;
    myInvitations(): Promise<Invitation[]>;
    acceptInvitation(id: string): Promise<void>;
  };

  clients: {
    list(workspaceId: string): Promise<Client[]>;
    create(workspaceId: string, input: ClientInput): Promise<Client>;
    update(id: string, input: ClientInput): Promise<Client>;
    remove(id: string): Promise<void>;
  };

  projects: {
    list(workspaceId: string): Promise<Project[]>;
    get(id: string): Promise<Project>;
    create(workspaceId: string, input: ProjectInput): Promise<Project>;
    update(id: string, patch: Partial<ProjectInput> & { status?: ProjectStatus }): Promise<Project>;
  };

  tasks: {
    listByProject(projectId: string): Promise<Task[]>;
    listByWorkspace(workspaceId: string): Promise<Task[]>;
    create(workspaceId: string, projectId: string, input: TaskInput): Promise<Task>;
    update(id: string, patch: Partial<TaskInput> & { position?: number }): Promise<Task>;
    remove(id: string): Promise<void>;
  };

  dashboard: {
    stats(workspaceId: string): Promise<DashboardStats>;
    activity(workspaceId: string, limit?: number): Promise<Activity[]>;
  };

  billing: {
    subscription(workspaceId: string): Promise<Subscription>;
    entitlements(workspaceId: string): Promise<Entitlements>;
    /** Real mode returns a Stripe Checkout URL. Demo mode returns { simulated: true } and the UI shows a test checkout. */
    startCheckout(workspaceId: string, plan: Exclude<PlanKey, "free">): Promise<{ url?: string; simulated?: boolean }>;
    openPortal(workspaceId: string): Promise<{ url?: string; simulated?: boolean }>;
    /** Demo-only helpers that stand in for Stripe webhooks. Undefined in Supabase mode. */
    simulate?: {
      completeCheckout(workspaceId: string, plan: Exclude<PlanKey, "free">): Promise<void>;
      failPayment(workspaceId: string): Promise<void>;
      cancel(workspaceId: string): Promise<void>;
    };
  };
}
