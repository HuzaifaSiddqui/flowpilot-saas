// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, createDb, signUp, type Db, type TestUser } from "./pg";

type U = TestUser & { workspaceId: string };
let db: Db;
let alice: U, bob: U, carol: U, dana: U;   // alice & bob own workspaces; carol is a member of alice's; dana is a stranger
let aliceProject: string, bobProject: string, bobTask: string, aliceTask: string;

const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const sys = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => asService(db, () => q<T>(sql, params));

beforeAll(async () => {
  db = await createDb();
  alice = await signUp(db, "alice@flowpilot.test", "Alice Carter");
  bob = await signUp(db, "bob@flowpilot.test", "Bob Nguyen");
  carol = await signUp(db, "carol@flowpilot.test", "Carol Diaz");
  dana = await signUp(db, "dana@flowpilot.test", "Dana Lee");

  // Make Carol a plain member of Alice's workspace (membership writes are service/RPC only, so do it as the backend).
  await sys(`insert into public.workspace_members (workspace_id, user_id, role) values ($1, $2, 'member')`, [alice.workspaceId, carol.id]);
  // Alice's studio is on a paid Team plan (as a Stripe webhook would have set), so role tests aren't blocked by Free seat limits.
  await sys(`update public.subscriptions set plan = 'team', status = 'active' where workspace_id = $1`, [alice.workspaceId]);

  await asUser(db, alice, async () => {
    aliceProject = (await q<{ id: string }>(`insert into public.projects (workspace_id, name) values ($1, 'Alpha') returning id`, [alice.workspaceId]))[0].id;
    aliceTask = (await q<{ id: string }>(`insert into public.tasks (workspace_id, project_id, title) values ($1, $2, 'A-01') returning id`, [alice.workspaceId, aliceProject]))[0].id;
  });
  await asUser(db, bob, async () => {
    bobProject = (await q<{ id: string }>(`insert into public.projects (workspace_id, name) values ($1, 'Beta') returning id`, [bob.workspaceId]))[0].id;
    bobTask = (await q<{ id: string }>(`insert into public.tasks (workspace_id, project_id, title) values ($1, $2, 'B-01') returning id`, [bob.workspaceId, bobProject]))[0].id;
  });
});
afterAll(async () => { await db?.close(); });

describe("signup bootstrap", () => {
  it("creates a profile, an owned workspace and a Free subscription for every new user", async () => {
    const rows = await sys<{ role: string; plan: string; full_name: string }>(
      `select wm.role, s.plan, p.full_name from public.workspace_members wm
         join public.subscriptions s on s.workspace_id = wm.workspace_id
         join public.profiles p on p.id = wm.user_id where wm.user_id = $1`, [dana.id]);
    expect(rows).toEqual([{ role: "owner", plan: "free", full_name: "Dana Lee" }]);
  });
});

describe("RLS-00 · unauthenticated access", () => {
  it.each(["projects", "tasks", "clients", "workspaces", "workspace_members", "subscriptions", "profiles"])(
    "anon cannot read %s", async (table) => {
      await expect(asAnon(db, () => q(`select * from public.${table}`))).rejects.toThrow(/permission denied/i);
    });
  it("anon cannot call RPCs", async () => {
    await expect(asAnon(db, () => q(`select public.create_workspace('x y')`))).rejects.toThrow(/permission denied/i);
    await expect(asAnon(db, () => q(`select public.get_entitlements($1)`, [alice.workspaceId]))).rejects.toThrow(/permission denied/i);
  });
});

