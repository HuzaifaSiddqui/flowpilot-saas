import { lazy, Suspense, useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/features/auth/AuthProvider";
import { WorkspaceProvider } from "@/features/workspaces/WorkspaceProvider";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorState } from "@/components/ui/States";
import { toAppError, reportError } from "@/lib/errors";
import { NoWorkspace } from "@/routes/NoWorkspace";

// Route-level code splitting keeps the first load small (Supabase + Stripe-related code loads on demand).
const Landing = lazy(() => import("@/routes/Landing"));
const Login = lazy(() => import("@/routes/auth").then((m) => ({ default: m.Login })));
const Signup = lazy(() => import("@/routes/auth").then((m) => ({ default: m.Signup })));
const ForgotPassword = lazy(() => import("@/routes/auth").then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import("@/routes/auth").then((m) => ({ default: m.ResetPassword })));
const Dashboard = lazy(() => import("@/routes/Dashboard"));
const Projects = lazy(() => import("@/routes/Projects"));
const ProjectDetail = lazy(() => import("@/routes/ProjectDetail"));
const Clients = lazy(() => import("@/routes/Clients"));
const Team = lazy(() => import("@/routes/Team"));
const Billing = lazy(() => import("@/routes/Billing"));
const SettingsPage = lazy(() => import("@/routes/Settings"));
const NotFound = lazy(() => import("@/routes/NotFound"));

declare module "@tanstack/react-query" {
  interface Register { mutationMeta: { silent?: boolean } }
}

function Spinner() {
  return <div role="status" aria-label="Loading" className="flex min-h-dvh items-center justify-center"><Loader2 className="size-6 animate-spin text-faint" /></div>;
}

function QueryProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 20_000, refetchOnWindowFocus: false,
        retry: (count, err) => { const c = toAppError(err).code; return count < 2 && (c === "NETWORK" || c === "UNKNOWN"); },
      },
    },
    queryCache: new QueryCache({ onError: (err) => reportError(err, "query") }),
    // Every failed mutation surfaces a safe message — unless the caller handles it itself (meta.silent).
    mutationCache: new MutationCache({
      onError: (err, _vars, _ctx, mutation) => {
        reportError(err, "mutation");
        if (!mutation.meta?.silent) toast.error(toAppError(err).message);
      },
    }),
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Redirects signed-out visitors to /login and remembers where they were going. */
function ProtectedLayout() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Spinner />;
  if (status === "anon") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return (
    <WorkspaceProvider>
      {({ loading, error, retry, empty }) =>
        loading ? <Spinner />
        : error ? <div className="mx-auto max-w-lg px-6 py-24"><ErrorState error={error} onRetry={retry} /></div>
        : empty ? <NoWorkspace />
        : <AppShell><Suspense fallback={<div className="py-24"><Loader2 className="mx-auto size-5 animate-spin text-faint" /></div>}><Outlet /></Suspense></AppShell>}
    </WorkspaceProvider>
  );
}

/** Keeps signed-in users out of /login and /signup. */
function PublicOnly() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Spinner />;
  if (status === "authed") return <Navigate to={(location.state as { from?: string } | null)?.from ?? "/dashboard"} replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <QueryProvider>
          <AuthProvider>
            <BrowserRouter>
              <Suspense fallback={<Spinner />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route element={<PublicOnly />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                </Route>
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route element={<ProtectedLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/projects/:id" element={<ProjectDetail />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/team" element={<Team />} />
                  <Route path="/billing" element={<Billing />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </AuthProvider>
        </QueryProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
