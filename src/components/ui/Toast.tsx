import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error";
interface ToastItem { id: number; kind: ToastKind; message: string }
interface ToastApi { success: (m: string) => void; error: (m: string) => void }

const Ctx = createContext<ToastApi | null>(null);
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++counter;
    setItems((l) => [...l.slice(-3), { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === "error" ? 6500 : 3500);
  }, [dismiss]);
  const api = useMemo<ToastApi>(() => ({ success: (m) => push("success", m), error: (m) => push("error", m) }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6">
        {items.map((t) => (
          <div key={t.id} className={cn("fp-pop pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl border bg-surface px-4 py-3 text-sm shadow-pop", t.kind === "error" ? "border-rose-200" : "border-line")}>
            {t.kind === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />}
            <p className="text-ink-2">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="-mr-1 text-faint hover:text-ink"><X className="size-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
