import * as React from "react";
import { cn } from "../lib/cn";

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required: the button shows no text, so it needs an accessible name. */
  "aria-label": string;
  variant?: "ghost" | "surface" | "danger";
};

const VARIANTS = {
  ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
  surface: "border border-border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground",
  danger: "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
} as const;

export function IconButton({ className, variant = "ghost", type, ...props }: IconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
