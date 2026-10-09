import type { LucideIcon } from "lucide-react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { toAppError } from "@/lib/errors";

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-sunken text-muted"><Icon className="size-5" aria-hidden /></div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Consistent failure state with a retry action. Never shows raw error text. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = toAppError(error);
  return (
    <div role="alert" className="flex flex-col items-center justify-center rounded-card border border-rose-200 bg-rose-50/50 px-6 py-12 text-center">
      <AlertTriangle className="mb-3 size-6 text-rose-600" aria-hidden />
      <h3 className="text-[15px] font-semibold">Couldn't load this</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-2">{e.message}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}><RefreshCw className="size-3.5" />Try again</Button>}
    </div>
  );
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-16" />)}
    </div>
  );
}
