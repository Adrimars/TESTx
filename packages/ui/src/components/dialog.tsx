import * as React from "react";
import { cn } from "../lib/cn";

export type DialogProps = React.DialogHTMLAttributes<HTMLDialogElement>;

export const Dialog = React.forwardRef<HTMLDialogElement, DialogProps>(function Dialog(
  { className, ...props },
  ref
) {
  return (
    <dialog
      ref={ref}
      className={cn("w-full max-w-lg rounded-lg border border-border bg-card p-0 text-card-foreground backdrop:bg-black/40", className)}
      {...props}
    />
  );
});
