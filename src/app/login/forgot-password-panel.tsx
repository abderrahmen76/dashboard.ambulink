"use client";

import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useActionState, useId, useState } from "react";

import {
  FormError,
  PasswordField,
  PhoneField,
  SubmitButton,
} from "@/components/form-fields";
import { requestHospitalManagerPasswordReset } from "@/app/actions/auth";
import type { ResetState } from "@/lib/auth/action-types";
import { actionMessage } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";

const initialState: ResetState = { status: "idle" };

export function ForgotPasswordPanel({
  phone,
  onPhoneChange,
  onBack,
}: {
  phone: string;
  onPhoneChange: (value: string) => void;
  onBack: () => void;
}) {
  const { t, locale } = useI18n();
  const explanationId = useId();
  const [state, formAction] = useActionState(
    requestHospitalManagerPasswordReset,
    initialState,
  );
  const [phoneAttempted, setPhoneAttempted] = useState(false);
  const errorCode = state.status === "error" ? state.code : null;
  const phoneIncomplete = phone.length !== 8;
  const phoneError =
    phoneAttempted && phoneIncomplete
      ? actionMessage(locale, "validation_phone")
      : null;

  return (
    <div className="animate-rise motion-reduce:animate-none">
      {state.status === "sent" ? (
        <div
          role="status"
          className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-5 text-center"
        >
          <CheckCircle2
            aria-hidden
            className="mx-auto size-8 text-brand-700"
            strokeWidth={1.7}
          />
          <p className="mt-3 text-sm font-semibold text-brand-900">
            {t("reset.sentTitle")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {t("reset.sentBody")}
          </p>
        </div>
      ) : (
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
            error={phoneError}
          />

          <PasswordField
            name="newPassword"
            label={t("reset.newPassword")}
            autoComplete="new-password"
          />
          <PasswordField
            name="confirmPassword"
            label={t("reset.confirmPassword")}
            autoComplete="new-password"
          />

          <div>
            <label
              htmlFor={explanationId}
              className="block text-sm font-medium text-brand-900"
            >
              {t("reset.explanation")}
            </label>
            <textarea
              id={explanationId}
              name="explanation"
              rows={3}
              maxLength={1000}
              placeholder={t("reset.explanationPlaceholder")}
              className="mt-1.5 w-full resize-none rounded-xl border border-line bg-surface/70 px-3.5 py-3 text-sm text-ink transition focus:border-brand-400 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            />
          </div>

          <SubmitButton
            label={t("reset.submit")}
            pendingLabel={t("reset.submitting")}
          />
        </form>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded text-sm font-medium text-brand-700 transition hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        {t("reset.back")}
      </button>
    </div>
  );
}
