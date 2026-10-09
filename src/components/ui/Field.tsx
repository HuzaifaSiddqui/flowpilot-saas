import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-control border bg-surface px-3 text-sm text-ink placeholder:text-faint transition-colors " +
  "border-line hover:border-line-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:bg-sunken disabled:text-muted";

interface FieldShellProps { label: string; error?: string; hint?: string; children: (id: string, describedBy?: string) => ReactNode; className?: string }

/** Label + control + inline error. Errors are announced to screen readers via role="alert". */
export function Field({ label, error, hint, children, className }: FieldShellProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink-2">{label}</label>
      {children(id, error || hint ? msgId : undefined)}
      {error ? <p id={msgId} role="alert" className="text-xs text-rose-600">{error}</p>
        : hint ? <p id={msgId} className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, "h-10", invalid && "border-rose-400 focus:border-rose-500 focus:ring-rose-100", className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(control, "min-h-[88px] resize-y py-2.5", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select ref={ref} className={cn(control, "h-10 appearance-none pr-9", className)} {...props}>{children}</select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      </div>
    );
  },
);
