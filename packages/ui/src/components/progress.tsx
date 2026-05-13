import * as React from "react";
import { cn } from "../lib/cn";

export type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number;
};

export function Progress({ className, value = 0, ...props }: ProgressProps) {
  const normalizedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)} {...props}>
      <div className="h-full bg-primary transition-all" style={{ width: `${normalizedValue}%` }} />
    </div>
  );
}
