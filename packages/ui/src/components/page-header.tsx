import * as React from "react";
import { cn } from "../lib/cn";

export type PageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Badges or status chips shown next to the title. */
  meta?: React.ReactNode;
  /** Buttons pushed to the right on wide screens, wrapped underneath on narrow ones. */
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, meta, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-page-title text-foreground">{title}</h1>
          {meta}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
