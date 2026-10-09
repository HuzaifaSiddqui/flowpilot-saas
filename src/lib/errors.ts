/** Application error with a safe, user-facing message and a machine-readable code. */
export type ErrorCode =
  | "PLAN_LIMIT_PROJECTS" | "PLAN_LIMIT_SEATS" | "UNAUTHORIZED" | "FORBIDDEN"
  | "NOT_FOUND" | "VALIDATION" | "NETWORK" | "UNKNOWN";

export class AppError extends Error {
  constructor(public code: ErrorCode, message: string, public cause?: unknown) {
    super(message);
    this.name = "AppError";
  }
}

const MESSAGES: Record<ErrorCode, string> = {
  PLAN_LIMIT_PROJECTS: "You've reached the project limit for your plan. Upgrade to add more.",
  PLAN_LIMIT_SEATS: "You've used every seat on your plan. Upgrade to invite more people.",
  UNAUTHORIZED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  VALIDATION: "Please check the highlighted fields.",
  NETWORK: "We can't reach the server. Check your connection and try again.",
  UNKNOWN: "Something went wrong on our side. Please try again.",
};

/** Normalise anything thrown by Supabase / fetch / our own code into an AppError. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const e = err as { message?: string; code?: string; status?: number } | null;
  const message = e?.message ?? "";
  if (message.includes("PLAN_LIMIT_PROJECTS")) return new AppError("PLAN_LIMIT_PROJECTS", MESSAGES.PLAN_LIMIT_PROJECTS, err);
  if (message.includes("PLAN_LIMIT_SEATS")) return new AppError("PLAN_LIMIT_SEATS", MESSAGES.PLAN_LIMIT_SEATS, err);
  if (e?.status === 401 || e?.code === "PGRST301" || /jwt (expired|invalid)/i.test(message)) return new AppError("UNAUTHORIZED", MESSAGES.UNAUTHORIZED, err);
  if (e?.status === 403 || e?.code === "42501" || /row-level security|permission denied|not allowed|only (the )?(owner|owners)/i.test(message)) return new AppError("FORBIDDEN", MESSAGES.FORBIDDEN, err);
  if (e?.code === "PGRST116" || e?.code === "P0002") return new AppError("NOT_FOUND", MESSAGES.NOT_FOUND, err);
  if (err instanceof TypeError && /fetch|network/i.test(message)) return new AppError("NETWORK", MESSAGES.NETWORK, err);
  if (typeof navigator !== "undefined" && navigator.onLine === false) return new AppError("NETWORK", MESSAGES.NETWORK, err);
  return new AppError("UNKNOWN", MESSAGES.UNKNOWN, err);
}

export const isPlanLimit = (e: unknown) => e instanceof AppError && (e.code === "PLAN_LIMIT_PROJECTS" || e.code === "PLAN_LIMIT_SEATS");

/** Central logging hook — wire Sentry (or similar) in here: Sentry.captureException(appErr.cause ?? appErr). */
export function reportError(err: unknown, context?: string) {
  const appErr = toAppError(err);
  // Only unexpected failures are logged; permission / limit / validation errors are normal product states.
  if (appErr.code === "UNKNOWN" || appErr.code === "NETWORK") {
    console.error(`[flowpilot]${context ? ` ${context}` : ""}`, appErr.cause ?? appErr);
  }
}
