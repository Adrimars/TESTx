"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../lib/cn";
import { Input, type InputProps } from "./input";

export type PasswordInputProps = Omit<InputProps, "type"> & {
  /** Controlled reveal state, so several password fields can share one toggle. */
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
};

/** Password field with the show/hide eye control built in. */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, visible, onVisibleChange, ...props }, ref) {
    const [internalVisible, setInternalVisible] = React.useState(false);
    const isControlled = visible !== undefined;
    const isVisible = isControlled ? visible : internalVisible;

    function toggle() {
      if (isControlled) onVisibleChange?.(!visible);
      else setInternalVisible((current) => !current);
    }

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={isVisible ? "text" : "password"}
          className={cn("pr-11", className)}
          {...props}
        />
        <button
          type="button"
          onClick={toggle}
          tabIndex={-1}
          aria-label={isVisible ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {isVisible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    );
  },
);
