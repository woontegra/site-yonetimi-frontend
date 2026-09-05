"use client";

import { useState, type InputHTMLAttributes, type Ref } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

type AuthPasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
};

export function AuthPasswordField({ className, invalid, ref, ...props }: AuthPasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <input
        {...props}
        ref={ref}
        type={visible ? "text" : "password"}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-invalid={invalid || undefined}
        className={cn("auth-native-input min-w-0 flex-1", className)}
      />
      <button
        type="button"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-muted hover:text-ink md:size-9 md:rounded-lg"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
