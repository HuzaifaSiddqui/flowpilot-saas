import { cn, initials } from "@/lib/utils";

const tones = ["bg-indigo-100 text-indigo-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700"];
const toneFor = (seed: string) => tones[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length];

export function Avatar({ name, size = "md", className }: { name: string; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const dim = { xs: "size-5 text-[9px]", sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-11 text-sm" }[size];
  return (
    <span title={name} aria-label={name} role="img" className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ring-2 ring-surface", dim, toneFor(name), className)}>
      {initials(name)}
    </span>
  );
}
