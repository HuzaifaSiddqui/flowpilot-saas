import { cn } from "@/lib/utils";
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-stone-200/70", className)} />;
}
