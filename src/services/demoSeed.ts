import type { Activity, Client, Invitation, Member, Project, Subscription, Task, Workspace } from "@/types";
import { isoDate } from "@/lib/utils";

export interface DemoUser { id: string; email: string; fullName: string; password: string }
export interface DemoDb {
  users: DemoUser[];
  sessionUserId: string | null;
  workspaces: (Omit<Workspace, "role">)[];
  members: (Member & { workspaceId: string })[];
  invitations: Invitation[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  activity: Activity[];
  subscriptions: Subscription[];
  seq: number;
}

export const DEMO_EMAIL = "alice@flowpilot.demo";
export const DEMO_PASSWORD = "Demo-Pass-123";

const ago = (mins: number, now: Date) => new Date(now.getTime() - mins * 60000).toISOString();

/** Deterministic, date-relative seed so the demo always looks fresh. */
export function createSeed(now: Date = new Date()): DemoDb {
  const U = {
    alice: { id: "u-alice", email: DEMO_EMAIL, fullName: "Alice Carter", password: DEMO_PASSWORD },
    ben: { id: "u-ben", email: "ben@flowpilot.demo", fullName: "Ben Okoye", password: DEMO_PASSWORD },
    priya: { id: "u-priya", email: "priya@flowpilot.demo", fullName: "Priya Nair", password: DEMO_PASSWORD },
    tomas: { id: "u-tomas", email: "tomas@flowpilot.demo", fullName: "Tomás Silva", password: DEMO_PASSWORD },
    bob: { id: "u-bob", email: "bob@flowpilot.demo", fullName: "Bob Nguyen", password: DEMO_PASSWORD },
  };
  const created = ago(60 * 24 * 40, now);
  const WS = { nw: "ws-northwind", side: "ws-side", bob: "ws-bob" };

  const workspaces = [
    { id: WS.nw, name: "Northwind Studio", ownerId: U.alice.id, createdAt: created },
    { id: WS.side, name: "Side Projects", ownerId: U.alice.id, createdAt: created },
    { id: WS.bob, name: "Bob's Workshop", ownerId: U.bob.id, createdAt: created },
  ];

  const mk = (workspaceId: string, u: DemoUser, role: Member["role"]): Member & { workspaceId: string } =>
    ({ workspaceId, userId: u.id, fullName: u.fullName, email: u.email, role, joinedAt: created });
  const members = [
    mk(WS.nw, U.alice, "owner"), mk(WS.nw, U.ben, "admin"), mk(WS.nw, U.priya, "member"), mk(WS.nw, U.tomas, "member"),
    mk(WS.side, U.alice, "owner"), mk(WS.bob, U.bob, "owner"),
  ];

  const client = (id: string, name: string, company: string, email: string, notes?: string): Client =>
    ({ id, workspaceId: WS.nw, name, company, email, notes, createdAt: created });
  const clients: Client[] = [
    client("c-lumen", "Maya Okafor", "Lumen Health", "maya@lumen.co", "Prefers async updates on Fridays."),
    client("c-harbor", "Daniel Reyes", "Harbor Logistics", "daniel@harbor.io"),
    client("c-fern", "Sofia Lindqvist", "Fernwood Coffee", "sofia@fernwood.coffee", "Brand refresh + packaging."),
    client("c-atlas", "Kwame Mensah", "Atlas Fintech", "kwame@atlas.finance"),
    client("c-kite", "Elena Rossi", "Kite Outdoors", "elena@kite.outdoors"),
  ];

  const project = (id: string, name: string, clientId: string | null, status: Project["status"], due: number | null, description: string, workspaceId = WS.nw): Project =>
    ({ id, workspaceId, clientId, name, description, status, dueDate: due === null ? null : isoDate(due, now), createdAt: created, updatedAt: ago(90, now) });
  const projects: Project[] = [
    project("p-lumen", "Lumen patient portal", "c-lumen", "active", 30, "Redesign and rebuild the patient-facing portal with appointment booking."),
    project("p-harbor", "Harbor tracking dashboard", "c-harbor", "active", 55, "Real-time shipment tracking dashboard for operations teams."),
    project("p-fern", "Fernwood brand refresh", "c-fern", "active", 12, "New identity, packaging system and launch collateral."),
    project("p-atlas", "Atlas mobile onboarding", "c-atlas", "on_hold", 70, "Streamlined KYC onboarding flow. Paused pending compliance review."),
    project("p-kite", "Kite marketing site", "c-kite", "completed", -9, "Seasonal campaign site. Shipped and handed over."),
    project("p-mosaic", "Mosaic design audit", null, "archived", -60, "Archived — superseded by the Lumen engagement."),
    project("p-side1", "Portfolio site v3", null, "active", 21, "Personal portfolio rebuild.", WS.side),
    project("p-side2", "Newsletter redesign", null, "active", 40, "Monthly newsletter template system.", WS.side),
    project("p-bob1", "Beta project — private to Bob", null, "active", null, "Visible only to Bob's workspace.", WS.bob),
  ];

  let n = 0;
  const t = (projectId: string, title: string, status: Task["status"], priority: Task["priority"], assignedTo: string | null, due: number | null, workspaceId = WS.nw): Task =>
    ({ id: `t-${++n}`, workspaceId, projectId, title, status, priority, assignedTo, dueDate: due === null ? null : isoDate(due, now), position: n, createdAt: created });
  const tasks: Task[] = [
    t("p-lumen", "Audit current patient flows", "done", "high", U.alice.id, -6),
    t("p-lumen", "Appointment booking wireframes", "in_progress", "high", U.alice.id, 3),
    t("p-lumen", "Design tokens & component library", "review", "medium", U.priya.id, 5),
    t("p-lumen", "Accessibility review (WCAG AA)", "todo", "medium", null, 14),
    t("p-lumen", "Usability test — 6 participants", "todo", "low", U.tomas.id, 18),
    t("p-harbor", "Define dashboard KPIs with ops lead", "in_progress", "urgent", U.ben.id, 1),
    t("p-harbor", "Map carrier API schema", "todo", "medium", U.tomas.id, 9),
    t("p-harbor", "Prototype live map view", "todo", "high", U.priya.id, 16),
    t("p-harbor", "Kickoff workshop", "done", "medium", U.alice.id, -12),
    t("p-fern", "Moodboards & direction", "done", "medium", U.alice.id, -8),
    t("p-fern", "Logo exploration round 2", "review", "high", U.alice.id, 2),
    t("p-fern", "Packaging dielines", "in_progress", "high", U.priya.id, -1),
    t("p-fern", "Brand guidelines document", "todo", "medium", U.ben.id, 8),
    t("p-fern", "Launch social templates", "todo", "low", null, 11),
    t("p-atlas", "KYC flow map", "done", "high", U.ben.id, -20),
    t("p-atlas", "Prototype ID capture screen", "todo", "medium", U.priya.id, null),
    t("p-kite", "Homepage hero & storytelling", "done", "high", U.alice.id, -25),
    t("p-kite", "Product grid & filters", "done", "medium", U.priya.id, -20),
    t("p-kite", "Launch QA & handover", "done", "medium", U.ben.id, -10),
    t("p-side1", "Case study copywriting", "in_progress", "medium", U.alice.id, 7, WS.side),
    t("p-side1", "Homepage layout", "todo", "medium", U.alice.id, 12, WS.side),
    t("p-side2", "Template grid system", "todo", "low", null, 25, WS.side),
    t("p-bob1", "Bob's private task", "todo", "medium", U.bob.id, null, WS.bob),
  ];

  const act = (i: number, actor: DemoUser, action: string, entityType: string, entityName: string, mins: number): Activity =>
    ({ id: `a-${i}`, workspaceId: WS.nw, actorId: actor.id, actorName: actor.fullName, action, entityType, entityName, createdAt: ago(mins, now) });
  const activity: Activity[] = [
    act(1, U.priya, "moved to in progress", "task", "Packaging dielines", 18),
    act(2, U.alice, "moved to in review", "task", "Logo exploration round 2", 55),
    act(3, U.ben, "created", "task", "Define dashboard KPIs with ops lead", 130),
    act(4, U.alice, "moved to done", "task", "Audit current patient flows", 60 * 5),
    act(5, U.tomas, "created", "task", "Map carrier API schema", 60 * 9),
    act(6, U.alice, "created", "client", "Fernwood Coffee", 60 * 26),
    act(7, U.priya, "moved to done", "task", "Product grid & filters", 60 * 30),
    act(8, U.ben, "archived", "project", "Mosaic design audit", 60 * 50),
  ];

  // Seeded history so the weekly throughput chart has real rows to aggregate (days back → completions)
  const history: [number, number][] = [[6, 2], [5, 3], [4, 1], [3, 4], [2, 2], [1, 3], [0, 1]];
  const doneNames = ["Review homepage copy", "Export brand assets", "Fix mobile nav spacing", "Client feedback round 1", "Update component docs", "Prepare handoff file", "Sync with dev team", "Finalize colour palette", "Write release notes", "Check contrast ratios", "QA checkout flow", "Stakeholder walkthrough", "Archive old mockups", "Set up analytics events"];
  let h = 0;
  history.forEach(([daysBack, count]) => {
    for (let k = 0; k < count; k++) {
      const who = [U.alice, U.ben, U.priya, U.tomas][(h + k) % 4];
      activity.push(act(100 + ++h, who, "moved to done", "task", doneNames[(h - 1) % doneNames.length], daysBack * 24 * 60 + 60 * (k + 2) + 45));
    }
  });

  const subscriptions: Subscription[] = [
    { workspaceId: WS.nw, plan: "pro", status: "active", currentPeriodEnd: new Date(now.getTime() + 19 * 86400000).toISOString(), cancelAtPeriodEnd: false, hasCustomer: true },
    { workspaceId: WS.side, plan: "free", status: "active", cancelAtPeriodEnd: false, hasCustomer: false },
    { workspaceId: WS.bob, plan: "free", status: "active", cancelAtPeriodEnd: false, hasCustomer: false },
  ];

  const invitations: Invitation[] = [
    { id: "inv-1", workspaceId: WS.nw, email: "jordan@example.com", role: "member", createdAt: ago(60 * 20, now), expiresAt: new Date(now.getTime() + 12 * 86400000).toISOString() },
  ];

  return { users: Object.values(U), sessionUserId: null, workspaces, members, invitations, clients, projects, tasks, activity, subscriptions, seq: 1000 };
}
