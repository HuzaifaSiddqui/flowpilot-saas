import { describe, expect, it } from "vitest";
import { clientSchema, fieldErrors, inviteSchema, loginSchema, passwordSchema, projectSchema, signupSchema, taskSchema, workspaceSchema } from "./validation";

describe("validation", () => {
  it("normalises emails", () => {
    const r = loginSchema.parse({ email: "  Alice@Example.COM ", password: "x" });
    expect(r.email).toBe("alice@example.com");
  });
  it("rejects bad emails with a friendly message", () => {
    const r = loginSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).email).toMatch(/valid email/i);
  });
  it("password rules: length, letter, number", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("allletters").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("Good-pass-1").success).toBe(true);
  });
  it("signup reports every invalid field at once", () => {
    const r = signupSchema.safeParse({ fullName: "A", email: "x", password: "y" });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(fieldErrors(r.error)).sort()).toEqual(["email", "fullName", "password"]);
  });
  it("project: trims, requires a name and turns blanks into null", () => {
    expect(projectSchema.safeParse({ name: "   " }).success).toBe(false);
    const r = projectSchema.parse({ name: "  Website  ", clientId: "", dueDate: "" });
    expect(r).toMatchObject({ name: "Website", clientId: null, dueDate: null });
  });
  it("task: enforces enums", () => {
    expect(taskSchema.safeParse({ title: "x", priority: "urgent", status: "todo" }).success).toBe(true);
    expect(taskSchema.safeParse({ title: "x", priority: "critical", status: "todo" }).success).toBe(false);
    expect(taskSchema.safeParse({ title: "x", priority: "low", status: "archived" }).success).toBe(false);
  });
  it("client: email optional but validated when present", () => {
    expect(clientSchema.safeParse({ name: "Acme" }).success).toBe(true);
    expect(clientSchema.safeParse({ name: "Acme", email: "nope" }).success).toBe(false);
  });
  it("workspace + invite", () => {
    expect(workspaceSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@b.co", role: "owner" }).success).toBe(false);   // owners cannot be invited
    expect(inviteSchema.safeParse({ email: "a@b.co", role: "admin" }).success).toBe(true);
  });
});