describe("RLS-01 · cross-workspace isolation", () => {
  it("Alice reads her own project", async () => {
    const rows = await asUser(db, alice, () => q(`select name from public.projects`));
    expect(rows).toEqual([{ name: "Alpha" }]);
  });
  it("Alice cannot read Bob's project — even by exact ID", async () => {
    const rows = await asUser(db, alice, () => q(`select * from public.projects where id = $1`, [bobProject]));
    expect(rows).toHaveLength(0);
  });
  it("Alice cannot read Bob's tasks, workspace, members or subscription", async () => {
    await asUser(db, alice, async () => {
      expect(await q(`select * from public.tasks where id = $1`, [bobTask])).toHaveLength(0);
      expect(await q(`select * from public.workspaces where id = $1`, [bob.workspaceId])).toHaveLength(0);
      expect(await q(`select * from public.workspace_members where workspace_id = $1`, [bob.workspaceId])).toHaveLength(0);
      expect(await q(`select * from public.subscriptions where workspace_id = $1`, [bob.workspaceId])).toHaveLength(0);
      expect(await q(`select * from public.activity_logs where workspace_id = $1`, [bob.workspaceId])).toHaveLength(0);
    });
  });
  it("Alice cannot update Bob's task", async () => {
    const rows = await asUser(db, alice, () => q(`update public.tasks set title = 'hacked' where id = $1 returning id`, [bobTask]));
    expect(rows).toHaveLength(0);
    expect((await sys<{ title: string }>(`select title from public.tasks where id = $1`, [bobTask]))[0].title).toBe("B-01");
  });
  it("Alice cannot delete Bob's task or project", async () => {
    await asUser(db, alice, async () => {
      expect(await q(`delete from public.tasks where id = $1 returning id`, [bobTask])).toHaveLength(0);
      expect(await q(`delete from public.projects where id = $1 returning id`, [bobProject])).toHaveLength(0);
    });
    expect(await sys(`select 1 from public.tasks where id = $1`, [bobTask])).toHaveLength(1);
  });
  it("Alice cannot insert a project into Bob's workspace", async () => {
    await expect(asUser(db, alice, () => q(`insert into public.projects (workspace_id, name) values ($1, 'intruder')`, [bob.workspaceId])))
      .rejects.toThrow(/row-level security/i);
  });
  it("changing a project's workspace_id cannot move it into another tenant", async () => {
    await expect(asUser(db, alice, () => q(`update public.projects set workspace_id = $1 where id = $2`, [bob.workspaceId, aliceProject])))
      .rejects.toThrow();
    expect((await sys<{ workspace_id: string }>(`select workspace_id from public.projects where id = $1`, [aliceProject]))[0].workspace_id).toBe(alice.workspaceId);
  });
  it("a task cannot point at another workspace's project (composite FK)", async () => {
    await expect(asUser(db, alice, () => q(`insert into public.tasks (workspace_id, project_id, title) values ($1, $2, 'sneaky')`, [alice.workspaceId, bobProject])))
      .rejects.toThrow(/foreign key/i);
  });
  it("a project cannot reference another workspace's client", async () => {
    const [bobClient] = await asUser(db, bob, () => q<{ id: string }>(`insert into public.clients (workspace_id, name) values ($1, 'Bob Client') returning id`, [bob.workspaceId]));
    await expect(asUser(db, alice, () => q(`insert into public.projects (workspace_id, client_id, name) values ($1, $2, 'x')`, [alice.workspaceId, bobClient.id])))
      .rejects.toThrow(/foreign key/i);
  });
  it("a task cannot be assigned to someone outside the workspace", async () => {
    await expect(asUser(db, alice, () => q(`update public.tasks set assigned_to = $1 where id = $2`, [bob.id, aliceTask])))
      .rejects.toThrow(/foreign key/i);
  });
  it("profiles are visible to co-members only", async () => {
    await asUser(db, alice, async () => {
      const names = (await q<{ full_name: string }>(`select full_name from public.profiles order by full_name`)).map((r) => r.full_name);
      expect(names).toEqual(["Alice Carter", "Carol Diaz"]);   // not Bob, not Dana
    });
  });
  it("a user with no workspace membership sees nothing", async () => {
    await asUser(db, { ...dana, id: "00000000-0000-4000-8000-000000000000" }, async () => {
      expect(await q(`select * from public.projects`)).toHaveLength(0);
    });
  });
});

