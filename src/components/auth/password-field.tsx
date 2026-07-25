"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface PasswordFieldProps {
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
  helperText?: string;
  id?: string;
  label: string;
  minLength?: number;
  onChange: (value: string) => void;
  value: string;
}

export function PasswordField({
  autoComplete,
  disabled,
  helperText,
  id = "password",
  label,
  minLength,
  onChange,
  value,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const helperId = helperText ? `${id}-helper` : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name="password"
          type={isVisible ? "text" : "password"}
          autoComplete={autoComplete}
          aria-describedby={helperId}
          className="h-11 pr-11"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={minLength}
          disabled={disabled}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-[var(--skilio-ink-muted)] transition-colors hover:text-[var(--skilio-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--skilio-brand)] disabled:pointer-events-none disabled:opacity-50"
          onClick={() => setIsVisible((visible) => !visible)}
          aria-label={isVisible ? "Hide password" : "Show password"}
          aria-pressed={isVisible}
          disabled={disabled}
        >
          {isVisible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {helperText && (
        <p id={helperId} className="text-xs leading-5 text-[var(--skilio-ink-muted)]">
          {helperText}
        </p>
      )}
    </div>
  );
}
