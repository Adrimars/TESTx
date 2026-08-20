import * as React from "react";
import { cn } from "../lib/cn";

export type FieldProps = {
  /** Shown above the control, so the field still says what it is once it is filled in. */
  label: string;
  /** Small explanation under the control. */
  hint?: React.ReactNode;
  /** Replaces the hint and turns the row red when set. */
  error?: React.ReactNode;
  /** Adds a quiet "optional" marker next to the label. */
  optional?: boolean;
  /** Wire the label to its control when the control is not a nested <input>. */
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
};

export function Field({ label, hint, error, optional, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-sm font-medium text-foreground">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">optional</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Uppercase divider label that opens a group of fields inside a form. */
export function FieldGroupLabel({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-meta uppercase text-muted-foreground", className)}
      {...props}
    />
  );
}
