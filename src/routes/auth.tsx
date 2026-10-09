import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, MailCheck, ShieldCheck, Layers, CreditCard } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useAuth } from "@/features/auth/AuthProvider";
import { api, isDemo } from "@/services";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/services/demoSeed";
import { fieldErrors, loginSchema, passwordSchema, resetSchema, signupSchema } from "@/lib/validation";
import { toAppError, reportError } from "@/lib/errors";

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" aria-label="FlowPilot home"><Logo /></Link>
        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-12">
          <h1 className="text-[28px] font-semibold leading-tight">{title}</h1>
          <p className="mb-8 mt-2 text-[15px] text-muted">{subtitle}</p>
          {children}
          {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
        </div>
      </div>
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between" aria-hidden>
        <div className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-[360px] rounded-full bg-indigo-400/10 blur-3xl" />
        <p className="relative max-w-sm text-[28px] font-semibold leading-[1.2] tracking-tight">Clients, projects and teams — in one calm workspace.</p>
        <ul className="relative space-y-4 text-[15px] text-stone-300">
          {[
            [Layers, "Isolated workspaces", "Every tenant's data is separated at the database level."],
            [ShieldCheck, "Roles that are actually enforced", "Owner, admin and member permissions live in Postgres policies."],
            [CreditCard, "Billing that checks itself", "Plan limits come from verified Stripe webhooks, not the UI."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Layers;
            return (
              <li key={t as string} className="flex gap-3.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10"><I className="size-4 text-indigo-200" /></span>
                <span><span className="block font-medium text-white">{t as string}</span><span className="text-sm text-stone-400">{d as string}</span></span>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string>();
  async function run(fn: () => Promise<void>) {
    setBusy(true); setFormError(undefined);
    try { await fn(); } catch (err) { reportError(err, "auth"); setFormError(toAppError(err).message); } finally { setBusy(false); }
  }
  return { busy, formError, run, setFormError };
}

const FormError = ({ message }: { message?: string }) => message ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p> : null;

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, formError, run } = useSubmit();

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    setErrors({});
    void run(() => signIn(parsed.data.email, parsed.data.password));
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your workspace." footer={<>New to FlowPilot? <Link to="/signup" className="font-medium text-accent hover:underline">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Email" error={errors.email}>{(id, d) => <Input id={id} aria-describedby={d} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" invalid={Boolean(errors.email)} />}</Field>
        <Field label="Password" error={errors.password}>{(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={Boolean(errors.password)} />}</Field>
        <div className="flex justify-end"><Link to="/forgot-password" className="text-[13px] font-medium text-muted hover:text-ink">Forgot password?</Link></div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button>
        {isDemo && (
          <>
            <div className="relative py-1 text-center text-xs text-faint before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-line"><span className="relative bg-canvas px-3">or</span></div>
            <Button variant="secondary" size="lg" className="w-full" disabled={busy} onClick={() => { setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); void run(() => signIn(DEMO_EMAIL, DEMO_PASSWORD)); }} data-testid="demo-login">
              Continue with demo account
            </Button>
          </>
        )}
      </form>
    </AuthLayout>
  );
}

export function Signup() {
  const { signUp } = useAuth();
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const { busy, formError, run } = useSubmit();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    setErrors({});
    void run(async () => { const r = await signUp(parsed.data.fullName, parsed.data.email, parsed.data.password); if (r.needsConfirmation) setSent(true); });
  }

  if (sent) {
    return (
      <AuthLayout title="Check your inbox" subtitle={`We sent a verification link to ${form.email}. Open it to activate your account.`} footer={<Link to="/login" className="font-medium text-accent hover:underline">Back to sign in</Link>}>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-ink-2"><MailCheck className="size-5 text-accent" aria-hidden />The link expires in 24 hours.</div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Create your account" subtitle="Free forever for small teams. No card needed." footer={<>Already have an account? <Link to="/login" className="font-medium text-accent hover:underline">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Full name" error={errors.fullName}>{(id, d) => <Input id={id} aria-describedby={d} autoComplete="name" value={form.fullName} onChange={set("fullName")} placeholder="Alex Morgan" invalid={Boolean(errors.fullName)} />}</Field>
        <Field label="Work email" error={errors.email}>{(id, d) => <Input id={id} aria-describedby={d} type="email" autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@company.com" invalid={Boolean(errors.email)} />}</Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters, with a letter and a number.">{(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={form.password} onChange={set("password")} invalid={Boolean(errors.password)} />}</Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Create account</Button>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const { busy, formError, run } = useSubmit();

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = resetSchema.safeParse({ email });
    if (!parsed.success) { setError(fieldErrors(parsed.error).email); return; }
    setError(undefined);
    void run(async () => { await api.auth.resetPassword(parsed.data.email); setDone(true); });
  }
  const back = <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-ink-2 hover:text-ink"><ArrowLeft className="size-3.5" />Back to sign in</Link>;
  if (done) {
    return (
      <AuthLayout title="Reset link sent" subtitle="If an account exists for that email, a reset link is on its way." footer={back}>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-ink-2"><CheckCircle2 className="size-5 text-emerald-600" aria-hidden />Check {email}</div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we'll send a reset link." footer={back}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="Email" error={error}>{(id, d) => <Input id={id} aria-describedby={d} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={Boolean(error)} />}</Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
      </form>
    </AuthLayout>
  );
}

export function ResetPassword() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, formError, run } = useSubmit();

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    const next: Record<string, string> = {};
    if (!parsed.success) next.password = parsed.error.issues[0].message;
    if (password !== confirm) next.confirm = "Passwords don't match";
    setErrors(next);
    if (Object.keys(next).length) return;
    void run(async () => { await api.auth.updatePassword(password); nav("/dashboard", { replace: true }); });
  }
  return (
    <AuthLayout title="Choose a new password" subtitle="You'll be signed in right after.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={formError} />
        <Field label="New password" error={errors.password}>{(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={Boolean(errors.password)} />}</Field>
        <Field label="Confirm password" error={errors.confirm}>{(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={Boolean(errors.confirm)} />}</Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Update password</Button>
      </form>
    </AuthLayout>
  );
}
