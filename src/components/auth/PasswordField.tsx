"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordFieldProps = {
  name: string;
  id: string;
  placeholder: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  className?: string;
};

export function PasswordField({
  name,
  id,
  placeholder,
  autoComplete,
  minLength = 8,
  className,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative w-full">
      <input
        id={id}
        type={visible ? "text" : "password"}
        name={name}
        required
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={className}
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setVisible((prev) => !prev);
        }}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
