import * as React from "react";
import { cn } from "../lib/cn";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "min-h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary transition focus:ring-2",
        className,
      )}
      {...props}
    />
  );
});
