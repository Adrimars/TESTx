"use client";

import * as React from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";

export type ConfirmDialogProps = {
  title: string;
  description?: React.ReactNode;
  /** Extra warning shown in a tinted box under the description. */
  warning?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  busyLabel?: string;
  error?: React.ReactNode;
  onConfirm: () => void;
  onCancel?: () => void;
};

/**
 * One shape for every "are you sure?" step, so destructive actions never fall
 * back to window.confirm or fire with no confirmation at all.
 * Open it with `ref.current?.showModal()`.
 */
export const ConfirmDialog = React.forwardRef<HTMLDialogElement, ConfirmDialogProps>(
  function ConfirmDialog(
    {
      title,
      description,
      warning,
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      tone = "primary",
      busy = false,
      busyLabel,
      error,
      onConfirm,
      onCancel,
    },
    ref,
  ) {
    const innerRef = React.useRef<HTMLDialogElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLDialogElement);

    function handleCancel() {
      innerRef.current?.close();
      onCancel?.();
    }

    return (
      <Dialog ref={innerRef} className="max-w-md">
        <div className="space-y-4 p-5">
          <div className="space-y-1.5">
            <h2 className="text-section-title text-foreground">{title}</h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>

          {warning && (
            <p className="rounded-md border border-warning/25 bg-warning/5 p-3 text-sm text-warning">
              {warning}
            </p>
          )}

          {error && (
            <p className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={handleCancel} disabled={busy}>
              {cancelLabel}
            </Button>
            <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
              {busy ? busyLabel ?? "Working…" : confirmLabel}
            </Button>
          </div>
        </div>
      </Dialog>
    );
  },
);
