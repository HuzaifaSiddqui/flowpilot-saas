import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-stone-800 shadow-card",
  accent: "bg-accent text-white hover:bg-accent-hover shadow-card",
  secondary: "bg-surface text-ink border border-line hover:bg-sunken hover:border-line-strong shadow-card",
  ghost: "text-ink-2 hover:bg-sunken",
  danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-card",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
  icon: "h-9 w-9 justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, type = "button", ...props }, ref,
) {
  return (
    <button
      ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-control font-medium transition-[background,border-color,box-shadow,transform] duration-150",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variants[variant], sizes[size], className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
