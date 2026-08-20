import * as React from "react";
import { cn } from "../lib/cn";

export type StatTone = "default" | "primary" | "danger" | "success";

const TONES: Record<StatTone, string> = {
  default: "text-foreground",
  primary: "text-primary",
  danger: "text-destructive",
  success: "text-success",
};

export type StatCardProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: StatTone;
  className?: string;
};

/** Label-over-number tile. Used for dashboard counters and test summaries. */
export function StatCard({ label, value, hint, tone = "default", className }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5 shadow-sm", className)}>
      <p className="text-meta uppercase text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 text-stat tabular-nums", TONES[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
