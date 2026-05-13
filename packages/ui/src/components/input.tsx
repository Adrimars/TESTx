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
        "min-h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary transition focus:ring-2",
        className,
      )}
      {...props}
    />
  );
});
