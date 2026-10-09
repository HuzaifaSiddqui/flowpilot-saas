import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#0c0a09" />
      <path d="M9 21.5 16 8l7 13.5-7-3.2z" fill="#fafaf9" />
      <path d="M16 18.3 23 21.5 16 24z" fill="#6366f1" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <LogoMark className="size-7" />
      <span className="text-[17px]">FlowPilot</span>
    </span>
  );
}
