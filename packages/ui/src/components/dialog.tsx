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
      className={cn(
        "w-[calc(100%-2rem)] max-w-lg rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-foreground/40",
        className,
      )}
      {...props}
    />
  );
});

/** Dialog title row. Stays pinned when the body scrolls. */
export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-section-title text-foreground", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4", className)}
      {...props}
    />
  );
}
