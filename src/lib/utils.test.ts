import { describe, expect, it } from "vitest";
import { formatDate, initials, isOverdue, isoDate, pluralize, timeAgo } from "./utils";

describe("utils", () => {
  it("initials handles one, two and many words", () => {
    expect(initials("Alice")).toBe("A");
    expect(initials("Alice Carter")).toBe("AC");
    expect(initials("Mary Jane Watson")).toBe("MW");
    expect(initials("   ")).toBe("?");
  });
  it("isoDate offsets in local calendar days", () => {
    const base = new Date(2026, 9, 10);
    expect(isoDate(0, base)).toBe("2026-10-10");
    expect(isoDate(30, base)).toBe("2026-11-09");
    expect(isoDate(-10, base)).toBe("2026-09-30");
  });
  it("isOverdue ignores done tasks, missing dates and today", () => {
    const now = new Date(2026, 9, 10, 15, 0);
    expect(isOverdue("2026-10-09", false, now)).toBe(true);
    expect(isOverdue("2026-10-10", false, now)).toBe(false);
    expect(isOverdue("2026-10-01", true, now)).toBe(false);
    expect(isOverdue(null, false, now)).toBe(false);
  });
  it("timeAgo uses compact relative units", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    expect(timeAgo("2026-10-10T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-10-10T11:30:00Z", now)).toBe("30m ago");
    expect(timeAgo("2026-10-10T07:00:00Z", now)).toBe("5h ago");
    expect(timeAgo("2026-10-08T12:00:00Z", now)).toBe("2d ago");
  });
  it("formatDate tolerates empty and invalid input", () => {
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("nonsense")).toBe("—");
    expect(formatDate("2026-10-10")).toBe("Oct 10");
  });
  it("pluralize", () => {
    expect(pluralize(1, "task")).toBe("1 task");
    expect(pluralize(0, "task")).toBe("0 tasks");
    expect(pluralize(2, "company", "companies")).toBe("2 companies");
  });
});
