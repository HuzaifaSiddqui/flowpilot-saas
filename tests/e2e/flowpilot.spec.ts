import { expect, test, type Page } from "@playwright/test";

async function loginDemo(page: Page, email?: string) {
  await page.goto("/login");
  if (email) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Demo-Pass-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  } else {
    await page.getByTestId("demo-login").click();
  }
  await expect(page).toHaveURL(/\/dashboard/);
}
const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }).click();

test.describe("authentication", () => {
  test("AUTH-02 · logged-out visitors are redirected away from the dashboard", async ({ page }) => {
    for (const path of ["/dashboard", "/projects", "/billing", "/team"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("login shows inline validation and a safe error for bad credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await page.getByLabel("Email").fill("alice@flowpilot.demo");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Incorrect email or password");
  });

  test("AUTH-01 · a new user can sign up and lands in their own empty workspace", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Jamie Rivera");
    await page.getByLabel("Work email").fill("jamie@example.com");
    await page.getByLabel("Password").fill("Passw0rd-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Jamie/ })).toBeVisible();
    await expect(page.getByText("Jamie's workspace").first()).toBeVisible();
    await nav(page, "Projects");
    await expect(page.getByText("No projects here yet")).toBeVisible();
  });

  test("sign out returns to the login page and protects the app again", async ({ page }) => {
    await loginDemo(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("projects & tasks", () => {
  test("PRJ-01/02 · creating a project persists it across a reload", async ({ page }) => {
    await loginDemo(page);
    await nav(page, "Projects");
    await page.getByTestId("new-project").click();
    await page.getByLabel("Project name").fill("Aurora rebrand");
    await page.getByLabel("Client").selectOption({ label: "Maya Okafor · Lumen Health" });
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByRole("heading", { name: "Aurora rebrand" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Aurora rebrand" })).toBeVisible();
  });

  test("project form validates required fields", async ({ page }) => {
    await loginDemo(page);
    await nav(page, "Projects");
    await page.getByTestId("new-project").click();
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByText("Give the project a name")).toBeVisible();
  });

  test("tasks can be added and dragged across the board, and the move persists", async ({ page }) => {
    await loginDemo(page);
    await nav(page, "Projects");
    await page.getByRole("link", { name: /Lumen patient portal/ }).click();
    await page.getByTestId("add-task").click();
    await page.getByRole("dialog").getByLabel("Title").fill("Write launch checklist");
    await page.getByRole("dialog").getByRole("button", { name: "Add task" }).click();
    const card = page.getByTestId("col-todo").getByTestId("task-card").filter({ hasText: "Write launch checklist" });
    await expect(card).toBeVisible();
    await card.dragTo(page.getByTestId("col-done"));
    await expect(page.getByTestId("col-done").getByText("Write launch checklist")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("col-done").getByText("Write launch checklist")).toBeVisible();
  });

  test("tasks can be edited and deleted behind a confirmation", async ({ page }) => {
    await loginDemo(page);
    await nav(page, "Projects");
    await page.getByRole("link", { name: /Lumen patient portal/ }).click();
    await page.getByText("Accessibility review (WCAG AA)").click();
    await page.getByRole("dialog").getByLabel("Status").selectOption("review");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("col-review").getByText("Accessibility review (WCAG AA)")).toBeVisible();
    await page.getByText("Accessibility review (WCAG AA)").click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Delete this task?")).toBeVisible();
    await page.getByRole("button", { name: "Delete task" }).click();
    await expect(page.getByText("Accessibility review (WCAG AA)")).toHaveCount(0);
  });

  test("an unknown project shows a helpful not-found state", async ({ page }) => {
    await loginDemo(page);
    await page.goto("/projects/does-not-exist");
    await expect(page.getByText("We couldn't find what you were looking for.")).toBeVisible();
  });

  test("unknown routes show the 404 page", async ({ page }) => {
    await page.goto("/definitely/not/a/page");
    await expect(page.getByRole("heading", { name: /wandered off/ })).toBeVisible();
  });
});

test.describe("tenant isolation & roles", () => {
  test("RLS-01 · another workspace's project is not reachable by ID", async ({ page }) => {
    await loginDemo(page);
    await page.goto("/projects/p-bob1");
    await expect(page.getByText("We couldn't find what you were looking for.")).toBeVisible();
  });

  test("RLS-02 · a plain member has no invite or billing powers", async ({ page }) => {
    await loginDemo(page, "priya@flowpilot.demo");
    await nav(page, "Team");
    await expect(page.getByTestId("invite")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: /Role for/ })).toHaveCount(0);
    await nav(page, "Billing");
    await expect(page.getByText("Only the workspace owner can change the plan.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Upgrade to/ })).toHaveCount(0);
  });

  test("the owner can change a member's role", async ({ page }) => {
    await loginDemo(page);
    await nav(page, "Team");
    await page.getByRole("combobox", { name: "Role for Priya Nair" }).selectOption("admin");
    await expect(page.getByText("Role updated")).toBeVisible();
  });
});

test.describe("billing", () => {
  test("BILL-04 + BILL-01 · Free workspace is blocked at 2 projects, then upgrades via test checkout", async ({ page }) => {
    await loginDemo(page);
    await page.getByRole("button", { name: "Switch workspace" }).click();
    await page.getByRole("option", { name: /Side Projects/ }).click();
    await nav(page, "Projects");
    await expect(page.getByText("2 of 2 active projects used.")).toBeVisible();

    await page.getByTestId("new-project").click();
    await expect(page.getByRole("heading", { name: "Project limit reached" })).toBeVisible();
    await page.getByRole("button", { name: "See plans" }).click();
    await expect(page).toHaveURL(/\/billing/);
    await expect(page.getByTestId("current-plan")).toHaveText("Free");

    await page.getByRole("button", { name: "Upgrade to Pro" }).click();
    await expect(page.getByRole("heading", { name: "Test checkout" })).toBeVisible();
    await page.getByTestId("pay").click();
    await expect(page.getByTestId("current-plan")).toHaveText("Pro");

    await nav(page, "Projects");
    await page.getByTestId("new-project").click();
    await expect(page.getByRole("heading", { name: "New project" })).toBeVisible();   // limit lifted
  });

  test("BILL-03 · a failed payment pauses paid features and warns the owner", async ({ page }) => {
    await loginDemo(page);
    await nav(page, "Billing");
    await page.getByRole("button", { name: "Simulate payment failure" }).click();
    await expect(page.getByRole("alert")).toContainText("last payment didn't go through");
    await expect(page.getByTestId("current-plan")).toHaveText("Free");
    await nav(page, "Projects");
    await page.getByTestId("new-project").click();
    await expect(page.getByRole("heading", { name: "Project limit reached" })).toBeVisible();
  });

  test("seat limit shows an upgrade prompt instead of the invite form", async ({ page }) => {
    await loginDemo(page);
    await nav(page, "Team");
    await page.getByTestId("invite").click();
    await expect(page.getByRole("heading", { name: "No seats left" })).toBeVisible();
  });
});

test.describe("responsive", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("UI-01 · the dashboard is usable on a phone without horizontal scroll", async ({ page }) => {
    await loginDemo(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("dialog", { name: "Navigation" }).getByRole("link", { name: "Projects" }).click();
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
  });
});
