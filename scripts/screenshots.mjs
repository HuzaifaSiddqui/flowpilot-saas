// Captures the README / portfolio screenshots from the running app.
//   npm run build && npm run preview     (in another terminal)
//   npm run screenshots
// Env: BASE_URL (default http://localhost:4173), PW_CHROME_PATH (optional system Chromium)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME_PATH || undefined });

async function open({ width = 1440, height = 900, scale = 2 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: "light" });
  await ctx.addInitScript(() => { try { localStorage.setItem("flowpilot-demo-banner-dismissed", "1"); } catch {} });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { console.error("PAGE ERROR:", e.message); process.exitCode = 1; });
  return { ctx, page };
}
const settle = (page, ms = 700) => page.waitForTimeout(ms);
const shot = async (page, name, opts = {}) => { await settle(page); await page.screenshot({ path: `${OUT}/${name}.png`, ...opts }); console.log("✓", name); };
const nav = (page, name) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }).click();
async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.getByTestId("demo-login").click();
  await page.waitForURL("**/dashboard");
}

// ── Public pages ────────────────────────────────────────────────────────
{
  const { ctx, page } = await open();
  await page.goto(BASE); await shot(page, "01-landing");
  await shot(page, "02-landing-full", { fullPage: true });
  await page.goto(`${BASE}/login`); await shot(page, "03-login");
  await page.goto(`${BASE}/signup`); await shot(page, "04-signup");
  await ctx.close();
}

// ── Signed-in tour (Pro workspace) ──────────────────────────────────────
{
  const { ctx, page } = await open();
  await login(page);
  await shot(page, "05-dashboard", { animations: "disabled" });
  await nav(page, "Projects"); await shot(page, "06-projects");
  await page.getByRole("link", { name: /Lumen patient portal/ }).click(); await shot(page, "07-project-board");
  await page.getByText("Appointment booking wireframes").click(); await shot(page, "08-task-dialog");
  await page.keyboard.press("Escape");
  await nav(page, "Clients"); await shot(page, "09-clients");
  await nav(page, "Team"); await shot(page, "10-team");
  await page.getByTestId("invite").click(); await shot(page, "11-seat-limit-upgrade-prompt");
  await page.keyboard.press("Escape");
  await nav(page, "Billing"); await shot(page, "12-billing-pro");
  await nav(page, "Settings"); await shot(page, "13-settings");
  await ctx.close();
}

// ── Free workspace hits the plan limit → upgrades through test checkout ──
{
  const { ctx, page } = await open();
  await login(page);
  await page.getByRole("button", { name: "Switch workspace" }).click();
  await shot(page, "14-workspace-switcher");
  await page.getByRole("option", { name: /Side Projects/ }).click();
  await nav(page, "Projects");
  await page.getByTestId("new-project").click();
  await shot(page, "15-project-limit-upgrade-prompt");
  await page.getByRole("button", { name: "See plans" }).click();
  await shot(page, "16-billing-free");
  await page.getByRole("button", { name: "Upgrade to Pro" }).click();
  await shot(page, "17-test-checkout");
  await page.getByTestId("pay").click();
  await page.getByTestId("current-plan").filter({ hasText: "Pro" }).waitFor();
  await shot(page, "18-billing-after-upgrade");
  await ctx.close();
}

// ── Payment failure state ───────────────────────────────────────────────
{
  const { ctx, page } = await open();
  await login(page); await nav(page, "Billing");
  await page.getByRole("button", { name: "Simulate payment failure" }).click();
  await page.getByRole("alert").first().waitFor();
  await shot(page, "19-billing-payment-failed");
  await ctx.close();
}

// ── Member role (restricted UI) ─────────────────────────────────────────
{
  const { ctx, page } = await open();
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill("priya@flowpilot.demo");
  await page.getByLabel("Password").fill("Demo-Pass-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await nav(page, "Team"); await shot(page, "20-team-as-member");
  await ctx.close();
}

// ── Mobile ──────────────────────────────────────────────────────────────
{
  const { ctx, page } = await open({ width: 390, height: 844, scale: 3 });
  await login(page); await shot(page, "21-mobile-dashboard");
  await page.getByRole("button", { name: "Open navigation" }).click(); await shot(page, "22-mobile-navigation");
  await page.getByRole("dialog", { name: "Navigation" }).getByRole("link", { name: "Projects" }).click();
  await page.getByRole("link", { name: /Lumen patient portal/ }).click(); await shot(page, "23-mobile-board");
  await ctx.close();
}

await browser.close();
console.log("Done →", OUT);
