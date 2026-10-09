import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max, `Keep it under ${max} characters`).optional().or(z.literal("")).transform((v) => (v ? v : undefined));

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password") });
export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(120),
  email: emailSchema,
  password: passwordSchema,
});
export const resetSchema = z.object({ email: emailSchema });

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Give the project a name").max(120, "Keep it under 120 characters"),
  description: optionalText(2000),
  clientId: z.string().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  dueDate: z.string().optional().or(z.literal("")).transform((v) => (v ? v : null)),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200, "Keep it under 200 characters"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["todo", "in_progress", "review", "done"]),
  assignedTo: z.string().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  dueDate: z.string().optional().or(z.literal("")).transform((v) => (v ? v : null)),
});

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  company: optionalText(120),
  notes: optionalText(2000),
});

export const workspaceSchema = z.object({ name: z.string().trim().min(2, "At least 2 characters").max(80, "Keep it under 80 characters") });
export const inviteSchema = z.object({ email: emailSchema, role: z.enum(["admin", "member"]) });

/** Flatten a zod error into { field: message } for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
