"use client";

import { CircleAlert, Eye, EyeOff, Loader2, Phone } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { actionMessage } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { sanitizeTunisianPhoneInput } from "@/lib/phone";

const fieldClass =
  "h-12 w-full rounded-xl border border-line bg-surface/70 text-sm text-ink transition focus:border-brand-400 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-60";

const labelClass = "block text-sm font-medium text-brand-900";

export function PhoneField({
  value,
  onChange,
  disabled = false,
  hint,
  error,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  error?: string | null;
  label?: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label ?? t("login.phoneLabel")}
      </label>
      <div className="relative mt-1.5" dir="ltr">
        <Phone
          aria-hidden
          className="pointer-events-none absolute top-1/2 start-3.5 size-4 -translate-y-1/2 text-brand-700"
        />
        <span className="pointer-events-none absolute top-1/2 start-10 -translate-y-1/2 text-sm font-medium text-ink-soft tabular-nums">
          +216
        </span>
        <input
          id={id}
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required
          disabled={disabled}
          value={value}
          onChange={(event) =>
            onChange(sanitizeTunisianPhoneInput(event.target.value))
          }
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          placeholder="12345678"
          className={`${fieldClass} ps-[4.6rem] tracking-[0.08em] ${
            error
              ? "border-accent-500 focus:border-accent-500 focus-visible:ring-accent-100"
              : ""
          }`}
        />
      </div>
      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-ink-soft">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-accent-700"
        >
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField({
  name,
  label,
  autoComplete,
  disabled = false,
}: {
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          dir="ltr"
          autoComplete={autoComplete}
          required
          disabled={disabled}
          className={`${fieldClass} ps-3.5 pe-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? t("login.hidePassword") : t("login.showPassword")}
          aria-pressed={visible}
          disabled={disabled}
          className="absolute top-1/2 end-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-ink-soft transition hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50"
        >
          {visible ? (
            <EyeOff aria-hidden className="size-4" />
          ) : (
            <Eye aria-hidden className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export function FormError({ code }: { code: string | null }) {
  const { locale } = useI18n();
  if (!code) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-accent-100 bg-accent-50 px-3.5 py-3 text-sm text-accent-700"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="leading-relaxed">{actionMessage(locale, code)}</span>
    </div>
  );
}

export function SubmitButton({
  label,
  pendingLabel,
  icon,
}: {
  label: string;
  pendingLabel: string;
  icon?: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-800 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-progress disabled:bg-brand-800/85"
    >
      {pending ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : (
        icon
      )}
      <span>{pending ? pendingLabel : label}</span>
    </button>
  );
}
