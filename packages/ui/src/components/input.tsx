import * as React from "react";
import { cn } from "../lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors",
        "placeholder:text-muted-foreground/80",
        "outline-none focus:border-ring focus:ring-2 focus:ring-ring/30",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
});
