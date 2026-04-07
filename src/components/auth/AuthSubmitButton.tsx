"use client";

import { Loader } from "lucide-react";
import { useFormStatus } from "react-dom";

type Props = {
  label: string;
  className?: string;
};

export function AuthSubmitButton({ label, className }: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} flex items-center justify-center gap-2 transition-all active:scale-[0.985] disabled:opacity-70`}
    >
      {pending ? (
        <>
          <Loader size={18} className="animate-spin" />
          <span>Please wait...</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}
