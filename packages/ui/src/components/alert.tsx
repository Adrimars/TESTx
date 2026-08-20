"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "../lib/cn";

export type AlertTone = "danger" | "success" | "warning" | "info";

const TONES: Record<AlertTone, { box: string; icon: React.ElementType }> = {
  danger: { box: "border-destructive/25 bg-destructive/5 text-destructive", icon: AlertCircle },
  success: { box: "border-success/25 bg-success/5 text-success", icon: CheckCircle2 },
  warning: { box: "border-warning/25 bg-warning/5 text-warning", icon: TriangleAlert },
  info: { box: "border-border bg-surface text-muted-foreground", icon: Info },
};

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: AlertTone;
  title?: React.ReactNode;
};

/** One consistent shape for every inline error / confirmation message. */
export function Alert({ className, tone = "danger", title, children, ...props }: AlertProps) {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-md border p-3 text-sm", box, className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}
