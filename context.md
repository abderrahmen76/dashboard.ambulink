# AmbuLink Clinic — Context

Next.js 16 app (App Router, `src/app`) that shares the AmbuLink Supabase project
with the Flutter patient/driver app. It is a separate app, **not** a second
Supabase project and **not** a parallel auth system: accounts, roles and
hospital associations all come from the existing backend.

## Stack constraints (verified in this repo)

- `next@16.4.6` with `cacheComponents: true` and `partialPrefetching: true`.
  Every runtime read (`cookies()`, `searchParams`) sits inside a `<Suspense>`
  boundary; skeletons are static.
- Middleware is `src/proxy.ts` (exported `proxy` + `config.matcher`), not
  `middleware.ts`. It refreshes the Supabase session and applies the cache
  headers returned by `setAll(cookiesToSet, headers)`.
- `@supabase/ssr@0.12.7` (`createServerClient`, `getAll/setAll`),
  `@supabase/supabase-js@2.119.0`, React 19 (`useActionState`, `useFormStatus`).
- Tailwind CSS 4 with `@theme` tokens in `src/app/globals.css`
  (`brand-50..900`, `accent-*`, `surface`, `ink`, `line`, `shadow-card`).
  Logical utilities (`ps-/pe-/start-/end-`) and `rtl:` variants only.
- `AGENTS.md`: read `node_modules/next/dist/docs/` before changing Next APIs.

## Environment

