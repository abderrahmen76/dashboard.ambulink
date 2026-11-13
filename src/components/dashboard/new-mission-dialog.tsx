"use client";

import { Loader2, MapPinned, RefreshCw, Route, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PhoneField } from "@/components/form-fields";
import { dashboardErrorMessageKey } from "@/lib/dashboard/messages";
import type {
  CreateCompanyMissionInput,
  CreateMissionInput,
  DashboardErrorCode,
  DashboardResult,
} from "@/lib/dashboard/service";
import type {
  CompanyMissionDispatchResult,
  CompanyOption,
  CompanyOptions,
  CompanyRecipients,
  DashboardDriver,
  DashboardHospital,
  MissionDispatchResult,
} from "@/lib/dashboard/types";
import { reversePlaceLabel } from "@/lib/geo/client";
import type { PlaceSuggestion, RoadRoute } from "@/lib/geo/types";
import { useHospitalChoices, useRoutePreview } from "@/lib/geo/use-geo";
import { useI18n } from "@/lib/i18n/provider";
import { toE164 } from "@/lib/phone";

import { PlaceSearchField } from "./place-search-field";
import { TileMap, type MapMarker, type MapPoint } from "./tile-map";

const fieldClass =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
const labelClass = "block text-xs font-medium text-brand-900";

/** Fallback view only; no marker is drawn at this default position. */
const DEFAULT_CENTER: MapPoint = { lat: 36.8065, lng: 10.1815 };

const EMPTY_FORM = {
  name: "",
  phone: "",
  pickupLabel: "",
  pickupPoint: null as MapPoint | null,
  destinationLabel: "",
  destinationPoint: null as MapPoint | null,
  motif: "",
  driverId: "",
};

type LocationTarget = "pickup" | "destination";
type DestinationKind = "hospital" | "company";

function formatRouteSummary(route: RoadRoute): string {
  const km = route.distanceMeters / 1000;
  const distance = km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
  const minutes = Math.max(1, Math.round(route.durationSeconds / 60));
  return `${distance} · ${minutes} min`;
}

