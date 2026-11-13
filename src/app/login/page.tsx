import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getHospitalManagerOrNull } from "@/lib/auth/require-manager";
import { getRequestLocale } from "@/lib/i18n/server";
import { LoginSkeleton } from "./login-skeleton";
import { LoginView } from "./login-view";

export const metadata: Metadata = {
  title: "Sign in",
};

type LoginSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default function LoginPage({
  searchParams,
}: {
  searchParams: LoginSearchParams;
}) {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({
  searchParams,
}: {
  searchParams: LoginSearchParams;
}) {
  // An already verified manager never sees the form.
  const manager = await getHospitalManagerOrNull();
  if (manager) redirect("/dashboard");

  const [locale, params] = await Promise.all([getRequestLocale(), searchParams]);
  const reason = typeof params.reason === "string" ? params.reason : null;
  const noticeCode = params.signedOut === "1" ? "signed_out" : reason;

  return <LoginView initialLocale={locale} noticeCode={noticeCode} />;
}
