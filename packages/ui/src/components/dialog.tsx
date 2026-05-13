import * as React from "react";
import { cn } from "../lib/cn";

export type DialogProps = React.DialogHTMLAttributes<HTMLDialogElement>;

export function Dialog({ className, ...props }: DialogProps) {
  return (
    <dialog
      className={cn("w-full max-w-lg rounded-lg border border-border bg-card p-0 text-card-foreground backdrop:bg-black/40", className)}
      {...props}
    />
  );
}
