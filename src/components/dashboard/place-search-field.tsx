"use client";

import { Loader2, MapPin, Search, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import type { PlaceSuggestion } from "@/lib/geo/types";
import { usePlaceSearch } from "@/lib/geo/use-geo";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Debounced provider autocomplete. The typed text stays in the parent form;
 * this field only reports the chosen suggestion so coordinates and label are
 * always set together.
 */
export function PlaceSearchField({
  label,
  placeholder,
  value,
  tone,
  hasPoint,
  error,
  hint,
  onChangeText,
  onSelect,
  onClear,
}: {
  label: string;
  placeholder: string;
  value: string;
  tone: "pickup" | "destination";
  hasPoint: boolean;
  error?: string;
  hint?: string;
  onChangeText: (text: string) => void;
  onSelect: (suggestion: PlaceSuggestion) => void;
  onClear: () => void;
}) {
  const { t, locale } = useI18n();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { results, loading, failed, active } = usePlaceSearch(value, locale, open);
  const showList = open && active;

  const handleBlur = () => {
    blurTimer.current = setTimeout(() => setOpen(false), 120);
  };
  const handleFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setOpen(true);
  };

  const accent = tone === "pickup" ? "text-emerald-700" : "text-accent-700";

  return (
    <div className="relative">
      <label className="flex items-center justify-between gap-2 text-xs font-medium text-brand-900">
        <span>{label}</span>
        {hasPoint ? (
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${accent}`}>
            <MapPin aria-hidden className="size-3" />
            {t("dc.new.pointSet")}
          </span>
        ) : null}
      </label>
      <div className="relative mt-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft/70"
        />
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            onChangeText(event.target.value);
            setOpen(true);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          className={`h-10 w-full rounded-lg border bg-white ps-9 pe-9 text-sm text-ink focus:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
            error ? "border-accent-400" : "border-line"
          }`}
        />
        {value ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClear}
            aria-label={t("dc.new.clearPoint")}
            className="absolute end-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-soft hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        ) : null}
      </div>

      {showList ? (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-card"
        >
          {loading ? (
            <p className="flex items-center gap-2 px-3 py-2 text-xs text-ink-soft">
              <Loader2 aria-hidden className="size-3.5 animate-spin" />
              {t("dc.new.searching")}
            </p>
          ) : failed ? (
            <p className="px-3 py-2 text-xs text-accent-700">{t("dc.new.searchFailed")}</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-ink-soft">{t("dc.new.noResults")}</p>
          ) : (
            results.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  onSelect(suggestion);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-start transition hover:bg-brand-50 focus:bg-brand-50 focus:outline-none"
              >
                <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink-soft/70" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-brand-900">
                    {suggestion.label}
                  </span>
                  {suggestion.detail ? (
                    <span className="block truncate text-[11px] text-ink-soft">
                      {suggestion.detail}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}

      {error ? (
        <p className="mt-1 text-xs text-accent-700">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}
