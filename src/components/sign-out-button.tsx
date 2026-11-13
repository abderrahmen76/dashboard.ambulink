"use client";

import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";

import { signOutHospitalManager } from "@/app/actions/auth";
import { useI18n } from "@/lib/i18n/provider";

function SignOutSubmit() {
  const { pending } = useFormStatus();
  const { t } = useI18n();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white px-3 text-sm font-medium text-brand-900 transition hover:border-brand-300 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-progress disabled:opacity-60 sm:px-4"
    >
      <LogOut aria-hidden className="size-4" />
      <span className="hidden sm:inline">
        {pending ? t("dashboard.signingOut") : t("dashboard.signOut")}
      </span>
      <span className="sr-only sm:hidden">
        {pending ? t("dashboard.signingOut") : t("dashboard.signOut")}
      </span>
    </button>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutHospitalManager}>
      <SignOutSubmit />
    </form>
  );
}
