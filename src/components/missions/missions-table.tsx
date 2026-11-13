"use client";

import { ChevronLeft, ChevronRight, Flag, Inbox, MapPin, SearchX } from "lucide-react";

import { useI18n } from "@/lib/i18n/provider";
import { formatMissionDateTime, shortReference } from "@/lib/missions/format";
import type { MissionRow, MissionsPageSize } from "@/lib/missions/types";

import { MissionStatusPill } from "./mission-status-pill";

const PAGE_SIZES: MissionsPageSize[] = [10, 25, 50];

export function MissionsTable({
  items,
  total,
  page,
  pageSize,
  filtered,
  onOpen,
  onPage,
  onPageSize,
}: {
  items: MissionRow[];
  total: number;
  page: number;
  pageSize: MissionsPageSize;
  filtered: boolean;
  onOpen: (row: MissionRow) => void;
  onPage: (page: number) => void;
  onPageSize: (size: MissionsPageSize) => void;
}) {
  const { t } = useI18n();
  const missing = t("ma.table.notProvided");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const text = (value: string | null) => (value && value.trim() !== "" ? value : missing);
  const assigned = (value: string | null) => (value && value.trim() !== "" ? value : t("ma.table.notAssigned"));

  return (
    <section
      aria-label={t("ma.table.title")}
      className="overflow-hidden rounded-xl border border-line/70 bg-white"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 px-3 py-2">
        <h2 className="text-sm font-semibold text-brand-900">{t("ma.table.title")}</h2>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-brand-800 ring-1 ring-brand-100">
          {t("ma.table.count", { count: total })}
        </span>
      </header>

      {items.length === 0 ? (
        <div className="grid place-items-center px-4 py-12 text-center">
          {filtered ? (
            <SearchX aria-hidden className="size-7 text-brand-300" />
          ) : (
            <Inbox aria-hidden className="size-7 text-brand-300" />
          )}
          <p className="mt-2 text-xs text-ink-soft">
            {filtered ? t("ma.table.emptyFiltered") : t("ma.table.empty")}
          </p>
        </div>
      ) : (
        <>
          <table className="hidden w-full table-fixed border-collapse text-xs xl:table">
            <colgroup>
              <col className="w-[88px]" />
              <col />
              <col />
              <col className="w-[104px]" />
              <col className="w-[22%]" />
              <col className="w-[112px]" />
              <col className="w-[100px]" />
              <col className="w-[112px]" />
              <col className="w-[44px]" />
            </colgroup>
            <thead className="bg-surface/70 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
              <tr>
                <th scope="col" className="px-2.5 py-2 text-start font-semibold">
                  {t("ma.table.reference")}
                </th>
                <th scope="col" className="px-2.5 py-2 text-start font-semibold">
                  {t("ma.table.patient")}
                </th>
                <th scope="col" className="px-2.5 py-2 text-start font-semibold">
                  {t("ma.table.driver")}
                </th>
                <th scope="col" className="px-2.5 py-2 text-start font-semibold">
                  {t("ma.table.ambulance")}
                </th>
                <th scope="col" className="px-2.5 py-2 text-start font-semibold">
                  <span className="inline-flex items-center gap-1">
                    {t("ma.table.pickup")}
                    <span aria-hidden>·</span>
                    {t("ma.table.destination")}
                  </span>
                </th>
                <th scope="col" className="px-2.5 py-2 text-start font-semibold">
                  {t("ma.table.created")}
                </th>
                <th scope="col" className="px-2.5 py-2 text-start font-semibold">
                  {t("ma.table.status")}
                </th>
                <th scope="col" className="px-2.5 py-2 text-start font-semibold">
                  {t("ma.table.completedAt")}
                </th>
                <th scope="col" className="px-1.5 py-2">
                  <span className="sr-only">{t("ma.table.open")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {items.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer align-top transition hover:bg-brand-50/40"
                  onClick={() => onOpen(row)}
                >
                  <td className="px-2.5 py-2">
                    <span className="font-mono text-[10px] font-medium text-brand-800">
                      {shortReference(row.id)}
                    </span>
                  </td>
                  <td className="px-2.5 py-2">
                    <p className="truncate font-medium text-ink">{text(row.patient_name)}</p>
                  </td>
                  <td className="px-2.5 py-2">
                    <p className="truncate text-ink">{assigned(row.driver_name)}</p>
                  </td>
                  <td className="px-2.5 py-2">
                    <p className="truncate text-ink-soft">{assigned(row.ambulance_label)}</p>
                  </td>
                  <td className="px-2.5 py-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="flex items-center gap-1 text-[11px] text-ink">
                        <MapPin aria-hidden className="size-3 shrink-0 text-brand-500" />
                        <span className="truncate">{text(row.pickup_label)}</span>
                      </p>
                      <p className="flex items-center gap-1 text-[11px] text-ink-soft">
                        <Flag aria-hidden className="size-3 shrink-0 text-emerald-600" />
                        <span className="truncate">{text(row.destination_label)}</span>
                      </p>
                    </div>
                  </td>
                  <td className="px-2.5 py-2">
                    <p className="truncate text-[10px] tabular-nums text-ink-soft">
                      {formatMissionDateTime(row.created_at, missing)}
                    </p>
                  </td>
                  <td className="px-2.5 py-2">
                    <MissionStatusPill status={row.status} />
                  </td>
                  <td className="px-2.5 py-2">
                    <p className="truncate text-[10px] tabular-nums text-ink-soft">
                      {row.status === "completed"
                        ? formatMissionDateTime(row.completed_at, missing)
                        : missing}
                    </p>
                  </td>
                  <td className="px-1.5 py-2 text-center">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(row);
                      }}
                      aria-label={`${t("ma.table.open")} ${shortReference(row.id)}`}
                      className="grid size-7 place-items-center rounded-md text-ink-soft transition hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <ChevronRight aria-hidden className="size-4 rtl:rotate-180" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="divide-y divide-line/60 xl:hidden">
            {items.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onOpen(row)}
                className="block w-full px-3 py-2.5 text-start transition hover:bg-brand-50/40 focus:outline-none focus-visible:bg-brand-50/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-medium text-brand-800">
                    {shortReference(row.id)}
                  </span>
                  <MissionStatusPill status={row.status} />
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-ink">
                  {text(row.patient_name)}
                </p>
                <p className="truncate text-[11px] text-ink-soft">
                  {assigned(row.driver_name)}
                  <span className="mx-1 text-line">·</span>
                  {assigned(row.ambulance_label)}
                </p>
                <div className="mt-1 space-y-0.5">
                  <p className="flex items-center gap-1 text-[11px] text-ink">
                    <MapPin aria-hidden className="size-3 shrink-0 text-brand-500" />
                    <span className="truncate">{text(row.pickup_label)}</span>
                  </p>
                  <p className="flex items-center gap-1 text-[11px] text-ink-soft">
                    <Flag aria-hidden className="size-3 shrink-0 text-emerald-600" />
                    <span className="truncate">{text(row.destination_label)}</span>
                  </p>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-2 border-t border-line/50 pt-1.5">
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-soft/80">
                      {t("ma.table.created")}
                    </p>
                    <p className="truncate text-[10px] tabular-nums text-ink">
                      {formatMissionDateTime(row.created_at, missing)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-soft/80">
                      {t("ma.table.completedAt")}
                    </p>
                    <p className="truncate text-[10px] tabular-nums text-ink">
                      {row.status === "completed"
                        ? formatMissionDateTime(row.completed_at, missing)
                        : missing}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {total > 0 ? (
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 px-3 py-2">
          <p className="text-[11px] tabular-nums text-ink-soft">
            {t("ma.table.summary", {
              from,
              to,
              total,
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
              {t("ma.table.pageSize")}
              <select
                value={pageSize}
                onChange={(event) =>
                  onPageSize(Number(event.target.value) as MissionsPageSize)
                }
                className="h-7 rounded-md border border-line bg-white px-1.5 text-[11px] font-medium normal-case tracking-normal text-ink transition focus:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onPage(page - 1)}
                disabled={page <= 1}
                className="inline-flex h-7 items-center gap-0.5 rounded-md border border-line bg-white px-2 text-[11px] font-semibold text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft aria-hidden className="size-3.5 rtl:rotate-180" />
                {t("ma.table.prev")}
              </button>
              <span className="px-1 text-[11px] tabular-nums text-ink-soft">
                {t("ma.table.page", { page, pages })}
              </span>
              <button
                type="button"
                onClick={() => onPage(page + 1)}
                disabled={page >= pages}
                className="inline-flex h-7 items-center gap-0.5 rounded-md border border-line bg-white px-2 text-[11px] font-semibold text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("ma.table.next")}
                <ChevronRight aria-hidden className="size-3.5 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </footer>
      ) : null}
    </section>
  );
}
