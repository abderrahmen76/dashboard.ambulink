"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Ambulance,
  HeartPulse,
  MapPinned,
  ShieldCheck,
  Users,
} from "lucide-react";

import { ClinicHeader } from "@/components/clinic-header";
import { noticeMessage } from "@/lib/i18n/dictionaries";
import { LocaleProvider, useI18n } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/config";
import { ForgotPasswordPanel } from "./forgot-password-panel";
import { LoginForm } from "./login-form";

export function LoginView({
  initialLocale,
  noticeCode,
}: {
  initialLocale: Locale;
  noticeCode: string | null;
}) {
  return (
    <LocaleProvider initialLocale={initialLocale}>
      <LoginScreen noticeCode={noticeCode} />
    </LocaleProvider>
  );
}

function LoginScreen({ noticeCode }: { noticeCode: string | null }) {
  const { dir, t } = useI18n();

  return (
    <div dir={dir} className="flex min-h-dvh flex-col">
      <ClinicHeader />
      <main className="flex flex-1">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:px-8 lg:py-12">
          <BrandPanel />
          <section className="w-full max-w-md justify-self-center animate-rise motion-reduce:animate-none lg:justify-self-end">
            <AuthCard noticeCode={noticeCode} />
            <p className="mt-5 px-4 text-center text-xs leading-relaxed text-ink-soft">
              {t("panel.trust")}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

function BrandPanel() {
  const { t } = useI18n();

  const capabilities = [
    {
      icon: HeartPulse,
      title: t("panel.capability1.title"),
      body: t("panel.capability1.body"),
    },
    {
      icon: Ambulance,
      title: t("panel.capability2.title"),
      body: t("panel.capability2.body"),
    },
    {
      icon: Users,
      title: t("panel.capability3.title"),
      body: t("panel.capability3.body"),
    },
    {
      icon: MapPinned,
      title: t("panel.capability4.title"),
      body: t("panel.capability4.body"),
    },
  ];

  return (
    <aside className="relative hidden overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 p-8 text-white shadow-card lg:block xl:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -end-24 -top-24 size-72 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -start-20 size-72 rounded-full bg-accent-600/25 blur-3xl"
      />
      <div className="relative">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-100 ring-1 ring-white/15">
          <span aria-hidden className="size-1.5 rounded-full bg-accent-500" />
          {t("panel.eyebrow")}
        </p>
        <h1 className="mt-5 max-w-md text-3xl font-semibold leading-tight tracking-tight text-white xl:text-[2.5rem]">
          {t("panel.headline")}
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-brand-100/90">
          {t("panel.description")}
        </p>

        <div className="mt-7 overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-white/30">
          <Image
            src="/illustration/dispatch.svg"
            alt={t("panel.illustrationAlt")}
            width={960}
            height={600}
            priority
            unoptimized
            className="h-auto w-full"
          />
        </div>

        <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-200">
          {t("panel.capabilitiesTitle")}
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {capabilities.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 text-brand-100 ring-1 ring-white/15">
                <Icon aria-hidden className="size-4" strokeWidth={1.8} />
              </span>
              <span>
                <span className="block text-sm font-medium text-white">
                  {title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-brand-200">
                  {body}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function AuthCard({ noticeCode }: { noticeCode: string | null }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [phone, setPhone] = useState("");
  const isReset = mode === "reset";

  return (
    <div className="rounded-[1.75rem] border border-line/70 bg-white p-6 shadow-card sm:p-8">
      <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700 ring-1 ring-brand-100">
        <ShieldCheck aria-hidden className="size-3.5" />
        {t("login.badge")}
      </p>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-brand-900">
        {isReset ? t("reset.title") : t("login.title")}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
        {isReset ? t("reset.subtitle") : t("login.subtitle")}
      </p>

      <div className="mt-6 space-y-4">
        {!isReset && noticeCode ? <SessionNotice code={noticeCode} /> : null}
        {isReset ? (
          <ForgotPasswordPanel
            phone={phone}
            onPhoneChange={setPhone}
            onBack={() => setMode("signin")}
          />
        ) : (
          <LoginForm
            phone={phone}
            onPhoneChange={setPhone}
            onForgot={() => setMode("reset")}
          />
        )}
      </div>

      <p className="mt-6 border-t border-line/70 pt-4 text-center text-[11px] leading-relaxed text-ink-soft">
        {t("login.provisionNote")}
      </p>
      <p className="mt-1 text-center text-[11px] font-medium text-brand-700">
        {t("login.secure")}
      </p>
    </div>
  );
}

function SessionNotice({ code }: { code: string }) {
  const { locale } = useI18n();

  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50 px-3.5 py-3 text-sm text-brand-800"
    >
      <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className="leading-relaxed">{noticeMessage(locale, code)}</span>
    </div>
  );
}
