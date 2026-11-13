import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const migration = read(
  "../../ambulink/supabase/migrations/202611130004_hospital_manager_mission_driver_contact.sql",
);
const service = read("../src/lib/dashboard/service.ts");
const hook = read("../src/lib/dashboard/use-driver-contact.ts");
const details = read("../src/components/dashboard/mission-details.tsx");
const types = read("../src/lib/dashboard/types.ts");
const dictionaries = read("../src/lib/i18n/dictionaries.ts");

test("1. draft is forward-only and adds no grant or policy", () => {
  assert.match(migration, /DRAFT, NOT APPLIED/);
  assert.match(migration, /^begin;/m);
  assert.match(migration, /^commit;/m);
  assert.doesNotMatch(migration, /grant\s+delete/i);
  assert.doesNotMatch(migration, /create\s+policy/i);
  assert.doesNotMatch(migration, /alter\s+table/i);
  assert.doesNotMatch(migration, /drop\s+(table|function|policy)/i);
  assert.doesNotMatch(migration, /service_role/);
});

test("2. only authenticated callers may execute the function", () => {
  assert.match(migration, /create or replace function public\.hospital_manager_mission_driver_contact\(/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = pg_catalog, public/);
  assert.match(
    migration,
    /revoke all on function public\.hospital_manager_mission_driver_contact\(uuid\)\s+from public, anon;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.hospital_manager_mission_driver_contact\(uuid\)\s+to authenticated;/,
  );
});

test("3. hospital is derived from the caller's active manager membership", () => {
  assert.match(migration, /from public\.hospital_memberships membership/);
  assert.match(migration, /membership\.membership_role = 'hospital_manager'/);
  assert.match(migration, /membership\.is_active/);
  assert.match(migration, /is_active_hospital_manager\(v_hospital_id\)/);
  assert.doesNotMatch(migration, /p_hospital/);
  assert.doesNotMatch(migration, /p_driver_id/);
});

test("4. a foreign or hidden mission is reported as mission_not_found", () => {
  assert.match(migration, /mission\.target_hospital_id = v_hospital_id/);
  assert.match(migration, /mission\.status::text not in \('completed', 'cancelled'\)/);
  assert.match(migration, /interval '7 days'/);
  assert.match(migration, /raise exception 'mission_not_found' using errcode = 'P0002'/);
});

test("5. the phone is resolved from the mission's own driver_id in profiles", () => {
  assert.match(migration, /where profile\.id = v_mission\.driver_id/);
  assert.match(migration, /select profile\.full_name, profile\.phone/);
  assert.doesNotMatch(migration, /from public\.drivers/);
  assert.doesNotMatch(migration, /company_id/);
});

test("6. unassigned missions return no driver fields", () => {
  assert.match(migration, /if v_mission\.driver_id is null then/);
  assert.match(migration, /'driver_phone', null/);
  assert.match(hook, /missionId && driverId \? `\$\{missionId\}:\$\{driverId\}` : null/);
  assert.match(details, /\{mission\.driver_id \? \(/);
});

test("7. a reassignment or release drops and refetches the contact", () => {
  assert.match(hook, /\}, \[key, missionId, driverId\]\);/);
  assert.match(hook, /result\.data\.driver_id === driverId/);
  assert.match(details, /mission\?\.id \?\? null,\s*mission\?\.driver_id \?\? null,/);
});

test("8. no queue payload or driver list carries a phone", () => {
  assert.match(types, /export type DriverContact = \{/);
  assert.match(types, /driver_phone: string \| null;/);
  assert.match(service, /supabase\.rpc\("hospital_manager_mission_driver_contact", \{/);
  const contactCall = service.slice(
    service.indexOf("export async function fetchMissionDriverContact"),
    service.indexOf("function toLegacyBootstrap"),
  );
  // Only the mission id is sent; neither a driver id nor a phone is supplied.
  assert.match(contactCall, /p_mission_id: missionId/);
  assert.doesNotMatch(contactCall, /p_driver_id|driver_phone|phone:/);
});

test("9. the UI links the formatted number through tel:", () => {
  assert.match(details, /const driverPhone = driverContact\.contact\?\.driver_phone \?\? null;/);
  assert.match(details, /normalizeTunisianPhoneDigits\(driverPhone \?\? ""\)/);
  assert.match(details, /formatTunisianPhone\(driverPhone\)/);
  assert.match(details, /href=\{`tel:\$\{toE164\(driverDigits\)\}`\}/);
  assert.match(details, /t\("dc\.details\.callDriver"\)/);
});

test("10. fallback copy and three-language coverage exist", () => {
  for (const key of [
    "dc.details.driverContact",
    "dc.details.callDriver",
    "dc.details.driverContactLoading",
    "dc.details.driverPhoneUnavailable",
  ]) {
    const occurrences = dictionaries.split(`"${key}":`).length - 1;
    assert.equal(occurrences, 3, `${key} must exist in en, fr and ar`);
  }
  assert.match(dictionaries, /"dc\.details\.driverPhoneUnavailable": "Numéro non disponible"/);
  assert.match(details, /\{t\("dc\.details\.driverPhoneUnavailable"\)\}/);
});
