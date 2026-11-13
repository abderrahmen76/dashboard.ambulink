"use client";

import {
  Ambulance,
  ChartNoAxesCombined,
  FileHeart,
  LayoutDashboard,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { useUnseenReports } from "@/lib/reports/use-unseen";

export type SidebarSection =
  | "dashboard"
  | "missions"
  | "reports"
  | "fleet"
  | "drivers";

type NavItem = { key: MessageKey; icon: LucideIcon; href?: string };

const NAV: NavItem[] = [
  { key: "dc.nav.dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { key: "ma.nav", icon: ChartNoAxesCombined, href: "/missions" },
  { key: "dc.nav.medicalReports", icon: FileHeart, href: "/reports" },
  { key: "dc.nav.fleet", icon: Ambulance, href: "/fleet" },
  { key: "dc.nav.drivers", icon: Users, href: "/drivers" },
];

const subscribeToHydration = () => () => {};

/**
 * The layout shell is streamed before the router hands the pathname to the
 * client, so the active link is only marked after hydration. Both the server
 * render and the first client render then agree on the unmarked markup.
 */
function useHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
}

export function Sidebar({ hospitalName }: { hospitalName: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const { unseenCount, toast, dismissToast } = useUnseenReports();
  const current = hydrated ? (pathname.split("/")[1] ?? "") : "";

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col border-e border-white/10 bg-brand-900 text-white lg:w-60">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-2 lg:px-4">
        <Image
          src="/ambulink_logo.png"
          alt="AmbuLink"
          width={40}
          height={40}
          priority
          className="size-10 shrink-0 rounded-xl bg-white object-contain p-1"
        />
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-sm font-semibold tracking-tight">AmbuLink Clinic</p>
          <p className="truncate text-[11px] text-brand-200">{t("dc.sidebar.workspace")}</p>
        </div>
      </div>

      <nav aria-label={t("dc.sidebar.workspace")} className="mt-3 flex flex-col gap-1 px-2">
        {NAV.map(({ key, icon: Icon, href }) => {
          const active = href === `/${current}`;
          const content = (
            <>
              <Icon aria-hidden className="size-[18px] shrink-0" />
              <span className="hidden truncate lg:inline">{t(key)}</span>
              {href === "/reports" && unseenCount > 0 ? (
                <span
                  aria-label={t("reports.unseen.badge")}
                  className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-600 px-1.5 text-[10px] font-bold tabular-nums text-white"
                >
                  {unseenCount > 99 ? "99+" : unseenCount}
                </span>
              ) : null}
              {!href ? (
                <span className="ms-auto hidden rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-200/80 lg:inline">
                  {t("dc.nav.soon")}
                </span>
              ) : null}
            </>
          );

          if (href) {
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                  active
                    ? "bg-white/12 text-white ring-1 ring-white/15"
                    : "text-brand-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                {content}
              </Link>
            );
          }

          return (
            <span
              key={key}
              aria-disabled
              title={t("dc.nav.soon")}
              className="flex h-11 cursor-not-allowed items-center gap-3 rounded-xl px-3 text-sm font-medium text-brand-200/60"
            >
              {content}
            </span>
          );
        })}
      </nav>

      <div className="mt-auto hidden border-t border-white/10 px-4 py-4 lg:block">
        <p className="text-[11px] uppercase tracking-[0.16em] text-brand-300">AmbuLink</p>
        <p className="mt-1 truncate text-sm font-medium text-white">{hospitalName}</p>
      </div>

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 end-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] items-start gap-2.5 rounded-xl border border-emerald-200 bg-white p-3 text-ink shadow-soft"
        >
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
            <FileHeart aria-hidden className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-brand-900">
              {toast.count === 1
                ? t("reports.unseen.toast", {
                    name: toast.name ?? t("reports.detail.notProvided"),
                  })
                : t("reports.unseen.toastMany", { count: toast.count })}
            </p>
            <Link
              href="/reports"
              className="mt-1 inline-block text-[11px] font-semibold text-brand-700 underline-offset-2 hover:underline"
            >
              {t("dc.nav.medicalReports")}
            </Link>
          </div>
          <button
            type="button"
            onClick={dismissToast}
            aria-label={t("reports.unseen.dismiss")}
            className="grid size-6 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </div>
      ) : null}
    </aside>
  );
}