describe("RLS-02 · roles & privilege escalation", () => {
  it("a member cannot promote themselves with a direct UPDATE", async () => {
    await expect(asUser(db, carol, () => q(`update public.workspace_members set role = 'admin' where user_id = $1`, [carol.id]))).rejects.toThrow(/permission denied/i);
  });
  it("a member cannot insert themselves into another workspace", async () => {
    await expect(asUser(db, carol, () => q(`insert into public.workspace_members (workspace_id, user_id, role) values ($1, $2, 'admin')`, [bob.workspaceId, carol.id]))).rejects.toThrow(/permission denied/i);
  });
  it("a member cannot promote themselves through the RPC", async () => {
    await expect(asUser(db, carol, () => q(`select public.change_member_role($1, $2, 'admin')`, [alice.workspaceId, carol.id]))).rejects.toThrow(/Only the owner/);
    expect((await sys<{ role: string }>(`select role from public.workspace_members where user_id = $1 and workspace_id = $2`, [carol.id, alice.workspaceId]))[0].role).toBe("member");
  });
  it("a member cannot invite, rename or delete the workspace", async () => {
    await expect(asUser(db, carol, () => q(`select public.invite_member($1, 'x@y.com', 'member')`, [alice.workspaceId]))).rejects.toThrow(/owners and admins/);
    const renamed = await asUser(db, carol, () => q(`update public.workspaces set name = 'Pwned' where id = $1 returning id`, [alice.workspaceId]));
    expect(renamed).toHaveLength(0);
    const deleted = await asUser(db, carol, () => q(`delete from public.workspaces where id = $1 returning id`, [alice.workspaceId]));
    expect(deleted).toHaveLength(0);
  });
  it("members can create and update tasks and clients, but cannot delete clients", async () => {
    await asUser(db, carol, async () => {
      const [t] = await q<{ id: string }>(`insert into public.tasks (workspace_id, project_id, title) values ($1, $2, 'Carol task') returning id`, [alice.workspaceId, aliceProject]);
      expect(await q(`update public.tasks set status = 'done' where id = $1 returning id`, [t.id])).toHaveLength(1);
      const [c] = await q<{ id: string }>(`insert into public.clients (workspace_id, name) values ($1, 'Carol client') returning id`, [alice.workspaceId]);
      expect(await q(`update public.clients set company = 'Acme' where id = $1 returning id`, [c.id])).toHaveLength(1);
      expect(await q(`delete from public.clients where id = $1 returning id`, [c.id])).toHaveLength(0);   // admins only
    });
  });
  it("created_by is stamped from the JWT and cannot be spoofed", async () => {
    const [row] = await asUser(db, carol, () => q<{ created_by: string }>(`insert into public.tasks (workspace_id, project_id, title, created_by) values ($1, $2, 'spoof', $3) returning created_by`, [alice.workspaceId, aliceProject, alice.id]));
    expect(row.created_by).toBe(carol.id);
  });
  it("the owner can promote a member to admin, and an admin cannot change roles", async () => {
    await asUser(db, alice, () => q(`select public.change_member_role($1, $2, 'admin')`, [alice.workspaceId, carol.id]));
    await expect(asUser(db, carol, () => q(`select public.change_member_role($1, $2, 'member')`, [alice.workspaceId, carol.id]))).rejects.toThrow(/Only the owner/);
    // admins may delete clients
    await asUser(db, carol, async () => {
      const [c] = await q<{ id: string }>(`insert into public.clients (workspace_id, name) values ($1, 'To delete') returning id`, [alice.workspaceId]);
      expect(await q(`delete from public.clients where id = $1 returning id`, [c.id])).toHaveLength(1);
    });
    // admins cannot invite admins, but can invite members
    await expect(asUser(db, carol, () => q(`select public.invite_member($1, 'boss@y.com', 'admin')`, [alice.workspaceId]))).rejects.toThrow(/Only the owner can invite admins/);
    await asUser(db, carol, () => q(`select public.invite_member($1, 'newbie@y.com', 'member')`, [alice.workspaceId]));
    await asUser(db, alice, () => q(`select public.change_member_role($1, $2, 'member')`, [alice.workspaceId, carol.id]));   // restore
    await sys(`delete from public.workspace_invitations where email = 'newbie@y.com'`);
  });
  it("the owner cannot be demoted or removed", async () => {
    await expect(asUser(db, alice, () => q(`select public.change_member_role($1, $2, 'member')`, [alice.workspaceId, alice.id]))).rejects.toThrow(/owner/i);
    await expect(asUser(db, alice, () => q(`select public.remove_member($1, $2)`, [alice.workspaceId, alice.id]))).rejects.toThrow(/owner cannot be removed/i);
  });
  it("a member cannot remove another member, but can leave on their own", async () => {
    await expect(asUser(db, carol, () => q(`select public.remove_member($1, $2)`, [alice.workspaceId, alice.id]))).rejects.toThrow();
    const eve = await signUp(db, "eve@flowpilot.test", "Eve Park");
    await sys(`insert into public.workspace_members (workspace_id, user_id, role) values ($1, $2, 'member')`, [alice.workspaceId, eve.id]);
    await asUser(db, eve, () => q(`select public.remove_member($1, $2)`, [alice.workspaceId, eve.id]));
    expect(await sys(`select 1 from public.workspace_members where workspace_id = $1 and user_id = $2`, [alice.workspaceId, eve.id])).toHaveLength(0);
  });
  it("only the owner can delete the workspace (cascades to its data)", async () => {
    const [temp] = await asUser(db, dana, () => q<{ id: string }>(`select public.create_workspace('Temp space') as id`));
    await asUser(db, dana, () => q(`insert into public.projects (workspace_id, name) values ($1, 'gone soon')`, [temp.id]));
    expect(await asUser(db, dana, () => q(`delete from public.workspaces where id = $1 returning id`, [temp.id]))).toHaveLength(1);
    expect(await sys(`select 1 from public.projects where workspace_id = $1`, [temp.id])).toHaveLength(0);
  });
});