Browser code only ever sees `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`src/lib/supabase/env.ts`). No
service-role/secret key exists in this app; all privileged decisions run on the
server with the user's own session, so RLS still applies.

## Authentication and authorization (server-only)

`signInHospitalManager` (`src/app/actions/auth.ts`) runs as a Server Action:

1. `normalizeTunisianPhoneDigits` (`src/lib/phone.ts`) accepts 8 digits or
   `216XXXXXXXX`; Auth receives E.164 `+216XXXXXXXX`.
2. `supabase.auth.signInWithPassword({ phone, password })` on the server; the
   session is stored in cookies by `@supabase/ssr`.
3. `verifyHospitalManager(supabase, userId)` (`src/lib/auth/hospital-manager.ts`)
   checks, in order:
   - `profiles.select(id, role, full_name, phone).eq(id, userId)` →
     row must exist and `role === 'hospital_manager'`;
   - `hospital_memberships.select(hospital_id, membership_role, is_active)`
     filtered by `user_id` and `membership_role = 'hospital_manager'` →
     row required, `is_active === true`;
   - `rpc('current_hospital_management_enabled')` → must be `true`;
   - `rpc('is_active_hospital_manager', { target_hospital_id })` → must be `true`;
   - `hospitals.select(id, name, is_active)` → row required and active.
   A `42501` on either RPC maps to `access_disabled`; other errors map to
   `network`. The client role value is never trusted alone, and the queries are
   additionally constrained by RLS.
4. Any non-network denial calls `signOut()` before returning a localized code,
   so a rejected session never stays signed in. Success `redirect('/dashboard')`.

Protected pages call `requireHospitalManager()` (`src/lib/auth/require-manager.ts`)
on every render; `src/proxy.ts` only performs the optimistic "has session?" fence
for `/dashboard`. `/login` redirects an already verified manager to `/dashboard`.

Rejection codes surfaced as `?reason=`: `unauthorized_role`, `missing_hospital`,
`membership_inactive`, `access_disabled`, `profile_missing`, `network`, `session`,
`unexpected`.

## Phone input (+216, 8 digits)

The login and reset fields take a Tunisian national number, never an email.
`+216` is a fixed, non-editable prefix rendered beside the input; the field value
is only the 8 national digits.

- `sanitizeTunisianPhoneInput` (`src/lib/phone.ts`) runs on every change, so it
  also covers paste and IME input: it drops every non-digit, drops a pasted
  `00216`/`216` prefix only when that would exceed 8 digits, then slices to 8.
  `maxLength` is deliberately not used (it truncated formatted pastes before
  sanitization).
- `PhoneField` (`src/components/form-fields.tsx`) is `type="tel"`,
  `inputMode="numeric"`, `autoComplete="tel-national"`, wrapped in `dir="ltr"`.
- Submit is blocked client-side while the value is not exactly 8 digits
  (`event.preventDefault()` in `onSubmit`, so React 19 skips the form action),
  with the localized `validation.phone` message shown under the field. The
  Server Action still re-validates with `normalizeTunisianPhoneDigits`.
- The submit value is unchanged from before: Auth receives E.164
  `+216XXXXXXXX` and the reset function receives canonical `216XXXXXXXX`. No
  stored phone number or auth record is read back or rewritten.

## Routes

- `/` → 307 to `/login` (`redirects()` in `next.config.ts`; a page-level
  `redirect()` is not used because it breaks `instant` validation under
  `cacheComponents`).
- `/login` — two-column login, forgot-password panel, localized notices.
- `/dashboard` — verified manager workspace shell (account, hospital, access,
  sign-out).
- No registration, no Google/SSO, no other role reaches `/dashboard`.

## Password reset

`requestHospitalManagerPasswordReset` invokes the existing Edge Function
`password-reset-request` with
`{ phone: '216XXXXXXXX', account_type: 'hospital_manager', new_password, explanation }`.
The function validates and stores an encrypted request for administrator
approval; the app never changes a password directly. Codes
`invalid_password` / `invalid_explanation` / `invalid_request` are mapped to
localized field errors; anything else is `reset_unavailable`.

## Localization (en / fr / ar)

- `src/lib/i18n/dictionaries.ts` — typed en/fr/ar dictionaries (`MessageKey`),
  `translate`, `errorMessage`, `actionMessage`, `noticeMessage`.
- `src/lib/i18n/config.ts` — cookie `ambulink_clinic_locale`, localStorage mirror
  (`localeStorageKey`), `directionFor`, and `localeBootScript`.
- `src/app/layout.tsx` puts the boot script in `<body>` so `lang`/`dir` are set
  before first paint; `suppressHydrationWarning` on `<html>`.
- `src/lib/i18n/provider.tsx` — client context; `setLocale` updates state, cookie
  and localStorage, then `applyDocumentLocale` sets `lang`/`dir` without reload.
- Server components read the cookie via `getRequestLocale()` and pass
  `initialLocale`; the page wrapper also carries `dir` so RTL applies to inputs,
  icons and alignment (`start/end`, `rtl:rotate-180`).

## Verification status

- `npx next typegen`, `npx tsc --noEmit`, `npm run lint` — clean.
- Sanitizer checked against the real module (Node 24 type stripping):
  `12345678`, `+216 12 345 678`, `21612345678`, `0021612345678` → `12345678`;
  `123456789` → `12345678`; `1234567` → `1234567`; non-digits dropped.
- `/login` SSR serves the fixed `+216` prefix, `name="phone"` and placeholder
  `12345678`.
- Dev server (port 3001): `/` → 307 `/login`; unauthenticated `/dashboard` →
  307 `/login?reason=session`; English SSR; with `ambulink_clinic_locale=ar`
  cookie SSR returns Arabic copy with `dir="rtl"`, and the boot script sets
  `<html lang="ar" dir="rtl">` on reload; no fabricated marketing strings.
- **Not verified at runtime:** an actual hospital-manager sign-in, role
  rejection, reset submission, and client hydration/click-through. The in-app
  browser surface was unavailable (hidden page, `0x0` viewport), so React never
  hydrated there; those paths are verified by source only.

## Required backend actions (owner)

- Apply the existing train before a hospital manager can pass the entitlement
  checks: `202611100004 → 202611100010 → 202611100011 → 202611100012 → 202611100013`
  (013 fixes the `can_access_hospital_fleet` grant; do not re-apply 012 after it).
  `current_hospital_management_enabled()` and `is_active_hospital_manager()`
  come from that train.
- Deploy `password-reset-request` with `PASSWORD_RESET_ENC_KEY` for the reset
  panel to work.
- Dashboard tab: `supabase/migrations/202611100015_hospital_manager_dispatch_center.sql`
  (in the Flutter workspace root, **DRAFT — NOT APPLIED**) provides the manager's
  mission/attempt/offer read policies plus
  `hospital_manager_dispatch_center()`, `hospital_manager_create_mission(...)` and
  `hospital_manager_redispatch_mission(...)`. Before it is applied the dashboard
  shows the localized `dc.error.migration_pending` state; it never invents data.
  Driver responses still go through the existing `respond_to_mission_offer` and
  the existing 120 s attempt expiry. Nothing was applied or deployed.
- Fleet tab, in this order: `202611100016_hospital_manager_fleet.sql` →
  `202611100017_hospital_vehicle_records.sql` →
  `202611100018_hospital_manager_vehicle_record_writes.sql`. All are
  **DRAFT — NOT APPLIED**; until 016 is applied `/fleet` shows
  `migration_pending`, and until 018 the two history sections are read-only.
- Clinic-driver manual missions: `202611100019_hospital_driver_manual_missions.sql`
  (**DRAFT — NOT APPLIED**) replaces the 011 guard branch and
  `create_driver_manual_mission`. Do not apply
  `202611020003_driver_manual_missions.sql` after it, and apply
  `202611100015_hospital_manager_dispatch_center.sql` before it if at all.
  Nothing was applied or deployed here.

## Dashboard tab (manager dispatch center)

Layout follows the requested CAD structure, built from the existing design
tokens — dark `brand-900` sidebar with the five sections (Dashboard active; the
other four are `aria-disabled` "Soon" items), sticky command bar, six KPI cards,
central live map, right mission queue, bottom selected-mission details. No
standalone HTML, no new dependency, no generated logo (`/ambulink_logo.png` is
reused as-is).

- **Data authority:** every number comes from the single
  `hospital_manager_dispatch_center()` jsonb snapshot, computed
  `security definer` after `is_active_hospital_manager()` +
  `current_hospital_management_enabled()`. KPIs are: active missions
  (assigned, non-terminal), available/busy ambulances (`ambulances.status`),
  average response (`accepted_at - created_at`, `Africa/Tunis` day),
  completed today (same day boundary), fleet total and utilization
  (`busy / total`). A KPI with no denominator, no samples, or a pending
  migration renders the localized unavailable state, not a placeholder number.
  No trend arrows, percentages or historical comparisons are shown.
- **Hospital isolation:** missions are read by `target_hospital_id = manager's
  hospital` (hospital missions keep `company_id NULL`; that column is never
  used as the hospital key). Queue and details only consume the snapshot, so a
  second hospital's patient name/phone cannot be reached from this UI; RLS on
  missions, attempts, offers and drivers is the final authority.
- **Map:** dependency-free OSM slippy map (`tile.openstreetmap.org`, plain
  `div` tile background, Web Mercator math). Markers: hospital, drivers whose
  `location_updated_at` is within 120 s (live) or 10 min (delayed, lower
  opacity), and pickup/destination for non-terminal missions. Stale/missing GPS
  is hidden and counted, never interpolated. Road routes are drawn only from
  real OSRM geometry (see the geo section below): driver → pickup on
  accepted/en route, driver → destination in progress, dashed pickup →
  destination whenever both endpoints exist. No straight-line fallback, no
  ETA/traffic/movement invention; a failed route request shows a localized
  "route unavailable" chip while markers stay usable.
- **Queue:** nine filters mapped to real states — `awaiting` = requested,
  unassigned, attempt not expired; `expired` = requested, unassigned, attempt
  `state = 'expired'` (still shown as *expired offer*, never as a cancelled
  mission); the rest map directly to `missions.status`. Each card shows the
  offer countdown from the server deadline; the client never cancels anything,
  it only refetches after the deadline so the backend expiry is visible.
- **Details:** full name, `tel:` phone link (canonical `216XXXXXXXX` →
  `+216 …`), pickup, destination, motif (`missions.symptoms`), driver,
  ambulance and timestamps. Pickup/destination use `LocationLabel`: a stored
  label that is a real place is shown as-is, a coordinate-only label is
  reverse-geocoded once for display (never persisted), and a failed lookup
  falls back to `lat, lng`. Redispatch is offered only for manager-created
  missions awaiting a driver: broadcast or one specific eligible driver;
  duplicates and races are refused by the RPC's advisory lock and the
  first-accept-wins `respond_to_mission_offer`.
- **Lifecycle:** a separate `MissionLifecycle` card beside the details renders
  a vertical ladder (requested → dispatch → accepted → en route → arrived →
  in progress → completed). It shows done/current/upcoming states, an amber
  expired-offer state distinct from cancellation, and a terminal cancelled row
  with `cancelled_at` when present. Only real backend timestamps are printed
  (`created_at`, `accepted_at`, `completed_at`, `cancelled_at`); intermediate
  stages say "no event time recorded" because no columns exist for them.
- **Eligibility:** hospital driver (`drivers.hospital_id` = this hospital,
  `profiles.role = 'driver'`), `availability = true`, and no non-terminal
  mission. `ambulance_id` is optional, so a driver without a vehicle stays
  eligible.
- **Realtime:** one browser client per tab; one channel per table
  (`missions` filtered by `target_hospital_id`, attempts, offers, drivers
  filtered by `hospital_id`, ambulances). Mission/attempt/offer/ambulance
  events trigger one debounced (400 ms) snapshot refetch; driver GPS rows are
  patched in place at most once per 900 ms without a full refetch. Polling is a
  20 s fallback only while the socket is not subscribed; `online`/`offline`
  events update the connection pill. All channels/timers are removed on
  unmount. Selection, filter and scroll state live above the refresh, so a
  refetch does not reset the operator's view.
- **New mission dialog:** manager-created hospital mission with patient name,
  `+216` phone, motif and optional map picking. Pickup and destination are
  debounced Nominatim autocomplete fields (350 ms, 3-char minimum) that store
  the selected `lat/lng` with its label; a map click reverse-geocodes the
  point, and an unresolvable point asks for a manual label instead of
  inventing one. A hospital selector (own hospital plus `/api/hospitals`) sets
  the destination from stored coordinates and explains when the hospital has
  none. When both points are valid, the OSRM road preview is drawn and its
  distance/duration shown. Submission keeps the existing
  `hospital_manager_create_mission` contract — no new column, optional fields
  stay optional. Dispatch stays broadcast or one specific eligible driver. The
  request key is generated once per dialog mount so a retry replays
  idempotently instead of creating a second mission.
- **Verification:** `npx tsc --noEmit`, `npx eslint src` and
  `npm run build` are clean (`/dashboard` builds as a partial-prerender
  route, `/api/geo/*`, `/api/route` and `/api/hospitals` build as dynamic
  routes). **Not runtime-verified:** live Realtime events, dispatch, GPS
  movement, route drawing against live OSRM traffic and manager-authenticated
  screens — the migration below is unapplied, so the dashboard currently
  resolves to the migration-pending state. Login SSR and hydration were
  checked in a clean browser instance (see below).

## Dashboard improvements (2026-11-11)

Expanded the existing Dashboard tab only. No other tab, no auth change, no
schema change. `supabase/migrations/202611100015_hospital_manager_dispatch_center.sql`
remains **DRAFT — NOT APPLIED**; no Edge Function was deployed.

### Geocoding and routing (same providers as the patient map)

The Flutter patient map uses Nominatim for place names and the public OSRM
router for road geometry. The Clinic app reuses both through session-gated
Next route handlers, so no new provider and no API key are introduced:

- `GET /api/geo/search?q=&lang=` → Nominatim `/search` (`format=jsonv2`,
  `limit=6`, `addressdetails=1`, `accept-language`). Label = first
  `display_name` part, detail = next parts.
- `GET /api/geo/reverse?lat=&lng=&lang=` → Nominatim `/reverse`
  (`zoom=16`), first three parts.
- `GET /api/route?from=lat,lng&to=lat,lng` → OSRM
  `/route/v1/driving/{lng},{lat};{lng},{lat}?alternatives=3&overview=full&geometries=geojson&steps=false`,
  shortest valid route only.
- `GET /api/hospitals` → active hospitals with stored coordinates via the
  existing `hospitals` RLS; `42703` is reported as
  `coordinates_not_configured` instead of inventing a position.
- All four require a Supabase session (`requireSession()`), validate their
  parameters and return `502 {error:"provider_unavailable"}` on provider
  failure. Nominatim calls are serialized at ~1.1 s and cached server-side
  (search 5 min, reverse 20 min, route 2 min); the browser adds its own
  in-memory caches. Provider base URLs and User-Agent are configurable with
  `AMBULINK_GEOCODING_BASE_URL`, `AMBULINK_GEOCODING_USER_AGENT` and
  `AMBULINK_ROUTING_BASE_URL` (defaults match the Flutter app, HTTPS
  required).

Route requests from the map are throttled to at most one batch per 6 s and
skipped below 25 m of driver movement, mirroring the patient screen. They are
only requested for routable statuses and only when the driver fix is live
(≤ 120 s); previous geometry is kept on failure so the map does not flicker.

### Hydration warning

The reported `cz-shortcut-listen="true"` mismatch is not produced by this app:
the repository has no such attribute, SSR `<body>` contains only `class`, and
`<html>` already carries the single `suppressHydrationWarning` needed by the
locale boot script. `cz-shortcut-listen` is injected client-side by the
ColorZilla browser extension before React hydrates. Verified on the production
build (`next start`): `/login` SSR has no `cz-shortcut-listen`, and a clean
browser instance (no extensions) shows `body` attributes `["class"]` and zero
console messages after hydration. No extra `suppressHydrationWarning` and no
change to the locale script were made.

### Known gaps

- Dashboard screens still require the unapplied `202611100015` migration, so
  manager-authenticated runtime checks (live routes, dispatch, autocomplete
  inside the dialog) were not possible here.
- Intermediate lifecycle timestamps do not exist in the schema; the ladder
  states that instead of inventing them.
- Hospital directory needs the `hospitals` coordinate columns; when absent the
  selector lists names only and explains why no destination point is set.

## Fleet tab (2026-11-11)

New route `/fleet`, reachable from the shared sidebar. The Dashboard tab is
unchanged apart from `Sidebar` gaining a `current` prop and real links.

**Backend dependency — DRAFT, NOT APPLIED:**
`ambulink/supabase/migrations/202611100016_hospital_manager_fleet.sql` (in the
Flutter repo, same database). Until the user applies it, `/fleet` renders the
migration-pending error state. It adds:

- `hospital_manager_fleet_snapshot()` — returns the caller's own hospital plus
  its non-archived `ambulances` (`hospital_id = <caller hospital>`), the joined
  driver fields, and the active mission per vehicle. Every row is derived on the
  server from `is_active_hospital_manager()`; no hospital id comes from the
  client.
- `hospital_manager_save_ambulance(...)` — insert/update limited to
  `label`, `plate_number`, `mileage`, `status`, `hospital_id`; `company_id` is
  always null; rejects status changes while a mission is active.
- `hospital_manager_assign_ambulance_driver(...)` — writes only
  `ambulances.driver_id`; never touches `drivers`, so a vehicle-less driver
  stays dispatch-eligible.
- `ambulances` added to the `supabase_realtime` publication (migration also
  posts preflight/postflight notice and `notify pgrst`).

Route guards: `src/proxy.ts` now redirects unauthenticated `/fleet` requests to
`/login?reason=session`, same as `/dashboard`; `requireHospitalManager` runs in
the page.

### Data layer (`src/lib/fleet/`)

- `types.ts` — the RPC contract, error unions per operation.
- `service.ts` — `fetchFleetSnapshot`, `saveHospitalAmbulance`,
  `assignHospitalAmbulanceDriver`; maps Postgres codes (`42883`/`42P01`/`42703`/
  `PGRST202` → `migration_pending`, `42501` → `access_denied`, `P0002` →
  `not_found`, `23505` → `conflict`). Writes are RPC-only: PostgREST cannot
  update `ambulances.mileage` (column grant) and managers have no `drivers`
  UPDATE, so no direct table write is attempted.
- `server.ts` — SSR first snapshot for the initial render.
- `use-fleet.ts` — client state + Realtime. Channels:
  `fleet-ambulances-<hospital>` (`hospital_id=eq.`), `fleet-drivers-<hospital>`
  (`hospital_id=eq.`, UPDATE patches in place after 900 ms, INSERT/DELETE
  refetch), `fleet-missions-<hospital>` (`target_hospital_id=eq.`). 400 ms
  debounce, 20 s fallback poll, online/offline listeners, full cleanup on
  unmount. If the first load fails there is no hospital id to subscribe with,
  so the connection pill goes `reconnecting`/`offline` instead of hanging on
  "connecting".
- `status.ts` — one derivation source, exclusive precedence:
  `maintenance > on_mission > unassigned > available (driver_availability) >
  offline`. `assigned` filter = has `driver_id`; KPIs and filters both read it.
- `messages.ts` — error-code → `MessageKey` mapping.

### Derived behaviour

- On mission = the vehicle has an active mission row (`accepted`, `en_route`,
  `arrived`, `in_progress`, `completed_at`/`cancelled_at` null). The stored
  `ambulances.status` never means "on a mission".
- Utilization = `round(100 * onMission / total)`; null (rendered as
  unavailable) when the fleet is empty. No trends or percentages are invented.
- Location = the assigned driver's stored fix, reused from
  `src/lib/geo/freshness`: live ≤ 120 s, delayed ≤ 600 s, otherwise stale.
  Other hospitals' coordinates are never read. No Track-on-Map button because
  no per-vehicle tracking view exists.

### Deliberate omissions (no matching schema)

- No vehicle type column exists → no type search or type filter.
- Manager-visible driver phone and per-vehicle fuel/maintenance history arrived
  with `202611100017` (draft, see the next section); they are not part of
  `202611100016`, so until 017 is applied the details panel shows "no phone
  recorded" and the two history sections show the migration-pending error.
- No deactivate/delete action: manager archive support is not in the RPC.
- No ETA, speed, oxygen, CAN or sensor telemetry is shown.
- Assignment of a driver who already sits on another vehicle, or replacing a
  vehicle's current driver, requires an explicit confirm in the dialog; the RPC
  returns the conflict code and the dialog surfaces it.

### Verification

`npx tsc --noEmit`, `npx eslint src` and `npm run build` are clean (`/fleet`
builds as a partial-prerender route). Production server check: `/fleet` and
`/dashboard` both return `307 → /login?reason=session` when unauthenticated;
`/login` returns 200. **Not runtime-verified:** the authenticated Fleet UI,
Realtime updates, driver assignment, GPS freshness and KPI-vs-records — the
migration is unapplied, so the page resolves to the migration-pending state.

## Fleet vehicle records and clinic driver tabs (2026-11-11)

Follow-up to the Fleet tab and the Flutter driver « Mon ambulance » workspace.

### Internal identifiers removed

- The details panel no longer renders "Internal ID" / the vehicle UUID, the
  registry row no longer prints an 8-char id under the name, the mobile card
  falls back to the plate (or `—`), and the assignment dialog shows label →
  plate → `—`. UUID search was removed from `status.ts`; searching by an
  identifier the manager cannot see made no sense.
- Real fields kept: label, plate, mileage, stored status, added date, driver,
  mission, map. `id` is still used as a React key / RPC argument only.

### Manager-visible driver phone

- `hospital_manager_fleet_snapshot()` is replaced by the same function with one
  extra field: `driver_phone` = the joined driver profile's `phone`. It is
  emitted only inside the already manager-gated snapshot — no profile RLS
  change, no public read, no client-side profile query.
- `fleet-details.tsx` formats it with `@/lib/phone`
  (`normalizeTunisianPhoneDigits` → `formatTunisianPhone`) and links
  `tel:+216XXXXXXXX`. Unknown/blank phone renders "No phone number is recorded
  for this driver" instead of inventing a number.
- Both replaced functions live in the **draft, not applied**
  `ambulink/supabase/migrations/202611100017_hospital_vehicle_records.sql`.

### Sidebar gap while scrolling

Actual cause: the shell scrolled the document (`min-h-dvh`) while the sidebar
was a `sticky h-dvh` child, so its column ended where the flex line ended and
the page background showed through. Fix is structural, in both
`src/app/fleet/fleet-view.tsx` and `src/app/dashboard/dashboard-view.tsx`:
shell `flex h-dvh overflow-hidden bg-surface`, `Sidebar` a direct static child
(`h-full` fills the viewport), and the right column
`flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto` owns the scroll; the
sticky header/CommandBar stays inside it. No white-background patch, no design,
nav or active-state change.

### Fuel and maintenance history (manager)

- `FleetHistory` (`src/components/fleet/fleet-history.tsx`) is rendered **once,
  inside the left content column, below the registry table**; it is not nested
  in `fleet-details.tsx` (the old `fleet-records.tsx` was deleted). Page order
  is KPIs → two-column grid (left: toolbar + table + history; right: vehicle
  details panel) at ≥1280 px, and one stacked column below that.
- It calls `hospital_manager_ambulance_records(p_ambulance_id)` for the
  currently selected registry row and renders two independent sections — fuel
  (price, liters, unit price, type, station, mileage, notes, recorder,
  `recorded_at`) and maintenance (type, cost, mechanic, mileage, next due,
  repairs, notes, recorder, `performed_at`) — newest first, max 200 rows each.
  Each section has its own heading/icon, count, empty state, add button and a
  `max-h-[26rem]` scroll area.
- The card names the selection as `label · plate`; with no selection both
  sections show an instruction instead. The fetch is keyed by ambulance id, so
  a previous vehicle's rows never appear under a new selection and the
  selection itself is not reset by Realtime snapshot refreshes.
- Server-side ordering: fuel `recorded_at desc, id` (the table has no
  `created_at`); maintenance `performed_at desc, created_at desc, id`.
- States: skeleton + `sr-only` loading text, empty text per section, error box
  with retry; `migration_pending` gets its own message naming `202611100017`.
  No fabricated values.
- The RPC resolves the caller's hospital, verifies the ambulance belongs to it,
  then returns only that vehicle's rows (both columns are hospital-owned after
  017).

### Manager record creation (fuel / maintenance)

- `FleetFuelDialog` and `FleetMaintenanceDialog`
  (`src/components/fleet/fleet-record-dialog.tsx`) are opened from the two
  history sections and always target the selected ambulance.
- Fields mirror the driver forms: fuel = total price + mileage (required),
  quantity, price/litre, type, station, date, notes; maintenance = cost +
  mileage (required), type, mechanic, repairs, next mileage, next date,
  performed date, notes. Mileage is prefilled from the vehicle. **No
  card-number field exists.**
- `createFleetFuelRecord` / `createFleetMaintenanceRecord`
  (`src/lib/fleet/service.ts`) call
  `hospital_manager_create_fuel_record` /
  `hospital_manager_create_maintenance_record`. One request key per dialog
  mount makes retries idempotent; submit is locked while pending; server error
  codes map to localized messages (`fleet.record.error.*`).
- On success the dialog closes, the section refetches, and the fleet snapshot
  refreshes so registry/KPI mileage follows the server-side
  `assert_ambulance_mileage_increase`; selection and page state are kept.

### Clinic-driver manual missions (mission access fix)

- The Flutter gate was already correct (`current_hospital_management_enabled()`
  when `drivers.company_id` is null). The "L'accès à cette fonctionnalité est
  réservé…" message came from the database: the 011 `driver_manual` guard branch
  and `create_driver_manual_mission` were company-only and raised 42501.
- `202611100019_hospital_driver_manual_missions.sql` (draft) makes both
  branches accept a hospital scope gated on the real
  `hospitals.management_enabled` entitlement, requiring an active driver of
  that hospital. Managers, company drivers and dispatch eligibility are
  unchanged; an ambulance is not required.

### Clinic driver « Mon ambulance » (Flutter)

- Hospital drivers now see **two** mini-tabs, "Véhicule & carburant" and
  "Maintenance"; "Équipements & inventaire" is not rendered (company-only).
  Indices stay `0 = vehicle/fuel, 1 = equipment (company), 2 = maintenance`, so
  no other code path shifts.
- `_loadAll` for hospital drivers now loads fuel statements + maintenance + the
  odometer (was mileage only) through the same `DriverAmbulanceService`
  methods; a vehicle change still drops the previous rows and generation
  guards cancel stale loads.
- Fuel UI is the shared `_buildFuelRecordsSection`: the same "Nouveau plein"
  form and validation (total price and mileage required), no card mode, no
  card picker, and the summary hides the fuel-card stat for hospital drivers.
  Maintenance reuses `_maintenanceSection`, its sheet, edit/delete menu and
  required price+mileage.
- Writes go through the existing `driver_create/update/delete_fuel_record` and
  `driver_create/update/delete_maintenance_record` RPCs, whose draft
  replacements resolve company **or** hospital scope server-side from the
  driver's current assignment and write both `company_id`/`hospital_id` and
  `driver_id`. Editing/deleting a row re-checks the ambulance's current scope,
  so a reassigned driver cannot touch the previous vehicle's records, and the
  mileage helpers (`assert_ambulance_mileage_increase`,
  `recalculate_ambulance_mileage`) are called exactly as before. Mission
  eligibility is untouched.

### Draft migration 202611100017 (owner must apply; nothing was deployed)

`ambulink/supabase/migrations/202611100017_hospital_vehicle_records.sql`,
apply after 004/005/009/011/013/010/011/012/016. It:

- adds nullable `hospital_id` (FK → `hospitals`, `on delete restrict`) to
  `ambulance_fuel_records` and `ambulance_maintenance_records`, drops NOT NULL
  on their `company_id`, and adds mutual-exclusion / hospital-driver-required
  checks plus partial indexes;
- adds a `security definer` boolean read gate
  `hospital_driver_can_read_ambulance_records(...)` granted to authenticated,
  and SELECT policies so a hospital driver reads only their own rows on their
  currently assigned, non-archived hospital ambulance (existing `_select_own`
  policies untouched);
- rewrites the six driver record RPCs with the same signatures/validation to
  resolve dual scope through the internal `driver_ambulance_record_scope`
  helper (revoked from clients);
- adds `hospital_manager_ambulance_records(uuid)`, gated by
  `assert_hospital_manager_fleet_access()`;
- re-creates `hospital_manager_fleet_snapshot()` with `driver_phone`.

No RLS is disabled, no driver profile becomes readable outside the manager
snapshot, and no new table is introduced.

### Draft migrations 202611100018 / 202611100019 (owner must apply; nothing was deployed)

`ambulink/supabase/migrations/202611100018_hospital_manager_vehicle_record_writes.sql`
(apply after 017) adds the manager write RPCs, a manager-actor alternative in
the record CHECK constraints, per-hospital `client_request_key` unique indexes
and re-creates `hospital_manager_ambulance_records(uuid)` with manager-first
`recorded_by` attribution. It is RPC-only: no table-level write grant, no RLS
change.

`ambulink/supabase/migrations/202611100019_hospital_driver_manual_missions.sql`
(replacements for the 011 guard and `create_driver_manual_mission`) is the
clinic-driver mission fix; **do not apply `202611020003_driver_manual_missions.sql`
after it**, and apply `202611100015_hospital_manager_dispatch_center.sql` before
it if at all — 015 recreates the same guard with the company-only manual branch.

### Verification (records + Fleet layout)

`npx tsc --noEmit`, `npx eslint src` and `npm run build` are clean after the
layout and record-creation changes (`/fleet` and `/dashboard` build as
partial-prerender routes). Flutter `flutter analyze` has no errors (69
pre-existing infos/warnings project-wide; no Flutter code changed for this
task). `flutter test test/driver_ambulance_tab_refresh_test.dart` passes 4/4
with the hospital case asserting the two tabs, the absence of the equipment tab
and the maintenance section. The full `flutter test` run has 5 failures in
`app_redirect_test.dart` and `ambulance_request_screen_test.dart` caused by an
uninitialized `Supabase.instance` and an unrelated role-routing expectation;
they are pre-existing and outside this change. **Not runtime-verified:** the
authenticated Clinic Fleet page, the two manager create RPCs, mileage update,
cross-hospital refusal, Realtime selection retention and clinic-driver manual
mission creation, because 017/018/019 are unapplied. No SQL was executed and no
backend function was deployed.

### Fleet tab overlap fix (2026-11-11)

The right-hand vehicle details panel visibly covered the start of the fuel /
maintenance history card and swallowed clicks there. Cause: `FleetHistory` was
a **full-width sibling below** the two-column grid, while the details cell used
`xl:max-h-[calc(100dvh-6rem)]` around a panel whose `h-full` resolved against
an auto-height sticky wrapper. The panel's own scroller therefore had no
definite height to constrain it, so excess content painted outside the clamped
box — straight over the history card that shared the same horizontal band. The
`sticky` wrapper also made the panel read as floating over the page.

The fix is structural, in `src/app/fleet/fleet-view.tsx`:

- one grid owns the whole content area: `grid items-start gap-4
  xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]`;
- left column (`xl:col-start-1 xl:row-start-1`) = toolbar + registry table;
  history moves into a second left cell (`xl:col-start-1 xl:row-start-2`);
- details panel cell (`xl:col-start-2 xl:row-span-2 xl:row-start-1`) is a
  normal in-flow column — no `sticky`, no `fixed`, no `max-h`, no z-index
  change. The panel keeps its natural height and scrolls with the page.
- below 1280 px the grid is a single column in source order: toolbar + table →
  details panel → history, all full width. No floating layer at any width.
- `gap-4` and the main column's `min-w-0` are what keep the two columns apart;
  the panel width is reserved by the grid track, so it never shares a
  horizontal band with the table or history. RTL mirrors automatically because
  grid columns and `col-start` follow the writing direction.
- nothing inside `fleet-details.tsx` changed: Current Mission, map, GPS
  freshness, edit/assign/refresh actions and data queries are untouched.

Verified against the compiled Tailwind output from this build (same class
strings, same CSS) in exact-width iframes at 1920 / 1440 / 1024 / 768 / 390:
grid tracks resolve to `1fr + 380px` (1920), `1fr + 340px` (1440) and a single
column below 1280; the panel rect never intersects the toolbar, registry or
history rects at top, mid and bottom scroll; `scrollWidth - clientWidth` is 0
for both the scroll container and the document; both history add buttons are
inside the viewport and receive the click; the last row of each history list is
reachable. `npx tsc --noEmit`, `npx eslint src` and `npm run build` are clean
and `/login` returns 200 with `/fleet` and `/dashboard` redirecting 307 to the
session gate. **Not runtime-verified:** the authenticated Fleet screen itself
(no credentials in this workspace); the harness reproduces the layout contract,
not live data or Realtime rendering.

### Fleet history statistics and server-side pagination (2026-11-11)

The fuel and maintenance sections of the Fleet history each show period
statistics and one server-paged list; the full history never reaches the
browser.

- **Backend (draft `202611100020_hospital_vehicle_history_paging.sql`, NOT
  APPLIED):** `hospital_manager_fuel_history` and
  `hospital_manager_maintenance_history` take `(ambulance, period, page_size,
  offset)`, re-derive the hospital with `assert_hospital_manager_fleet_access()`
  and return `total_count`, a `stats` object and only the requested page. The
  statistics and the page come from one SQL statement, so they share a
  snapshot. Order keys are unique: fuel `recorded_at desc, id desc`,
  maintenance `performed_at desc, created_at desc, id desc`. Page size is
  validated to 20/50/100. Periods are Africa/Tunis calendar windows (`month`,
  `3m`, `6m`, `year`, `all`) resolved by the internal
  `hospital_history_period_start`.
- **Realtime:** both record tables are added to `supabase_realtime` and get one
  additive manager SELECT policy (`is_active_hospital_manager(hospital_id)`).
  No write policy/grant is added. The client uses one channel for both tables,
  filtered by hospital, and refreshes only the section whose `ambulance_id`
  matches the selection. Filtered DELETE events are not delivered with the
  default replica identity; a later fetch reconciles.
- **Client:** `src/lib/fleet/use-history.ts` owns the two sections. Its
  `resetKey` (ambulance · period · page size) derives page 1 immediately, so a
  vehicle/period/page-size change never requests the previous page and the
  registry selection is untouched. `fleet-history.tsx` renders the period
  select (default **All time**, preserving the previous unfiltered view), four
  compact stat tiles per section, the list, and a footer with `from–to of
  total · page x of y`, 20/50/100 selector and Previous/Next. Unavailable
  values render `—`; fuel cost/average require every row in the period to be
  priced and quantity requires every row to have liters.
- **Saved flow:** a new entry refreshes only that section's stats and current
  page, then still refreshes the Fleet snapshot for mileage/KPIs.

Verified with `npx tsc --noEmit`, `npx eslint` on the changed files and
`npm run build` (all clean). **Not runtime-verified:** aggregate values, page
boundaries over large data, period filtering, cross-hospital refusal and
Realtime delivery — 202611100020 is unapplied and no database was queried.
No test script exists in this app.

### Drivers tab — registry, KPIs, details and ambulance assignment (2026-11-11)

Route `/drivers`, gated by the same `requireHospitalManager()` server check as
Dashboard and Fleet; `proxy.ts` redirects unauthenticated visits and the
sidebar item is now a real link (`SidebarSection` gained `drivers`). The
prototype supplied the layout only — every field maps to a deployed column.

- **Identity:** a hospital driver is `drivers.id = profiles.id` with
  `profiles.role = 'driver'`, `drivers.hospital_id` and an active
  `hospital_memberships` row (`membership_role = 'driver'`). Phone is
  `profiles.phone` (`216XXXXXXXX`); assignment is `ambulances.driver_id`.
  There is no avatar, email, certification, shift, rating or manager-visible
  `is_active` column, so none of those is rendered.
- **KPIs (DB-side, one statement with the page):** total = active hospital
  drivers, including unassigned; online = `drivers.availability is true`;
  available = online with no non-terminal mission; on mission = non-terminal
  mission targeting this hospital. A driver without an ambulance is counted
  and stays eligible for offers.
- **Backend (draft `202611100021`, NOT APPLIED):**
  `hospital_manager_drivers_page(p_search, p_status, p_assignment, p_page_size,
  p_offset)` and `hospital_manager_driver_stats(p_driver_id)`, both
  `security definer` and scoped by `assert_hospital_manager_fleet_access()`,
  never a client-supplied hospital id. Search uses `position()` over name,
  phone digits and vehicle label/plate; page size is validated to 20/50/100
  and offset ≥ 0; ordering is `full_name nulls last, id`. The page RPC returns
  KPIs, total count, one page and the hospital ambulance options; the stats RPC
  counts only missions with `target_hospital_id` = caller hospital. Grants:
  `authenticated` only, `anon` revoked. Adds one partial index on
  `missions (driver_id, created_at desc)` and a guarded publication of
  `hospital_memberships` for Realtime. No profile RLS is widened, so phones
  come from this definer RPC instead of a readable `profiles` table.
- **Client:** `src/lib/drivers/{types,service,server,messages,use-drivers}.ts`
  own fetching, error mapping (`migration_pending` for 42883/42P01/42703/
  PGRST202, `access_denied`, `not_found`, `network`) and state.
  `useDrivers` keeps the last page visible while a new key loads, clamps a page
  past the end, and runs four single Realtime channels (`drivers`,
  `missions` filtered by target hospital, `ambulances`,
  `hospital_memberships`) with one 500 ms debounce plus a 20 s poll only while
  not subscribed; driver UPDATEs caused solely by GPS writes are ignored.
  Search, filters, page and selection stay in `drivers-view.tsx`, so a refresh
  never resets them.
- **UI:** header (no add button), four KPI cards, toolbar (debounced search,
  status and assignment filters), registry table for `md+` and card list below,
  server pagination footer, and a right-hand details panel. Phone numbers are
  `tel:` links; no UUID is shown. Details show contact, app online state,
  assigned ambulance (or an explicit Unassigned state with the eligibility
  note), current mission and real mission history (assigned/completed/
  cancelled, average accept delay, first/last timestamps). The assign dialog is
  driver-centric on the existing `hospital_manager_assign_ambulance_driver`
  RPC: busy ambulances disabled, replacement/move needs the existing
  confirmation flag, removal is explicit, and the driver stays offer-eligible
  after unassignment. Add/edit/disable/contact/shift actions are omitted
  because no manager-authorized backend exists for them.
- **i18n:** complete `drivers.*` block in en/fr/ar.

Verified with `npx tsc --noEmit`, `npx eslint src` and `npm run build`
(clean; `/drivers` is a partial-prerender route). Route smoke on `next start`:
`/login` 200, `/drivers` 307 → `/login?reason=session`, `/fleet` 307.
**Not runtime-verified:** the authenticated screen, KPI values, pagination
boundaries, assignment confirmations, cross-hospital refusal and Realtime —
202611100021 is unapplied, no database was queried and no SQL was executed.

## Request-time rendering for authenticated pages (2026-11-11)

`requireHospitalManager()` calls `supabase.auth.getUser()`, and the Supabase
Auth client reads `Date.now()` while resolving the session. Rendering that
subtree during the shell prerender therefore triggers Next's unstable
`Date.now()` validation. `/fleet` and `/drivers` now call `await connection()`
(as the first statement of `FleetContent` / `DriversContent`) inside their
existing `<Suspense>` boundary, so only the authenticated content is deferred
to request time; nothing global was made dynamic and the skeleton fallbacks are
unchanged. `/dashboard` and `/login` already resolved the session indirectly and
were not modified.

Correction (Task 197): with auth moved into the `(clinic)` layout, that indirect
dynamic read no longer covers the page segment, so **every** tab page now calls
`await connection()` itself — `/dashboard` included. Without it Next prerenders
`/dashboard` and rejects the map's render-time clock (Blocking Route);
`next build --debug-prerender` now reports none.

## Manager-created hospital drivers (2026-11-11)

- UI: **Ajouter un conducteur** in the Drivers header opens
  `DriverCreateDialog` with the hospital fixed and non-selectable.
- Server action: `src/app/actions/drivers.ts` → `functions.invoke(
  "provision-hospital-user")` using the SSR cookie session. No service-role key
  in this app; the Edge Function performs the privileged work.
- Edge Function contract: a caller with `profiles.role = 'hospital_manager'`, an
  active `hospital_memberships` row (`hospital_manager`), `hospitals.is_active`
  and `hospitals.management_enabled` may create **driver** accounts only. The
  hospital id comes from that membership; a mismatched body id is rejected with
  `hospital_not_authorized`, `account_type='hospital_manager'` with
  `account_type_not_allowed`. Platform-admin creation is unchanged.
- Created shape: `auth.users` (E.164 phone) → `profiles` (`role='driver'`,
  canonical `216XXXXXXXX` phone, `fr`) → `hospital_memberships`
  (`driver`, active) → `drivers` (`company_id = NULL`, `hospital_id`,
  `availability = false`). Failure keeps the existing cleanup order (membership,
  driver row, profile, auth user).
- The form mirrors the Admin hospital-driver fields (name, +216 phone,
  password ≥6, confirmation, phone-ownership checkbox); no ambulance is chosen,
  so the new driver stays mission-eligible while unassigned.
- **Deployment pending:** the edited `supabase/functions/provision-hospital-user`
  is not deployed, and `202611100021` (Drivers registry RPCs) is still
  unapplied. Until both are done, the Drivers screen reports
  `migration_pending` and creation will not work remotely.
- Verified with `npx tsc --noEmit`, `npx eslint .` and `npm run build` (clean;
  `/drivers` and `/fleet` are partial-prerender routes with no `Date.now()`
  error). Route smoke on `next start`: `/login` 200, `/drivers` `/fleet`
  `/dashboard` 307 → `/login?reason=session`. Manager-authenticated creation was
  not runtime-tested (needs the redeployed function, applied 202611100021 and
  real credentials).

## Medical reports tab (2026-11-11)

- **Navigation:** the disabled **Missions** sidebar item became **Comptes rendus
  médicaux** (`/reports`, `FileHeart`); the disabled "Historique et rapports"
  item was removed so there is exactly one medical-reports tab. Mission
  dispatch, mission tables and the driver app are untouched. `src/proxy.ts`
  added `/reports` to its optimistic unauthenticated fence; the page-level
  `requireHospitalManager()` remains authoritative.
- **Verified data model:** `medical_reports` is the working head (one per
  mission); `medical_report_revisions` is an immutable snapshot with unique
  `(report_id, revision_no)`; the five child tables
  (`medical_report_needs`, `medical_report_custom_needs`,
  `medical_report_medications`, `medical_report_respiratory_supports`,
  `medical_report_pse_medications`) are keyed `(report_id, revision_no)`, where
  `0` is the working copy and `N` is frozen. `medical_report_transmissions` is
  the append-only audit of who asked which revision to be sent to which
  hospital. `patient_medical_profiles.patient_id` is the patient's
  `profiles.id`, reached through `missions.patient_id`.
- **Existing transmission workflow (reused, not rebuilt):** the Flutter driver
  form calls `transmit_medical_report(report_id, hospital_id, revision_no)`,
  which inserts the transmission row and sets
  `medical_reports.status='transmitted'`, `hospital_id` and `transmitted_at`.
  A finalized-but-untransmitted report keeps `hospital_id`/`transmitted_at`
  null and is therefore invisible to every hospital. Editing after a
  transmission sets the head back to `draft` but leaves the sent revision and
  its audit row intact.
- **Hospital scope:** a report is "received" only when a
  `medical_report_transmissions` row exists for the caller's hospital. The
  visible revision is the highest one transmitted to that hospital. The
  hospital is derived from the caller's active `hospital_memberships` row plus
  `is_active_hospital_manager()`; `company_id` is never used as a hospital and
  no hospital id is accepted from the browser.
- **Backend draft (NOT APPLIED):**
  `supabase/migrations/202611110001_hospital_manager_medical_reports.sql`
  adds `medical_report_reviews` (append-only; PK
  `(report_id, hospital_id, revision_no, consulted_by)`) and three
  `security definer` RPCs: `hospital_manager_medical_reports_page`,
  `hospital_manager_medical_report_detail`,
  `hospital_manager_mark_medical_report_consulted`. It also adds a private
  `assert_hospital_manager_medical_access()` helper. No table grant or RLS
  policy is widened, no medical table is added to Realtime, and consulting a
  report never updates the driver's head row, `transmitted_at` or revision.
- **KPI semantics:** total = distinct reports with a transmission to this
  hospital; à consulter = latest transmitted revision has no review row;
  consultés = it has one; transmis récemment = latest transmission in the last
  seven days.
- **UI:** split view with four KPIs, debounced search on patient name or
  mission UUID, review/type/driver/date filters, newest/oldest sort, 20/50/100
  server pagination, report list, and a detail viewer with header, transport
  and mission, before/after vitals, history/pathologies, needs and custom
  needs, respiratory supports (with legacy scalar fallback), medications, PSE
  medications, exact observations, the emerald patient-declared dossier,
  transmitted-revision timeline, mark-as-consulted and A4 print/PDF. The
  emergency phone is returned only by the manager detail RPC. No mission
  detail route exists in this app, so no "view mission" link is offered; the
  full mission UUID is displayed instead.
- **Refresh:** clinical tables are intentionally unpublished (202610270002),
  so there are no Realtime subscriptions. A single 30 s visibility-gated
  refresh plus the manual button reloads the current page; selection, filters
  and page live in the view and survive it.
- **Deployment:** apply `202611110001` manually after the medical-report train
  (`202610270001/0002/0004/0006`, then `202611010002`). If the five child
  tables are absent the migration stops with `apply 202610270006 first`. Do not
  rerun already applied migrations. No Edge Function change is required.
- **Verification:** `npx tsc --noEmit`, `npx eslint src` and `npm run build`
  are clean; `/reports` builds as a partial-prerender route. Route smoke on
  `next start`: `/login` 200, `/reports` `/dashboard` `/fleet` `/drivers`
  307 → `/login?reason=session`. **Not runtime-verified:** the RPCs, KPI/list
  values, cross-hospital isolation, revision snapshots, consultation and print
  layout — the migration is unapplied and no database was queried or SQL
  executed.

## Medical report delivery and unread inbox (2026-11-11)

- **Delivery:** the Clinic inbox is the reception channel. A driver transmission
  now writes a `delivered` row in `medical_report_transmissions` and flips the
  report head to `transmitted` in one transaction, after the server resolves the
  hospital from the mission target, the driver's hospital or a previous
  delivery. The browser never supplies a hospital id. Draft migration
  `202611110005_medical_report_inbox_delivery.sql` (Flutter repo, **NOT
  APPLIED**) must run after `202611110001`.
- **Read path:** unchanged. `hospital_manager_medical_reports_page/detail` still
  derive the hospital from the caller's active membership and expose a report
  only through a transmission row for that hospital, so a report delivered to A
  is invisible to B.
- **Unread state:** `medical_report_reviews` is the inbox flag. The new
  `hospital_manager_mark_medical_report_seen` sets or clears it per revision and
  hospital, and `hospital_manager_medical_reports_unseen` returns the unread
  count plus the newest unread entries. Both are manager-gated; clients still
  have no direct table access.
- **UI:** the sidebar polls the unseen RPC every 30 s while the tab is visible,
  shows a red count on Medical reports, and shows one dismissible toast per new
  `report_id:revision_no`. The first load seeds the known keys, so pre-existing
  reports never re-notify; a local seen/unseen toggle dispatches
  `ambulink:inbox-changed` and refreshes silently. The viewer now offers
  « Marquer comme non lu » alongside « Marquer comme consulté ». EN/FR/AR
  strings were added. Nothing here writes clinical content.
- **Verification:** `tsc --noEmit`, `eslint src` and `next build` are clean.
  **Not runtime-verified:** the RPCs, badge, toast and cross-hospital denial —
  the migration is unapplied and no database was queried. The owner applies it
  manually; nothing is claimed as deployed.

## Medical reports workspace redesign (2026-11-11)

`/reports` is now a compact clinical review workspace: header (hospital + title +
subtitle), four compact KPI cards (unseen tinted), one toolbar row with search,
segmented Tous / Non consultés / Consultés and an « Filtres avancés » panel, then
a master-detail grid (inbox 320–370 px, detail flexible). At `xl` both panels
scroll independently; below `xl` the list is the default and a selected report
opens full-width with « Retour à la liste ».

Data and state are unchanged: same `useReports`/`useReportDetail` hooks, RPCs,
filters, pagination, selection, refresh, 30 s poll, `INBOX_CHANGED_EVENT`,
consult/unseen writes, sidebar red counter and toast. No mock data, no new
fields, no localStorage, no logging. The fourth KPI stays the real 7-day count
because the page RPC has no per-day field.

The detail panel has no embedded document. It shows an identity header, the
seen/unseen pill and the single review action, then motif/mission, vitals as
before/after metric cards, respiratory support, medications, PSE, equipment,
observations, expandable history, the emerald patient dossier, a Document card
and expandable revisions. The Document card offers « Aperçu du document » (the
existing A4 `MedicalReportPrint` in a dedicated modal) and « Imprimer » (existing
print stylesheet; browser save-as-PDF). Nothing was invented: there is no stored
PDF, no download URL and no mission route.

Verification: `tsc --noEmit`, `eslint src`, `next build` clean; `/reports` is
still a partial-prerender route. Not runtime-verified: no database session or
manager credentials, so live data, review writes, badge/toast and responsive
breakpoints were not exercised in a browser. Real inbox data still requires the
unapplied `202611110001` + `202611110005`.

## Reports page: no document in the default layout (2026-11-11, correction)

The page-level `MedicalReportPrint` mount (a `.print-only` div in
`reports-view.tsx`) was removed together with its `.print-only` / `.screen-only`
CSS. The A4 document now mounts in exactly one place — `DocumentPreview`, after
the user clicks « Aperçu du document » — and that modal is portaled to
`document.body` with `body.document-viewer-open`, so printing from it emits only
the document. The default dashboard therefore has no iframe, embed, canvas, PDF
viewer or reserved document column in the right panel; the panel is entirely
structured report, patient dossier and document actions. Printing with the
viewer closed prints the dashboard instead of a blank page. The direct
« Imprimer » button in the Document card was dropped because it depended on the
hidden mount; printing remains in the viewer.

Data/state unchanged. Verified: `tsc --noEmit`, `eslint src/app/reports
src/components/reports`, `next build` (all clean; `/reports` still partial
prerender). Post-change search: `MedicalReportPrint` is referenced only by
`document-preview.tsx`. Not runtime-verified in a browser (no manager session);
live data still needs the unapplied `202611110001` + `202611110005`.

## Missions & Analytics tab (2026-11-11, new)

`/missions` is a new, additive tab (sidebar order: Dashboard, Missions &
Analytics, Medical reports, Fleet, Drivers) with its own route and skeleton.
Existing tabs were not renamed, replaced or restyled.

It is read-only and RPC-only: one call to
`hospital_manager_missions_analytics(p_from, p_to, p_status, p_search, p_sort,
p_page, p_page_size, p_bucket)` — a SECURITY DEFINER function in the
**unapplied draft** `supabase/migrations/202611110006_hospital_manager_missions_analytics.sql`.
The hospital is resolved server-side from the caller's active manager membership
(plus `is_active_hospital_manager()` and the management entitlement); the client
sends no hospital id and `company_id` is never used. Scope is
`missions.target_hospital_id` only.

The date range (Today / 7 days / 30 days default / This year / Custom) drives
the eight KPI cards, the activity chart, the status donut, the insights and the
driver counts. Status, search, sort and paging apply to the mission log only, so
filtering the log cannot distort the distribution. Bounds and buckets are
computed in `Africa/Tunis`; the series axis is continuous (empty days/weeks stay
visible).

Charts are native — CSS stacked bars and an SVG donut — so no dependency was
added. Driver figures are counts and averages only: no score, no ranking. The
volume trend is omitted (`ma.insights.noTrend`) when the previous equivalent
period is empty rather than printing a fabricated percentage. Missing
patient/driver/ambulance/destination or a `completed_at` absent from a completed
row render explicit "not provided"/"—" text; `completed_at` is never shown for a
non-completed mission.

The log is 9 columns at `xl` and one card per mission below it (no horizontal
overflow, no nested scroll); details open in a portaled modal with its own
scroll lock. Nothing is written anywhere: no inserts, updates, deletes,
subscriptions, localStorage or logging.

Verified: `tsc --noEmit`, `eslint src` (whole tree), `next build` (`/missions` a
partial-prerender route), and an anonymous `next start` + `curl /missions` →
`307 /login?reason=session`. **Not runtime-verified:** the migration is unapplied
and no manager session existed, so the RPC, live charts, modal, RTL and the
1366/tablet/mobile breakpoints were not exercised in a browser; until the
migration is applied the page shows its `migration_pending` state.

## Tab navigation: persistent shell, restored state, no duplicate fetches (2026-11-11, new)

All five tabs now live in one `(clinic)` route group
(`src/app/(clinic)/{dashboard,missions,reports,fleet,drivers}`; public URLs are
unchanged). `src/app/(clinic)/layout.tsx` resolves `connection()` +
`requireHospitalManager()` + `getRequestLocale()` once, under
`<Suspense fallback={<ClinicShellSkeleton />}>`, and renders `ClinicShell`
(`LocaleProvider` → `HospitalNameProvider` → `app-shell` with `<Sidebar>` and a
content column). Next keeps that layout mounted while switching siblings, so the
manager verification (six Supabase reads) and the sidebar — including its 30 s
unseen-report poll and toast dedupe — no longer restart on every tab; a switch
only loads the destination tab's data. Pages and views no longer import
`Sidebar`, `LocaleProvider` or `HospitalManagerSession`; the hospital name comes
from `useHospitalName()`, and the active item is derived from `usePathname()`.

The content column is keyed by `pathname` and runs one `tab-enter` animation
(150 ms, opacity 0.45 → 1, 3 px rise). It never starts from fully transparent,
the sidebar is outside it, and `prefers-reduced-motion` disables it. No
dependency was added.

`src/lib/navigation/tab-state.ts` provides `useTabState`, an **in-memory**
module store (no `localStorage`/`sessionStorage`: filter text can contain
patient names). It restores, per tab: dashboard selection + queue filter;
reports search/review/type/driver/dates/sort/selected report + revision; fleet
search/filter/page/selected vehicle; drivers search/status/assignment/selected
driver; missions preset/custom dates/search/status/sort/page/page size/selected
mission (by id, re-resolved against the loaded page so it never shows stale
numbers). Dialogs and in-progress forms stay local. The shell calls
`ensureTabStateScope(manager.userId)`, so a different account in the same
document starts clean; a full reload starts from defaults (the server never
writes the store, so the first render matches SSR). Reports and drivers
pagination remains hook-owned (`paging`/`pageSize`) and starts at page 1.

`useReports`, `useDrivers` and `useMissionsAnalytics` accept an `initialQuery`.
The server payload is adopted only when its query key matches the rendered
query, and only then is the mount fetch skipped; restored filters that differ
from the server default cause exactly one fetch. `DEFAULT_DRIVERS_QUERY` was
added and `loadMissionsAnalytics()` returns the query it fetched, so a default
visit still costs zero client requests. The missions window is derived on return
(30 d uses the server bounds, another preset is recomputed from `server_now`, a
custom window is rebuilt from the stored dates) and a preset refresh still moves
the upper bound.

Realtime is unchanged: each view creates its channels on mount and removes them
on unmount, and only the active tab is mounted, so there are no duplicate
subscriptions and inactive tabs do not poll. No schema, RLS, permission,
hospital-isolation or business-logic change was made.

Verified: `tsc --noEmit` (after the stale `.next/types` for the pre-move routes
were regenerated by a build), `eslint src`, `next build` (all five tabs are
partial-prerender routes), and `next start` + `curl` returning
`307 → /login?reason=session` for each tab. **Not runtime-verified:** no manager
session, so the authenticated tab switch, animation, restored filters, single
poll, Back/Forward and RTL/breakpoints were not observed in a browser, and the
request-count improvement is inferred from the call graph.

### Sidebar active item and hydration (same task, follow-up)

The layout shell is streamed before the router hands the pathname to the client,
so the server rendered every nav link unmarked while the client's first render
marked the current tab — React reported an attribute hydration mismatch on
`Sidebar` (`aria-current` and the active `className`). `Sidebar` now derives the
active item only after hydration (`useHydrated()`, a `useSyncExternalStore`
subscription with `getServerSnapshot = false`), so the server markup and the
first client render are identical; the highlight is then applied through the
link's existing colour transition. Client-side tab switches after hydration are
unaffected — `usePathname()` updates normally. `cz-shortcut-listen` in the same
console output is injected by the ColorZilla browser extension, not by this app,
and is not suppressed.

### Mission creation with a valid manager session (Task 198)

Creating a mission returned « Your access to this hospital changed. Sign in
again. » The client is not at fault and no session revalidation ran: the
`hospital_manager_create_mission` insert fires the `manager_entry` insert guard,
which in the last applied definition (202611100019) has no hospital-manager
branch and raises `manager_mission_owner_required` with SQLSTATE 42501.
`mapDashboardError()` maps 42501 to `dc.error.access_denied`, so a trigger
rejection surfaces as a session message. The manager, membership and hospital
were valid.

Rule: hospital authorization is `is_active_hospital_manager()` (active
`hospital_memberships` manager row + `hospitals.is_active` +
`hospitals.management_enabled`), with the hospital id resolved server-side from
the caller's membership. `patient_dispatch_enabled` gates patient-initiated
requests only and must not gate manager-created missions.

Backend fix is **draft** `supabase/migrations/202611110007_hospital_manager_mission_guard.sql`,
NOT APPLIED: it re-creates the guard with the company-manager, hospital-manager,
driver-manual and patient branches and re-creates `_hospital_manager_dispatch_attempt()`
without the patient-dispatch condition. No client change was needed and none was
made. Until the owner applies it, the create action keeps returning the same
false access error.

