import * as React from "react";
import { cn } from "../lib/cn";

export type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number;
};

export function Progress({ className, value = 0, ...props }: ProgressProps) {
  const normalizedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(normalizedValue)}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        className="h-full rounded-full bg-primary transition-all duration-300"
        style={{ width: `${normalizedValue}%` }}
      />
    </div>
  );
}