describe("invitations", () => {
  it("only the invited email can accept, and acceptance grants the invited role", async () => {
    const [inv] = await asUser(db, alice, () => q<{ id: string }>(`select public.invite_member($1, 'DANA@flowpilot.test', 'member') as id`, [alice.workspaceId]));
    await expect(asUser(db, bob, () => q(`select public.accept_invitation($1)`, [inv.id]))).rejects.toThrow(/different email/);
    await asUser(db, dana, () => q(`select public.accept_invitation($1)`, [inv.id]));
    const rows = await asUser(db, dana, () => q<{ name: string }>(`select name from public.projects`));
    expect(rows.map((r) => r.name)).toContain("Alpha");
    await sys(`delete from public.workspace_members where user_id = $1 and workspace_id = $2`, [dana.id, alice.workspaceId]);
  });
  it("invitees can see their own invitation but strangers cannot", async () => {
    await asUser(db, alice, () => q(`select public.invite_member($1, 'dana@flowpilot.test', 'member')`, [alice.workspaceId]));
    expect(await asUser(db, dana, () => q(`select email from public.workspace_invitations`))).toHaveLength(1);
    expect(await asUser(db, bob, () => q(`select email from public.workspace_invitations`))).toHaveLength(0);
    await sys(`delete from public.workspace_invitations`);
  });
});

describe("BILL · billing tables are backend-only", () => {
  it("clients cannot write subscriptions", async () => {
    await expect(asUser(db, alice, () => q(`update public.subscriptions set plan = 'team', status = 'active' where workspace_id = $1`, [alice.workspaceId]))).rejects.toThrow(/permission denied/i);
    await expect(asUser(db, alice, () => q(`insert into public.subscriptions (workspace_id, plan) values ($1, 'team')`, [alice.workspaceId]))).rejects.toThrow(/permission denied/i);
  });
  it("clients cannot read or write stripe_events", async () => {
    await expect(asUser(db, alice, () => q(`select * from public.stripe_events`))).rejects.toThrow(/permission denied/i);
    await expect(asUser(db, alice, () => q(`insert into public.stripe_events (stripe_event_id, event_type) values ('evt_x', 'x')`))).rejects.toThrow(/permission denied/i);
  });
  it("members can read the subscriptions of their own workspaces only", async () => {
    await asUser(db, carol, async () => {
      const ids = (await q<{ workspace_id: string }>(`select workspace_id from public.subscriptions`)).map((r) => r.workspace_id).sort();
      expect(ids).toEqual([alice.workspaceId, carol.workspaceId].sort());          // hers + the one she belongs to
      expect(await q(`select 1 from public.subscriptions where workspace_id = $1`, [bob.workspaceId])).toHaveLength(0);
    });
  });
  it("the stripe_events primary key makes repeat deliveries fail fast (idempotency)", async () => {
    await sys(`insert into public.stripe_events (stripe_event_id, event_type) values ('evt_1', 'invoice.paid')`);
    await expect(sys(`insert into public.stripe_events (stripe_event_id, event_type) values ('evt_1', 'invoice.paid')`)).rejects.toThrow(/duplicate key/i);
  });
});

