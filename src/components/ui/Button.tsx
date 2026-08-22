import { cn } from "@/lib/cn";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "default" | "accent" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  default: "border-border-bright bg-panel-2 text-text hover:border-accent-dim hover:bg-panel",
  accent: "border-accent-dim bg-transparent text-accent hover:bg-accent/10",
  ghost: "border-transparent bg-transparent text-text-dim hover:bg-panel-2 hover:text-text",
  danger: "border-err/40 bg-transparent text-err hover:bg-err/10",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "focus-ring inline-flex select-none items-center justify-center gap-2 border px-3 py-1.5 text-xs uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        size === "sm" && "px-2 py-1 text-xs",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
