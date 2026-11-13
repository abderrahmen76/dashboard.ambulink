"use client";

import { Loader2, TriangleAlert, UserPlus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { createHospitalDriver } from "@/app/actions/drivers";
import { driverCreateErrorMessageKey } from "@/lib/drivers/messages";
import type { CreateHospitalDriverErrorCode } from "@/lib/drivers/types";
import { useI18n } from "@/lib/i18n/provider";
import { sanitizeTunisianPhoneInput } from "@/lib/phone";

const fieldClass =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-brand-900 placeholder:text-ink-soft/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

export function DriverCreateDialog({
  hospitalName,
  onClose,
  onCreated,
}: {
  hospitalName: string;
  onClose: () => void;
  onCreated: (fullName: string) => void;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const [fullName, setFullName] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ownershipVerified, setOwnershipVerified] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<CreateHospitalDriverErrorCode | null>(
    null,
  );
  const aliveRef = useRef(true);
  const submittingRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    aliveRef.current = true;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      aliveRef.current = false;
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPending(true);
    setErrorCode(null);

    const name = fullName.trim();
    const trimmedPassword = password.trim();
    const code: CreateHospitalDriverErrorCode | null =
      !name || name.length > 120
        ? "validation_name"
        : phoneDigits.length !== 8
          ? "validation_phone"
          : trimmedPassword.length < 6
            ? "validation_passwordLength"
            : trimmedPassword !== confirmation.trim()
              ? "validation_passwordMismatch"
              : !ownershipVerified
                ? "validation_phoneOwnership"
                : null;

    if (code) {
      submittingRef.current = false;
      setPending(false);
      setErrorCode(code);
      return;
    }

    const result = await createHospitalDriver({
      fullName: name,
      phoneDigits,
      password,
      passwordConfirmation: confirmation,
      phoneOwnershipVerified: ownershipVerified,
    });
    submittingRef.current = false;
    if (!aliveRef.current) return;
    setPending(false);
    if (result.ok) {
      onCreated(name);
      return;
    }
    setErrorCode(result.code);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-900/50 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mt-6 w-full max-w-lg rounded-2xl bg-white shadow-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-brand-900">
              {t("drivers.create.title")}
            </h2>
            <p className="mt-0.5 truncate text-xs text-ink-soft">
              {t("drivers.create.subtitle", { hospital: hospitalName })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label={t("dc.details.close")}
            className="grid size-8 place-items-center rounded-lg text-ink-soft transition hover:bg-surface hover:text-brand-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="space-y-3 px-5 py-4"
        >
          <div className="rounded-xl border border-line/70 bg-surface/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
              {t("drivers.create.hospital")}
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-brand-900">
              {hospitalName}
            </p>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-brand-900">
              {t("drivers.create.name")}
            </span>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={120}
              disabled={pending}
              autoComplete="off"
              className={fieldClass}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-brand-900">
              {t("drivers.create.phone")}
            </span>
            <div className="flex h-10 items-center overflow-hidden rounded-lg border border-line bg-white focus-within:ring-2 focus-within:ring-brand-500">
              <span className="grid h-full place-items-center border-e border-line bg-surface/60 px-3 text-sm font-medium text-ink-soft">
                +216
              </span>
              <input
                type="tel"
                inputMode="numeric"
                value={phoneDigits}
                onChange={(event) =>
                  setPhoneDigits(sanitizeTunisianPhoneInput(event.target.value))
                }
                placeholder="12 345 678"
                disabled={pending}
                autoComplete="off"
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-brand-900 placeholder:text-ink-soft/70 focus:outline-none"
              />
            </div>
            <span className="mt-1 block text-[11px] text-ink-soft">
              {t("drivers.create.phoneHint")}
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-brand-900">
              {t("drivers.create.password")}
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={pending}
              autoComplete="new-password"
              className={fieldClass}
            />
            <span className="mt-1 block text-[11px] text-ink-soft">
              {t("drivers.create.passwordHint")}
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-brand-900">
              {t("drivers.create.confirmPassword")}
            </span>
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={pending}
              autoComplete="new-password"
              className={fieldClass}
            />
          </label>

          <label className="flex items-start gap-2.5 rounded-xl border border-line/70 bg-surface/60 px-3 py-2.5">
            <input
              type="checkbox"
              checked={ownershipVerified}
              onChange={(event) => setOwnershipVerified(event.target.checked)}
              disabled={pending}
              className="mt-0.5 size-4 accent-brand-800"
            />
            <span className="min-w-0 text-[11px] leading-relaxed text-ink-soft">
              {t("drivers.create.verifyOwnership")}
            </span>
          </label>

          {errorCode ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-accent-100 bg-accent-50 px-3 py-2 text-xs font-medium text-accent-700"
            >
              <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {t(driverCreateErrorMessageKey(errorCode))}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-3.5 text-sm font-semibold text-brand-900 transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
            >
              {t("dc.new.cancel")}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-800 px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <UserPlus aria-hidden className="size-4" />
              )}
              {pending ? t("drivers.create.submitting") : t("drivers.create.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
