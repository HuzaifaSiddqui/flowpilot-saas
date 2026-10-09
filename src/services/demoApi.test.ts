import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setDemoDb, demoApi as api } from "./demoApi";
import { createSeed, DEMO_EMAIL, DEMO_PASSWORD } from "./demoSeed";

const NOW = new Date(2026, 9, 10, 12, 0);
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW); __setDemoDb(createSeed(NOW)); });
afterEach(() => { vi.useRealTimers(); });

const signInAs = (email: string) => api.auth.signIn(email, DEMO_PASSWORD);

describe("demo auth", () => {
  it("rejects wrong credentials and protects data while signed out", async () => {
    await expect(api.auth.signIn(DEMO_EMAIL, "wrong")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.workspaces.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });   // AUTH-02 equivalent
  });
  it("sign-up creates an account, a workspace and a Free subscription", async () => {
    const { user } = await api.auth.signUp("New Person", "new@example.com", "Passw0rd!");
    expect(user?.email).toBe("new@example.com");
    const [ws] = await api.workspaces.list();
    expect(ws.role).toBe("owner");
    expect((await api.billing.subscription(ws.id)).plan).toBe("free");
  });
  it("sign-up rejects duplicate emails", async () => {
    await expect(api.auth.signUp("Alice", DEMO_EMAIL, "Passw0rd!")).rejects.toThrow(/already exists/);
  });
});

describe("tenant isolation (demo adapter mirrors the RLS rules)", () => {
  it("Alice cannot read or change Bob's data", async () => {
    await signInAs(DEMO_EMAIL);
    await expect(api.projects.list("ws-bob")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.projects.get("p-bob1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.tasks.update("t-23", { title: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.projects.create("ws-bob", { name: "Intruder" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("lists only the workspaces the user belongs to", async () => {
    await signInAs("bob@flowpilot.demo");
    expect((await api.workspaces.list()).map((w) => w.id)).toEqual(["ws-bob"]);
  });
  it("a project cannot reference a client from another workspace", async () => {
    await signInAs("bob@flowpilot.demo");
    const bobClient = await api.clients.create("ws-bob", { name: "Bob's client" });
    await signInAs(DEMO_EMAIL);
    await expect(api.projects.create("ws-northwind", { name: "X", clientId: bobClient.id })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("roles", () => {
  it("a member cannot promote themselves or invite people", async () => {
    await signInAs("priya@flowpilot.demo");
    await expect(api.members.changeRole("ws-northwind", "u-priya", "admin")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(api.members.invite("ws-northwind", "x@y.com", "member")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("an admin can invite members but not admins, and cannot change roles", async () => {
    await signInAs("ben@flowpilot.demo");
    await api.members.revokeInvitation("inv-1");                                  // free a seat
    await expect(api.members.invite("ws-northwind", "boss@y.com", "admin")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(api.members.invite("ws-northwind", "new@y.com", "member")).resolves.toBeUndefined();
    await expect(api.members.changeRole("ws-northwind", "u-priya", "admin")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("the owner cannot be demoted or removed", async () => {
    await signInAs(DEMO_EMAIL);
    await expect(api.members.changeRole("ws-northwind", "u-alice", "member")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(api.members.remove("ws-northwind", "u-alice")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("only owners and admins can delete clients", async () => {
    await signInAs("priya@flowpilot.demo");
    await expect(api.clients.remove("c-lumen")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await signInAs("ben@flowpilot.demo");
    await expect(api.clients.remove("c-kite")).resolves.toBeUndefined();
  });
});

describe("plan limits & billing", () => {
  it("BILL-04 · Free workspace blocks the 3rd active project; archiving frees a slot", async () => {
    await signInAs(DEMO_EMAIL);
    expect((await api.billing.entitlements("ws-side"))).toMatchObject({ plan: "free", projectsUsed: 2, canCreateProject: false });
    await expect(api.projects.create("ws-side", { name: "Third" })).rejects.toMatchObject({ code: "PLAN_LIMIT_PROJECTS" });
    await api.projects.update("p-side1", { status: "archived" });
    await expect(api.projects.create("ws-side", { name: "Third" })).resolves.toMatchObject({ name: "Third" });
    await expect(api.projects.update("p-side1", { status: "active" })).rejects.toMatchObject({ code: "PLAN_LIMIT_PROJECTS" });
  });
  it("BILL-01 · a completed checkout unlocks unlimited projects", async () => {
    await signInAs(DEMO_EMAIL);
    await api.billing.simulate!.completeCheckout("ws-side", "pro");
    expect((await api.billing.entitlements("ws-side"))).toMatchObject({ plan: "pro", maxProjects: null, canCreateProject: true });
    await expect(api.projects.create("ws-side", { name: "Third" })).resolves.toBeDefined();
  });
  it("BILL-03 · payment failure falls back to Free limits until it recovers", async () => {
    await signInAs(DEMO_EMAIL);
    await api.billing.simulate!.failPayment("ws-northwind");
    const e = await api.billing.entitlements("ws-northwind");
    expect(e).toMatchObject({ plan: "free", maxProjects: 2, canCreateProject: false });
    await expect(api.projects.create("ws-northwind", { name: "Blocked" })).rejects.toMatchObject({ code: "PLAN_LIMIT_PROJECTS" });
  });
  it("only the owner can start checkout", async () => {
    await signInAs("ben@flowpilot.demo");
    await expect(api.billing.startCheckout("ws-northwind", "team")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(api.billing.openPortal("ws-northwind")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("seat limits count members + pending invitations", async () => {
    await signInAs(DEMO_EMAIL);
    expect(await api.billing.entitlements("ws-northwind")).toMatchObject({ seatsUsed: 5, maxSeats: 5, canInvite: false });
    await expect(api.members.invite("ws-northwind", "one@more.com", "member")).rejects.toMatchObject({ code: "PLAN_LIMIT_SEATS" });
  });
});

describe("work features", () => {
  it("PRJ-01/02 · created projects and tasks persist and show up in stats", async () => {
    await signInAs(DEMO_EMAIL);
    const before = await api.dashboard.stats("ws-northwind");
    const p = await api.projects.create("ws-northwind", { name: "Brand sprint", dueDate: "2026-12-01" });
    await api.tasks.create("ws-northwind", p.id, { title: "Kickoff", priority: "high", status: "todo" });
    expect((await api.tasks.listByProject(p.id))).toHaveLength(1);
    const after = await api.dashboard.stats("ws-northwind");
    expect(after.activeProjects).toBe(before.activeProjects + 1);
    expect(after.openTasks).toBe(before.openTasks + 1);
  });
  it("moving a task logs activity", async () => {
    await signInAs(DEMO_EMAIL);
    await api.tasks.update("t-4", { status: "done" });
    const feed = await api.dashboard.activity("ws-northwind", 3);
    expect(feed[0]).toMatchObject({ action: "moved to done", entityName: "Accessibility review (WCAG AA)" });
  });
  it("a task can only be assigned to a workspace member", async () => {
    await signInAs(DEMO_EMAIL);
    await expect(api.tasks.update("t-4", { assignedTo: "u-bob" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("removing a member unassigns their tasks", async () => {
    await signInAs(DEMO_EMAIL);
    await api.members.remove("ws-northwind", "u-tomas");
    const tasks = await api.tasks.listByWorkspace("ws-northwind");
    expect(tasks.some((t) => t.assignedTo === "u-tomas")).toBe(false);
  });
});
