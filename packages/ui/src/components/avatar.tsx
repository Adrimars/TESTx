import * as React from "react";
import { cn } from "../lib/cn";

export function Avatar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex size-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground", className)}
      {...props}
    />
  );
}
