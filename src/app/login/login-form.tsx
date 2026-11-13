"use client";

import { ArrowRight } from "lucide-react";
import { useActionState, useState } from "react";

import { FormError, PasswordField, PhoneField, SubmitButton } from "@/components/form-fields";
import { signInHospitalManager } from "@/app/actions/auth";
import type { LoginState } from "@/lib/auth/action-types";
import { actionMessage } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";

const initialState: LoginState = { status: "idle" };

export function LoginForm({
  phone,
  onPhoneChange,
  onForgot,
}: {
  phone: string;
  onPhoneChange: (value: string) => void;
  onForgot: () => void;
}) {
  const { t, locale } = useI18n();
  const [state, formAction] = useActionState(signInHospitalManager, initialState);
  const [phoneAttempted, setPhoneAttempted] = useState(false);
  const errorCode = state.status === "error" ? state.code : null;
  const phoneIncomplete = phone.length !== 8;
  const phoneError =
    phoneAttempted && phoneIncomplete
      ? actionMessage(locale, "validation_phone")
      : null;

  return (
    <form
      action={formAction}
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        if (phoneIncomplete) {
          event.preventDefault();
          setPhoneAttempted(true);
        }
      }}
    >
      <FormError code={errorCode} />

      <PhoneField
        value={phone}
        onChange={onPhoneChange}
        hint={t("login.phoneHint")}
        error={phoneError}
      />

      <PasswordField
        name="password"
        label={t("login.passwordLabel")}
        autoComplete="current-password"
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onForgot}
          className="rounded text-sm font-medium text-brand-700 underline-offset-4 transition hover:text-brand-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {t("login.forgot")}
        </button>
      </div>

      <SubmitButton
        label={t("login.submit")}
        pendingLabel={t("login.submitting")}
        icon={
          <ArrowRight
            aria-hidden
            className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
          />
        }
      />
    </form>
  );
}
