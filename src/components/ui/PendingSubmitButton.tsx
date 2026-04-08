"use client";

import { Loader2 } from "lucide-react";
import { type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = {
  className?: string;
  children: ReactNode;
  pendingChildren?: ReactNode;
  disabled?: boolean;
};

export function PendingSubmitButton({
  className,
  children,
  pendingChildren,
  disabled,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={className}
    >
      {pending ? (
        pendingChildren ?? (
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            <span>Please wait...</span>
          </span>
        )
      ) : (
        children
      )}
    </button>
  );
}