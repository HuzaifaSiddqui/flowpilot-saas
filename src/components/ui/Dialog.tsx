import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface DialogProps { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; className?: string }

/** Native <dialog>: focus trap, Esc to close and inert background come from the platform. */
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onMouseDown={(e) => { if (e.target === ref.current) onClose(); }}
      aria-labelledby="dialog-title"
      className={cn("m-auto w-[min(92vw,30rem)] rounded-2xl border border-line bg-surface p-0 shadow-pop", open && "fp-pop", className)}
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 id="dialog-title" className="text-lg font-semibold">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog" className="-mr-2 -mt-1"><X className="size-4" /></Button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel = "Confirm", destructive, loading,
}: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description: string; confirmLabel?: string; destructive?: boolean; loading?: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}