export function NewMissionDialog({
  hospital,
  drivers,
  onClose,
  onCreate,
  onCreateCompany,
  loadCompanyOptions,
  loadCompanyRecipients,
  onCreated,
}: {
  hospital: DashboardHospital | null;
  drivers: DashboardDriver[];
  onClose: () => void;
  onCreate: (
    input: CreateMissionInput,
  ) => Promise<DashboardResult<MissionDispatchResult>>;
  onCreateCompany: (
    input: CreateCompanyMissionInput,
  ) => Promise<DashboardResult<CompanyMissionDispatchResult>>;
  loadCompanyOptions: () => Promise<DashboardResult<CompanyOptions>>;
  loadCompanyRecipients: (
    companyId: string,
  ) => Promise<DashboardResult<CompanyRecipients>>;
  onCreated: (missionId: string) => void;
}) {
  const { t, locale } = useI18n();
  const initialCenter: MapPoint =
    hospital?.latitude != null && hospital?.longitude != null
      ? { lat: hospital.latitude, lng: hospital.longitude }
      : DEFAULT_CENTER;
  const [form, setForm] = useState(EMPTY_FORM);
  const [pickTarget, setPickTarget] = useState<LocationTarget>("pickup");
  const [specific, setSpecific] = useState(false);
  const [destination, setDestination] = useState<DestinationKind>("hospital");
  const [requestKey] = useState(() => crypto.randomUUID());
  const [companyRequestKey] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<DashboardErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const [offered, setOffered] = useState<number | null>(null);
  const [offeredCompany, setOfferedCompany] = useState<string | null>(null);
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[] | null>(null);
  const [companyOptionsError, setCompanyOptionsError] = useState<DashboardErrorCode | null>(
    null,
  );
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [recipients, setRecipients] = useState<CompanyRecipients | null>(null);
  const [recipientsError, setRecipientsError] = useState<DashboardErrorCode | null>(null);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [hospitalChoice, setHospitalChoice] = useState("");
  const [mapCenter, setMapCenter] = useState<MapPoint>(initialCenter);
  const [resolving, setResolving] = useState<LocationTarget | null>(null);
  const [resolveFailed, setResolveFailed] = useState<Record<LocationTarget, boolean>>({
    pickup: false,
    destination: false,
  });
  const onCloseRef = useRef(onClose);
  const dialogAlive = useRef(true);
  const resolveSeq = useRef(0);
  const recipientSeq = useRef(0);

  const { hospitals: hospitalRows, failed: hospitalsFailed } = useHospitalChoices();
  const routePreview = useRoutePreview(form.pickupPoint, form.destinationPoint);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    dialogAlive.current = true;
    return () => {
      dialogAlive.current = false;
    };
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void loadCompanyOptions().then((result) => {
      if (!alive) return;
      if (result.ok) {
        setCompanyOptions(result.data.companies);
        setCompanyOptionsError(null);
      } else {
        setCompanyOptions([]);
        setCompanyOptionsError(result.code);
      }
    });
    return () => {
      alive = false;
    };
  }, [loadCompanyOptions]);

  const eligible = drivers.filter(
    (driver) => driver.availability === true && !driver.active_mission_id,
  );

  const selectedCompany =
    (companyOptions ?? []).find((company) => company.id === companyId) ?? null;
  const normalizedQuery = companyQuery.trim().toLowerCase();
  const visibleCompanies = (companyOptions ?? []).filter(
    (company) =>
      !normalizedQuery ||
      company.name.toLowerCase().includes(normalizedQuery) ||
      (company.slug ?? "").toLowerCase().includes(normalizedQuery),
  );
  const companyEligible = recipients?.eligible_count ?? 0;
  const companyReady =
    destination === "company" &&
    !!companyId &&
    !recipientsLoading &&
    companyEligible > 0;

  const hospitalChoices = [
    ...(hospital &&
    !(hospitalRows ?? []).some((row) => row.id === hospital.id)
      ? [
          {
            id: hospital.id,
            name: hospital.name,
            latitude: hospital.latitude,
            longitude: hospital.longitude,
          },
        ]
      : []),
    ...(hospitalRows ?? []),
  ];

  const markers: MapMarker[] = [];
  if (hospital?.latitude != null && hospital?.longitude != null) {
    markers.push({
      key: "hospital",
      point: { lat: hospital.latitude, lng: hospital.longitude },
      tone: "hospital",
      title: hospital.name,
    });
  }
  if (form.pickupPoint) {
    markers.push({
      key: "pickup",
      point: form.pickupPoint,
      tone: "pickup",
      title: t("dc.new.pickupPoint"),
      selected: pickTarget === "pickup",
    });
  }
  if (form.destinationPoint) {
    markers.push({
      key: "destination",
      point: form.destinationPoint,
      tone: "destination",
      title: t("dc.new.destinationPoint"),
      selected: pickTarget === "destination",
    });
  }
  const previewRoutes =
    routePreview.route && form.pickupPoint && form.destinationPoint
      ? [
          {
            key: "preview",
            tone: "destination" as const,
            points: routePreview.route.points.map(([lat, lng]) => ({ lat, lng })),
          },
        ]
      : [];

  const applyPoint = async (target: LocationTarget, point: MapPoint) => {
    const seq = ++resolveSeq.current;
    setPickTarget(target);
    setResolving(target);
    setResolveFailed((current) => ({ ...current, [target]: false }));
    setForm((current) =>
      target === "pickup"
        ? { ...current, pickupPoint: point, pickupLabel: "" }
        : { ...current, destinationPoint: point, destinationLabel: "" },
    );
    setErrors((current) => {
      const next = { ...current };
      if (target === "pickup") {
        delete next.pickup;
        delete next.pickupLabel;
      }
      return next;
    });
    let label: string | null = null;
    try {
      label = await reversePlaceLabel(point, locale);
    } catch {
      label = null;
    }
    if (!dialogAlive.current || seq !== resolveSeq.current) return;
    setResolving((current) => (current === target ? null : current));
    setResolveFailed((current) => ({ ...current, [target]: !label }));
    if (label) {
      setForm((current) => {
        const unchanged =
          target === "pickup"
            ? current.pickupPoint?.lat === point.lat && current.pickupPoint?.lng === point.lng
            : current.destinationPoint?.lat === point.lat &&
              current.destinationPoint?.lng === point.lng;
        return unchanged
          ? target === "pickup"
            ? { ...current, pickupLabel: label }
            : { ...current, destinationLabel: label }
          : current;
      });
    }
  };

  const selectSuggestion = (target: LocationTarget, suggestion: PlaceSuggestion) => {
    const point = { lat: suggestion.lat, lng: suggestion.lng };
    setPickTarget(target);
    setResolveFailed((current) => ({ ...current, [target]: false }));
    setForm((current) =>
      target === "pickup"
        ? { ...current, pickupPoint: point, pickupLabel: suggestion.label }
        : { ...current, destinationPoint: point, destinationLabel: suggestion.label },
    );
    setMapCenter(point);
    setErrors((current) => {
      if (target !== "pickup") return current;
      const next = { ...current };
      delete next.pickup;
      delete next.pickupLabel;
      return next;
    });
  };

  const clearLocation = (target: LocationTarget) => {
    setResolveFailed((current) => ({ ...current, [target]: false }));
    setForm((current) =>
      target === "pickup"
        ? { ...current, pickupPoint: null, pickupLabel: "" }
        : { ...current, destinationPoint: null, destinationLabel: "" },
    );
  };

  const chooseHospital = (id: string) => {
    setHospitalChoice(id);
    if (!id) return;
    const choice = hospitalChoices.find((row) => row.id === id);
    if (!choice) return;
    if (choice.latitude != null && choice.longitude != null) {
      const point = { lat: choice.latitude, lng: choice.longitude };
      setForm((current) => ({
        ...current,
        destinationPoint: point,
        destinationLabel: choice.name,
      }));
      setMapCenter(point);
      setResolveFailed((current) => ({ ...current, destination: false }));
    } else {
      setForm((current) => ({
        ...current,
        destinationPoint: null,
        destinationLabel: choice.name,
      }));
    }
  };

  const handleMapPick = (point: MapPoint) => {
    void applyPoint(pickTarget, point);
  };

  const fetchRecipients = async (id: string) => {
    const seq = ++recipientSeq.current;
    setRecipients(null);
    setRecipientsError(null);
    setRecipientsLoading(true);
    const result = await loadCompanyRecipients(id);
    if (!dialogAlive.current || seq !== recipientSeq.current) return;
    setRecipientsLoading(false);
    if (result.ok) {
      setRecipients(result.data);
    } else {
      setRecipientsError(result.code);
    }
  };

  const chooseDestination = (next: DestinationKind) => {
    if (next === destination) return;
    setDestination(next);
    setError(null);
    setConfirmed(false);
    setErrors({});
    if (next === "hospital") {
      recipientSeq.current += 1;
      setCompanyId("");
      setCompanyQuery("");
      setRecipients(null);
      setRecipientsError(null);
      setRecipientsLoading(false);
    }
  };

  const chooseCompany = (id: string) => {
    const choice = (companyOptions ?? []).find((company) => company.id === id);
    if (choice) setCompanyQuery(choice.name);
    if (id === companyId) return;
    setCompanyId(id);
    setConfirmed(false);
    setError(null);
    setErrors((current) => {
      const next = { ...current };
      delete next.companyId;
      delete next.companyConfirm;
      return next;
    });
    void fetchRecipients(id);
  };

  // One marker per company id; coordinates come from the directory row, never
  // fabricated. Search and map share `companyId` as the single selection.
  const companyMapPoints = (companyOptions ?? []).flatMap((company) =>
    company.lat != null && company.lng != null
      ? [{ id: company.id, name: company.name, lat: company.lat, lng: company.lng }]
      : [],
  );
  const companyMarkers: MapMarker[] = companyMapPoints.map((point) => ({
    key: `company:${point.id}`,
    point: { lat: point.lat, lng: point.lng },
    tone: "ambulance",
    title: point.name,
    label: point.name,
    selected: point.id === companyId,
    onClick: () => chooseCompany(point.id),
  }));
  const selectedCompanyPoint =
    selectedCompany?.lat != null && selectedCompany?.lng != null
      ? { lat: selectedCompany.lat, lng: selectedCompany.lng }
      : null;
  const companyMapCenter: MapPoint =
    selectedCompanyPoint ??
    (companyMapPoints.length
      ? {
          lat:
            companyMapPoints.reduce((sum, point) => sum + point.lat, 0) /
            companyMapPoints.length,
          lng:
            companyMapPoints.reduce((sum, point) => sum + point.lng, 0) /
            companyMapPoints.length,
        }
      : initialCenter);
  const companyMapZoom = selectedCompanyPoint
    ? 13
    : companyMapPoints.length === 1
      ? 12
      : companyMapPoints.length
        ? 8
        : 12;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = t("dc.new.validationName");
    if (form.phone.length !== 8) nextErrors.phone = t("validation.phone");
    if (!form.pickupLabel.trim()) nextErrors.pickupLabel = t("dc.new.validationLabel");
    if (!form.pickupPoint) nextErrors.pickup = t("dc.new.validationPickup");
    if (destination === "company") {
      if (!companyId) nextErrors.companyId = t("dc.new.validationCompany");
      else if (!recipients || companyEligible === 0) {
        nextErrors.companyId = t("dc.new.companyNoEligibleShort");
      }
      if (!confirmed) nextErrors.companyConfirm = t("dc.new.validationConfirm");
    } else if (specific && !form.driverId) {
      nextErrors.driverId = t("dc.new.validationDriver");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !form.pickupPoint) return;

    const pickupPoint = form.pickupPoint;
    setPending(true);
    setError(null);
    const base = {
      patientName: form.name.trim(),
      patientPhone: toE164(form.phone),
      pickupLabel: form.pickupLabel.trim(),
      pickupLat: pickupPoint.lat,
      pickupLng: pickupPoint.lng,
      destinationLabel: form.destinationLabel.trim() || null,
      destinationLat: form.destinationPoint?.lat ?? null,
      destinationLng: form.destinationPoint?.lng ?? null,
      motif: form.motif.trim() || null,
    };

    if (destination === "company") {
      const result = await onCreateCompany({
        ...base,
        requestKey: companyRequestKey,
        companyId,
      });
      setPending(false);
      if (!result.ok) {
        setError(result.code);
        return;
      }
      setOffered(result.data.offered);
      setOfferedCompany(result.data.company.name);
      onCreated(result.data.mission_id);
      return;
    }

    const result = await onCreate({
      ...base,
      requestKey,
      driverId: specific ? form.driverId : null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.code);
      return;
    }
    setOffered(result.data.offered);
    onCreated(result.data.mission_id);
  };

  const pickupHint =
    resolving === "pickup"
      ? t("dc.new.locating")
      : resolveFailed.pickup && !form.pickupLabel
        ? t("dc.new.locateFailed")
        : undefined;
  const destinationHint =
    resolving === "destination"
      ? t("dc.new.locating")
      : resolveFailed.destination && !form.destinationLabel
        ? t("dc.new.locateFailed")
        : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-900/50 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-mission-title"
        className="mt-4 w-full max-w-3xl rounded-2xl bg-white shadow-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
          <div>
            <h2 id="new-mission-title" className="text-base font-semibold text-brand-900">
              {t("dc.new.title")}
            </h2>
            <p className="mt-0.5 text-xs text-ink-soft">{t("dc.new.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("dc.details.close")}
            className="grid size-8 place-items-center rounded-lg text-ink-soft transition hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        {offered !== null ? (
          <div className="p-5">
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {offeredCompany
                ? t("dc.new.successCompany", { count: offered, company: offeredCompany })
                : t("dc.new.success", { count: offered })}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 inline-flex h-10 items-center rounded-lg bg-brand-800 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {t("dc.details.close")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="mission-name" className={labelClass}>
                  {t("dc.new.patientName")}
                </label>
                <input
                  id="mission-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className={`mt-1 ${fieldClass}`}
                  autoComplete="off"
                />
                {errors.name ? (
                  <p className="mt-1 text-xs text-accent-700">{errors.name}</p>
                ) : null}
              </div>
              <div>
                <PhoneField
                  label={t("dc.new.patientPhone")}
                  value={form.phone}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, phone: value }))
                  }
                  error={errors.phone}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <PlaceSearchField
                label={t("dc.new.pickupLabel")}
                placeholder={t("dc.new.searchPlaceholder")}
                value={form.pickupLabel}
                tone="pickup"
                hasPoint={!!form.pickupPoint}
                error={errors.pickupLabel}
                hint={pickupHint}
                onChangeText={(text) =>
                  setForm((current) => ({
                    ...current,
                    pickupLabel: text,
                    pickupPoint: null,
                  }))
                }
                onSelect={(suggestion) => selectSuggestion("pickup", suggestion)}
                onClear={() => clearLocation("pickup")}
              />
              <PlaceSearchField
                label={t("dc.new.destinationLabel")}
                placeholder={t("dc.new.destinationPlaceholder")}
                value={form.destinationLabel}
                tone="destination"
                hasPoint={!!form.destinationPoint}
                hint={destinationHint}
                onChangeText={(text) =>
                  setForm((current) => ({
                    ...current,
                    destinationLabel: text,
                    destinationPoint: null,
                  }))
                }
                onSelect={(suggestion) => selectSuggestion("destination", suggestion)}
                onClear={() => clearLocation("destination")}
              />
            </div>

            <div>
              <label htmlFor="mission-hospital" className={labelClass}>
                {t("dc.new.hospitalLabel")}
              </label>
              <select
                id="mission-hospital"
                value={hospitalChoice}
                onChange={(event) => chooseHospital(event.target.value)}
                className={`mt-1 ${fieldClass}`}
              >
                <option value="">{t("dc.new.hospitalNone")}</option>
                {hospitalChoices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.name}
                    {choice.latitude == null || choice.longitude == null
                      ? ` · ${t("dc.new.hospitalNoCoordsShort")}`
                      : ""}
                  </option>
                ))}
              </select>
              {hospitalChoice &&
              hospitalChoices.find((row) => row.id === hospitalChoice)?.latitude == null ? (
                <p className="mt-1 text-xs text-ink-soft">{t("dc.new.hospitalNoCoords")}</p>
              ) : hospitalsFailed ? (
                <p className="mt-1 text-xs text-ink-soft">{t("dc.new.hospitalListFailed")}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="mission-motif" className={labelClass}>
                {t("dc.new.motif")}
              </label>
              <input
                id="mission-motif"
                value={form.motif}
                placeholder={t("dc.new.motifPlaceholder")}
                maxLength={500}
                onChange={(event) =>
                  setForm((current) => ({ ...current, motif: event.target.value }))
                }
                className={`mt-1 ${fieldClass}`}
              />
            </div>

            <div className="rounded-xl border border-line/70 bg-surface/60 p-2">
              <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
                <span className="text-xs font-medium text-ink-soft">{t("dc.new.pickOnMap")}</span>
                <button
                  type="button"
                  onClick={() => setPickTarget("pickup")}
                  aria-pressed={pickTarget === "pickup"}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    pickTarget === "pickup"
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-ink-soft ring-1 ring-line"
                  }`}
                >
                  {t("dc.new.pickupPoint")}
                  {form.pickupPoint
                    ? ` · ${form.pickupPoint.lat.toFixed(4)}, ${form.pickupPoint.lng.toFixed(4)}`
                    : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setPickTarget("destination")}
                  aria-pressed={pickTarget === "destination"}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    pickTarget === "destination"
                      ? "bg-accent-600 text-white"
                      : "bg-white text-ink-soft ring-1 ring-line"
                  }`}
                >
                  {t("dc.new.destinationPoint")}
                  {form.destinationPoint
                    ? ` · ${form.destinationPoint.lat.toFixed(4)}, ${form.destinationPoint.lng.toFixed(4)}`
                    : ""}
                </button>
                {form.pickupPoint || form.destinationPoint ? (
                  <button
                    type="button"
                    onClick={() => {
                      clearLocation("pickup");
                      clearLocation("destination");
                      setHospitalChoice("");
                    }}
                    className="ms-auto rounded-full px-2 py-1 text-[11px] font-medium text-ink-soft hover:text-accent-700"
                  >
                    {t("dc.new.clearPoint")}
                  </button>
                ) : null}
              </div>
              <TileMap
                key={`${mapCenter.lat.toFixed(5)},${mapCenter.lng.toFixed(5)}`}
                center={mapCenter}
                zoom={12}
                markers={markers}
                routes={previewRoutes}
                onPick={handleMapPick}
                className="h-[220px]"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2">
                {errors.pickup ? (
                  <p className="text-xs text-accent-700">{errors.pickup}</p>
                ) : (
                  <p className="text-[11px] text-ink-soft">{t("dc.new.mapHint")}</p>
                )}
                {routePreview.loading ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-soft">
                    <Loader2 aria-hidden className="size-3 animate-spin" />
                    {t("dc.route.loading")}
                  </span>
                ) : routePreview.route ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-700">
                    <Route aria-hidden className="size-3.5" />
                    {formatRouteSummary(routePreview.route)}
                  </span>
                ) : routePreview.failed ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-accent-700">
                    <MapPinned aria-hidden className="size-3.5" />
                    {t("dc.route.failed")}
                  </span>
                ) : null}
              </div>
            </div>

            <fieldset className="rounded-xl border border-line/70 p-3">
              <legend className="px-1 text-xs font-medium text-brand-900">
                {t("dc.new.destination")}
              </legend>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm transition ${
                    destination === "hospital"
                      ? "border-brand-400 bg-brand-50/60"
                      : "border-line bg-white hover:bg-surface/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="destination-kind"
                    checked={destination === "hospital"}
                    onChange={() => chooseDestination("hospital")}
                    className="mt-0.5 accent-brand-700"
                  />
                  <span>
                    <span className="block font-medium text-brand-900">
                      {t("dc.new.destinationHospital")}
                    </span>
                    <span className="block text-xs text-ink-soft">
                      {t("dc.new.destinationHospitalHint")}
                    </span>
                  </span>
                </label>
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm transition ${
                    destination === "company"
                      ? "border-brand-400 bg-brand-50/60"
                      : "border-line bg-white hover:bg-surface/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="destination-kind"
                    checked={destination === "company"}
                    onChange={() => chooseDestination("company")}
                    className="mt-0.5 accent-brand-700"
                  />
                  <span>
                    <span className="block font-medium text-brand-900">
                      {t("dc.new.destinationCompany")}
                    </span>
                    <span className="block text-xs text-ink-soft">
                      {t("dc.new.destinationCompanyHint")}
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            {destination === "hospital" ? (
              <fieldset className="rounded-xl border border-line/70 p-3">
                <legend className="px-1 text-xs font-medium text-brand-900">
                  {t("dc.new.dispatch")}
                </legend>
                <div className="mt-1 space-y-2">
                  <label className="flex items-start gap-2 text-sm text-ink">
                    <input
                      type="radio"
                      name="dispatch-mode"
                      checked={!specific}
                      onChange={() => setSpecific(false)}
                      className="mt-0.5 accent-brand-700"
                    />
                    <span>
                      <span className="font-medium text-brand-900">{t("dc.new.broadcast")}</span>
                      <span className="block text-xs text-ink-soft">{t("dc.new.broadcastHint")}</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-ink">
                    <input
                      type="radio"
                      name="dispatch-mode"
                      checked={specific}
                      onChange={() => setSpecific(true)}
                      className="mt-0.5 accent-brand-700"
                    />
                    <span>
                      <span className="font-medium text-brand-900">{t("dc.new.specific")}</span>
                      <span className="block text-xs text-ink-soft">{t("dc.new.specificHint")}</span>
                    </span>
                  </label>
                  {specific ? (
                    <div>
                      <label htmlFor="mission-driver" className="sr-only">
                        {t("dc.new.selectDriver")}
                      </label>
                      <select
                        id="mission-driver"
                        value={form.driverId}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, driverId: event.target.value }))
                        }
                        className={fieldClass}
                      >
                        <option value="">{t("dc.new.selectDriver")}</option>
                        {eligible.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.full_name ?? driver.id.slice(0, 8)}
                            {driver.ambulance_label ? ` · ${driver.ambulance_label}` : ""}
                          </option>
                        ))}
                      </select>
                      {eligible.length === 0 ? (
                        <p className="mt-1 text-xs text-ink-soft">{t("dc.new.noEligible")}</p>
                      ) : null}
                      {errors.driverId ? (
                        <p className="mt-1 text-xs text-accent-700">{errors.driverId}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </fieldset>
            ) : (
              <fieldset className="rounded-xl border border-line/70 p-3">
                <legend className="px-1 text-xs font-medium text-brand-900">
                  {t("dc.new.companySection")}
                </legend>
                <div className="mt-1 space-y-2">
                  <label htmlFor="company-search" className={labelClass}>
                    {t("dc.new.companySearch")}
                  </label>
                  <div className="relative">
                    <Search
                      aria-hidden
                      className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
                    />
                    <input
                      id="company-search"
                      value={companyQuery}
                      onChange={(event) => setCompanyQuery(event.target.value)}
                      placeholder={t("dc.new.companySearchPlaceholder")}
                      className={`${fieldClass} ps-9`}
                      autoComplete="off"
                    />
                  </div>

                  {companyMapPoints.length ? (
                    <div className="rounded-xl border border-line/70 bg-surface/60 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-1 px-1 pb-2">
                        <span className="text-xs font-medium text-ink-soft">
                          {t("dc.new.companyMapTitle")}
                        </span>
                        <span className="text-[11px] text-ink-soft">
                          {t("dc.new.companyMapHint")}
                        </span>
                      </div>
                      <TileMap
                        key={`company:${companyMapCenter.lat.toFixed(5)},${companyMapCenter.lng.toFixed(5)},${companyMapZoom}`}
                        center={companyMapCenter}
                        zoom={companyMapZoom}
                        markers={companyMarkers}
                        className="h-[200px]"
                      />
                    </div>
                  ) : companyOptions && companyOptions.length ? (
                    <p className="px-1 text-xs text-ink-soft">
                      {t("dc.new.companyMapEmpty")}
                    </p>
                  ) : null}

                  {companyOptions === null ? (
                    <p className="inline-flex items-center gap-1.5 px-1 text-xs text-ink-soft">
                      <Loader2 aria-hidden className="size-3.5 animate-spin" />
                      {t("dc.new.companyLoading")}
                    </p>
                  ) : companyOptionsError ? (
                    <p role="alert" className="rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700">
                      {companyOptionsError === "migration_pending"
                        ? t("dc.new.companyMigrationPending")
                        : t("dc.new.companyLoadFailed")}
                    </p>
                  ) : companyOptions.length === 0 ? (
                    <div className="rounded-lg bg-surface px-3 py-2">
                      <p className="text-xs font-medium text-brand-900">
                        {t("dc.new.companyNoCompanies")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-soft">
                        {t("dc.new.companyNoCompaniesHint")}
                      </p>
                    </div>
                  ) : visibleCompanies.length === 0 ? (
                    <p className="px-1 text-xs text-ink-soft">{t("dc.new.companyNoResults")}</p>
                  ) : (
                    <ul className="max-h-52 space-y-1 overflow-y-auto pe-1">
                      {visibleCompanies.map((company) => {
                        const empty = company.eligible_driver_count === 0;
                        const active = company.id === companyId;
                        const hasPosition = company.lat != null && company.lng != null;
                        return (
                          <li key={company.id}>
                            <button
                              type="button"
                              onClick={() => chooseCompany(company.id)}
                              aria-pressed={active}
                              className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-start text-sm transition ${
                                active
                                  ? "border-brand-400 bg-brand-50"
                                  : "border-line bg-white hover:bg-surface"
                              }`}
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-brand-900">
                                  {company.name}
                                </span>
                                <span className="block truncate text-[11px] text-ink-soft">
                                  {company.slug ? `${company.slug} · ` : ""}
                                  {hasPosition
                                    ? t("dc.new.companyLocation", {
                                        lat: company.lat!.toFixed(4),
                                        lng: company.lng!.toFixed(4),
                                      })
                                    : t("dc.new.companyNoLocation")}
                                </span>
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  empty
                                    ? "bg-surface text-ink-soft"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {empty
                                  ? t("dc.new.companyDriversZero")
                                  : t("dc.new.companyDrivers", {
                                      count: company.eligible_driver_count,
                                    })}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {errors.companyId ? (
                    <p className="px-1 text-xs text-accent-700">{errors.companyId}</p>
                  ) : null}

                  {selectedCompany ? (
                    <>
                      <div className="rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                          {t("dc.new.companySelected")}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-brand-900">
                          {selectedCompany.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-soft">
                          {selectedCompany.lat != null && selectedCompany.lng != null
                            ? t("dc.new.companyLocation", {
                                lat: selectedCompany.lat.toFixed(4),
                                lng: selectedCompany.lng.toFixed(4),
                              })
                            : t("dc.new.companyNoLocation")}
                        </p>
                      </div>

                      <div className="rounded-xl border border-line/70 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-medium text-brand-900">
                            {t("dc.new.companyRecipients")}
                            {recipients
                              ? ` · ${t("dc.new.companyCount", { count: companyEligible })}`
                              : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => void fetchRecipients(selectedCompany.id)}
                            disabled={recipientsLoading}
                            className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-ink-soft transition hover:bg-surface disabled:opacity-60"
                          >
                            <RefreshCw
                              aria-hidden
                              className={`size-3 ${recipientsLoading ? "animate-spin" : ""}`}
                            />
                            {t("dc.new.companyRefresh")}
                          </button>
                        </div>

                        {recipientsLoading && !recipients ? (
                          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-soft">
                            <Loader2 aria-hidden className="size-3.5 animate-spin" />
                            {t("dc.new.companyPreviewLoading")}
                          </p>
                        ) : recipientsError ? (
                          <p role="alert" className="mt-2 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700">
                            {t(dashboardErrorMessageKey(recipientsError))}
                          </p>
                        ) : recipients && companyEligible === 0 ? (
                          <div className="mt-2 rounded-lg bg-surface px-3 py-2">
                            <p className="text-xs font-medium text-brand-900">
                              {t("dc.new.companyNoEligible")}
                            </p>
                            <p className="mt-0.5 text-[11px] text-ink-soft">
                              {t("dc.new.companyNoEligibleHint")}
                            </p>
                          </div>
                        ) : recipients ? (
                          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                            {recipients.eligible.map((driver) => (
                              <li
                                key={driver.id}
                                className="flex items-center justify-between gap-2 rounded-lg bg-surface/70 px-2.5 py-1.5"
                              >
                                <span className="min-w-0 truncate text-xs font-medium text-brand-900">
                                  {driver.full_name ?? driver.id.slice(0, 8)}
                                </span>
                                <span className="shrink-0 text-[11px] text-ink-soft">
                                  {driver.availability
                                    ? t("dc.eligibility.online")
                                    : t("dc.eligibility.offline")}
                                  {driver.ambulance_label ? ` · ${driver.ambulance_label}` : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {errors.companyConfirm ? (
                          <p className="mt-2 text-xs text-accent-700">{errors.companyConfirm}</p>
                        ) : null}
                        <label className="mt-2 flex items-start gap-2 text-xs text-ink">
                          <input
                            type="checkbox"
                            checked={confirmed}
                            disabled={!companyReady}
                            onChange={(event) => setConfirmed(event.target.checked)}
                            className="mt-0.5 accent-brand-700"
                          />
                          <span>
                            {t("dc.new.confirmCompany", { company: selectedCompany.name })}
                          </span>
                        </label>
                      </div>
                    </>
                  ) : null}
                </div>
              </fieldset>
            )}

            {error ? (
              <p role="alert" className="rounded-xl bg-accent-50 px-3.5 py-2.5 text-sm text-accent-700">
                {t(dashboardErrorMessageKey(error))}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-surface"
              >
                {t("dc.new.cancel")}
              </button>
              <button
                type="submit"
                disabled={
                  pending ||
                  (destination === "company"
                    ? !companyReady || !confirmed
                    : specific && eligible.length === 0)
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-4 text-sm font-semibold text-white transition hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-progress disabled:opacity-60"
              >
                {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                {pending ? t("dc.new.submitting") : t("dc.new.submit")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
