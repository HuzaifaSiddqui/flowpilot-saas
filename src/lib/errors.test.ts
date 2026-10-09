import { describe, expect, it } from "vitest";
import { AppError, isPlanLimit, toAppError } from "./errors";

describe("toAppError", () => {
  it("maps database plan-limit exceptions", () => {
    expect(toAppError({ message: "PLAN_LIMIT_PROJECTS", code: "P0001" }).code).toBe("PLAN_LIMIT_PROJECTS");
    expect(toAppError({ message: "PLAN_LIMIT_SEATS" }).code).toBe("PLAN_LIMIT_SEATS");
    expect(isPlanLimit(toAppError({ message: "PLAN_LIMIT_PROJECTS" }))).toBe(true);
  });
  it("maps auth failures", () => {
    expect(toAppError({ status: 401, message: "x" }).code).toBe("UNAUTHORIZED");
    expect(toAppError({ message: "JWT expired" }).code).toBe("UNAUTHORIZED");
  });
  it("maps permission failures", () => {
    expect(toAppError({ code: "42501", message: "x" }).code).toBe("FORBIDDEN");
    expect(toAppError({ message: 'new row violates row-level security policy for table "projects"' }).code).toBe("FORBIDDEN");
    expect(toAppError({ message: "Only the owner can change roles" }).code).toBe("FORBIDDEN");
  });
  it("maps missing rows and network failures", () => {
    expect(toAppError({ code: "PGRST116", message: "x" }).code).toBe("NOT_FOUND");
    expect(toAppError(new TypeError("Failed to fetch")).code).toBe("NETWORK");
  });
  it("never leaks raw internal messages for unknown errors", () => {
    const e = toAppError(new Error("relation \"secret_table\" does not exist"));
    expect(e.code).toBe("UNKNOWN");
    expect(e.message).not.toMatch(/secret_table/);
  });
  it("passes AppErrors through untouched", () => {
    const original = new AppError("VALIDATION", "Nope");
    expect(toAppError(original)).toBe(original);
  });
});