describe("BILL-04 · plan limits are enforced by the database", () => {
  const ent = (user: U) => asUser(db, user, async () => (await q<{ e: Record<string, unknown> }>(`select public.get_entitlements($1) as e`, [user.workspaceId]))[0].e);
  const makeProject = (user: U, name: string) => asUser(db, user, async () => (await q<{ id: string }>(`insert into public.projects (workspace_id, name) values ($1, $2) returning id`, [user.workspaceId, name]))[0].id);

  it("Free allows 2 active projects and blocks the 3rd", async () => {
    expect(await ent(bob)).toMatchObject({ plan: "free", maxProjects: 2, projectsUsed: 1, canCreateProject: true });
    await makeProject(bob, "Second");
    expect(await ent(bob)).toMatchObject({ projectsUsed: 2, canCreateProject: false });
    await expect(makeProject(bob, "Third")).rejects.toThrow(/PLAN_LIMIT_PROJECTS/);
  });
  it("archiving frees a slot; restoring beyond the limit is rejected", async () => {
    const [second] = await sys<{ id: string }>(`select id from public.projects where workspace_id = $1 and name = 'Second'`, [bob.workspaceId]);
    await asUser(db, bob, () => q(`update public.projects set status = 'archived' where id = $1`, [second.id]));
    const third = await makeProject(bob, "Third");           // now fits
    await expect(asUser(db, bob, () => q(`update public.projects set status = 'active' where id = $1`, [second.id]))).rejects.toThrow(/PLAN_LIMIT_PROJECTS/);
    await asUser(db, bob, () => q(`update public.projects set status = 'archived' where id = $1`, [third]));   // tidy
  });
  it("an active paid subscription lifts the limit (webhook writes as service role)", async () => {
    await sys(`update public.subscriptions set plan = 'pro', status = 'active' where workspace_id = $1`, [bob.workspaceId]);
    expect(await ent(bob)).toMatchObject({ plan: "pro", maxProjects: null, canCreateProject: true });
    await makeProject(bob, "P-A"); await makeProject(bob, "P-B"); await makeProject(bob, "P-C");
    expect((await ent(bob)).projectsUsed).toBeGreaterThanOrEqual(4);
  });
  it("payment failure drops the workspace back to Free limits; new projects are blocked", async () => {
    await sys(`update public.subscriptions set status = 'past_due' where workspace_id = $1`, [bob.workspaceId]);
    expect(await ent(bob)).toMatchObject({ plan: "free", maxProjects: 2, canCreateProject: false });
    await expect(makeProject(bob, "Blocked")).rejects.toThrow(/PLAN_LIMIT_PROJECTS/);
    await sys(`update public.subscriptions set status = 'active' where workspace_id = $1`, [bob.workspaceId]);   // payment recovered
    expect(await ent(bob)).toMatchObject({ plan: "pro", canCreateProject: true });
  });
  it("a canceled subscription also falls back to Free", async () => {
    await sys(`update public.subscriptions set status = 'canceled' where workspace_id = $1`, [bob.workspaceId]);
    expect((await ent(bob)).plan).toBe("free");
    await sys(`update public.subscriptions set plan = 'free', status = 'active' where workspace_id = $1`, [bob.workspaceId]);
  });
  it("seat limits count members + pending invitations (Free = 2 seats)", async () => {
    await asUser(db, dana, () => q(`select public.invite_member($1, 'first@y.com', 'member')`, [dana.workspaceId]));
    expect(await ent(dana)).toMatchObject({ seatsUsed: 2, maxSeats: 2, canInvite: false });
    await expect(asUser(db, dana, () => q(`select public.invite_member($1, 'second@y.com', 'member')`, [dana.workspaceId]))).rejects.toThrow(/PLAN_LIMIT_SEATS/);
    await sys(`update public.subscriptions set plan = 'team', status = 'active' where workspace_id = $1`, [dana.workspaceId]);
    await asUser(db, dana, () => q(`select public.invite_member($1, 'second@y.com', 'member')`, [dana.workspaceId]));
  });
  it("entitlements are only visible to members of that workspace", async () => {
    await expect(asUser(db, alice, () => q(`select public.get_entitlements($1)`, [bob.workspaceId]))).rejects.toThrow(/Not a member/);
  });
});

describe("activity log", () => {
  it("records creates and status moves, scoped per workspace", async () => {
    await asUser(db, alice, () => q(`update public.tasks set status = 'in_progress' where id = $1`, [aliceTask]));
    const rows = await asUser(db, alice, () => q<{ action: string; entity_name: string }>(`select action, entity_name from public.activity_logs order by created_at, action`));
    expect(rows.some((r) => r.action === "moved to in progress" && r.entity_name === "A-01")).toBe(true);
    expect(rows.some((r) => r.entity_name === "B-01")).toBe(false);
  });
  it("clients cannot write the activity log directly", async () => {
    await expect(asUser(db, alice, () => q(`insert into public.activity_logs (workspace_id, action, entity_type) values ($1, 'forged', 'x')`, [alice.workspaceId]))).rejects.toThrow(/permission denied/i);
  });
});
