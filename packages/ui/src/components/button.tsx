import * as React from "react";
import { cn } from "../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/95",
  secondary: "border border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
  ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
  danger: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
  link: "text-primary underline underline-offset-4 hover:text-primary/80",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 gap-1.5 rounded-md px-3 text-sm",
  md: "min-h-11 gap-2 rounded-md px-4 py-2 text-sm",
  lg: "min-h-12 gap-2 rounded-md px-6 text-base",
};

export function Button({ className, variant = "primary", size = "md", type, ...props }: ButtonProps) {
  return (
    <button
      // Buttons inside a form default to "submit"; anything that is not explicitly a
      // submit button should not accidentally send the form.
      type={type ?? "button"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "link" ? "min-h-0 rounded-sm p-0 text-sm" : SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
