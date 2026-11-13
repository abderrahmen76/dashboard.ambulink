import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const migration = read(
  "../../ambulink/supabase/migrations/202611130005_hospital_manager_mission_price.sql",
);
const service = read("../src/lib/missions/service.ts");
const hook = read("../src/lib/missions/use-mission-price.ts");
const modal = read("../src/components/missions/mission-detail-modal.tsx");
const types = read("../src/lib/missions/types.ts");
const format = read("../src/lib/missions/format.ts");
const dictionaries = read("../src/lib/i18n/dictionaries.ts");

test("1. draft is forward-only and adds no policy or broad grant", () => {
  assert.match(migration, /DRAFT, NOT APPLIED/);
  assert.match(migration, /^begin;/m);
  assert.match(migration, /^commit;/m);
  assert.doesNotMatch(migration, /create\s+policy/i);
  assert.doesNotMatch(migration, /drop\s+(policy|table|column)/i);
  assert.doesNotMatch(migration, /grant\s+(select|insert|update|delete)/i);
  assert.doesNotMatch(migration, /service_role/);
});

test("2. missing creator identity is documented with the smallest change", () => {
  // The schema had no authoritative creator column; the draft adds one that
  // references profiles and stays nullable for historical rows.
  assert.match(migration, /add column if not exists created_by_driver_id uuid/);
  assert.match(migration, /references public\.profiles\(id\) on delete set null/);
  assert.match(migration, /Historical rows keep `created_by_driver_id = null`/);
  assert.doesNotMatch(migration, /update public\.missions\s+set created_by_driver_id/);
});

test("3. future rows are captured only when a driver enters the mission", () => {
  assert.match(migration, /create or replace function public\.capture_manual_mission_creator\(\)/);
  assert.match(migration, /coalesce\(\(to_jsonb\(new\) ->> 'manual_entry'\)::boolean, false\)/);
  assert.match(migration, /and new\.driver_id = v_caller/);
  assert.match(migration, /before insert on public\.missions/);
  assert.match(migration, /new\.created_by_driver_id := v_caller;/);
});

test("4. A creates + A assigned remains the only positive case", () => {
  assert.match(migration, /v_eligible := v_mission\.manual_entry/);
  assert.match(migration, /v_mission\.created_by_driver_id is not null/);
  assert.match(migration, /v_mission\.driver_id is not null/);
  assert.match(migration, /v_mission\.driver_id = v_mission\.created_by_driver_id/);
  assert.match(migration, /creator\.hospital_id = v_hospital_id/);
});

test("5. a reassignment to B drops eligibility (creator != assigned)", () => {
  const eligibility = migration.slice(
    migration.indexOf("v_eligible :="),
    migration.indexOf("return jsonb_build_object"),
  );
  assert.match(eligibility, /driver_id = v_mission\.created_by_driver_id/);
  assert.doesNotMatch(eligibility, /or v_mission\.driver_id is not null/);
});

test("6. company, patient and manager missions can never be eligible", () => {
  // Company/patient rows have manual_entry false; patient/manager rows also
  // leave created_by_driver_id null because only the driver trigger sets it.
  assert.match(migration, /v_mission\.manual_entry/);
  assert.match(
    migration,
    /if coalesce\(\(to_jsonb\(new\) ->> 'manual_entry'\)::boolean, false\)/,
  );
  assert.doesNotMatch(migration, /target_hospital_id is not null.*v_eligible := true/s);
});

test("7. an unassigned mission hides the price", () => {
  assert.match(migration, /v_mission\.driver_id is not null/);
  assert.match(migration, /'price', case when v_eligible then v_mission\.price else null end/);
});

test("8. a manager of another hospital is denied without leaking existence", () => {
  assert.match(migration, /mission\.target_hospital_id = v_hospital_id/);
  assert.match(migration, /raise exception 'mission_not_found' using errcode = 'P0002'/);
  assert.match(migration, /or mission\.created_at >= clock_timestamp\(\) - interval '7 days'/);
});

test("9. access is derived from membership, never from an argument", () => {
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = pg_catalog, public/);
  assert.match(migration, /from public\.hospital_memberships membership/);
  assert.match(migration, /membership\.membership_role = 'hospital_manager'/);
  assert.match(migration, /is_active_hospital_manager\(v_hospital_id\)/);
  assert.match(migration, /revoke all on function public\.hospital_manager_mission_price\(uuid\)\s+from public, anon;/);
  assert.match(migration, /grant execute on function public\.hospital_manager_mission_price\(uuid\)\s+to authenticated;/);
  assert.doesNotMatch(migration, /p_hospital/);
});

test("10. the client asks for one mission and never infers eligibility", () => {
  assert.match(types, /export type MissionPrice = \{/);
  assert.match(types, /eligible: boolean;/);
  assert.match(service, /supabase\.rpc\("hospital_manager_mission_price", \{/);
  assert.match(service, /p_mission_id: missionId/);
  assert.doesNotMatch(service, /hospital_id|hospitalId/);
  assert.match(hook, /fetchMissionPrice\(supabase, missionId\)/);
  assert.match(hook, /\.channel\(`mission-price-\$\{missionId\}`\)/);
  assert.match(hook, /event: "UPDATE"/);
  assert.match(hook, /filter: `id=eq\.\$\{missionId\}`/);
});

test("11. the detail row renders only an eligible, non-null price", () => {
  assert.match(modal, /const \{ price \} = useMissionPrice\(row\.id\);/);
  assert.match(modal, /\{price !== null \? \(/);
  assert.match(modal, /t\("ma\.detail\.price"\)/);
  assert.match(modal, /formatMoney\(price, locale\)/);
  assert.match(format, /maximumFractionDigits: 3/);
  assert.match(format, /numberingSystem: "latn"/);
  assert.match(format, /TND/);
});

test("12. the new label exists in en, fr and ar", () => {
  const occurrences = dictionaries.split(`"ma.detail.price":`).length - 1;
  assert.equal(occurrences, 3);
  assert.match(dictionaries, /"ma\.detail\.price": "Mission price"/);
  assert.match(dictionaries, /"ma\.detail\.price": "Prix de la mission"/);
  assert.match(dictionaries, /"ma\.detail\.price": "سعر المهمة"/);
});
