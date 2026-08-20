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
        "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors",
        "outline-none focus:border-ring focus:ring-2 focus:ring-ring/30",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
});
