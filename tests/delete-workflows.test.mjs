import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../ambulink/supabase/migrations/202611130003_hospital_manager_delete_workflows.sql",
    import.meta.url,
  ),
  "utf8",
);
const fleetService = readFileSync(
  new URL("../src/lib/fleet/service.ts", import.meta.url),
  "utf8",
);
const driverService = readFileSync(
  new URL("../src/lib/drivers/service.ts", import.meta.url),
  "utf8",
);
const fleetHook = readFileSync(
  new URL("../src/lib/fleet/use-fleet.ts", import.meta.url),
  "utf8",
);
const driverHook = readFileSync(
  new URL("../src/lib/drivers/use-drivers.ts", import.meta.url),
  "utf8",
);
const fleetDialog = readFileSync(
  new URL("../src/components/fleet/fleet-delete-dialog.tsx", import.meta.url),
  "utf8",
);
const driverDialog = readFileSync(
  new URL("../src/components/drivers/driver-delete-dialog.tsx", import.meta.url),
  "utf8",
);
const fleetDetails = readFileSync(
  new URL("../src/components/fleet/fleet-details.tsx", import.meta.url),
  "utf8",
);
const driverDetails = readFileSync(
  new URL("../src/components/drivers/driver-details.tsx", import.meta.url),
  "utf8",
);
const fleetView = readFileSync(
  new URL("../src/app/(clinic)/fleet/fleet-view.tsx", import.meta.url),
  "utf8",
);
const driversView = readFileSync(
  new URL("../src/app/(clinic)/drivers/drivers-view.tsx", import.meta.url),
  "utf8",
);
const dictionaries = readFileSync(
  new URL("../src/lib/i18n/dictionaries.ts", import.meta.url),
  "utf8",
);

function functionBody(name) {
  const start = migration.indexOf(`function public.${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const end = migration.indexOf("end;\n$$;", start);
  assert.notEqual(end, -1, `${name} body is not terminated`);
  return migration.slice(start, end);
}

const archive = functionBody("hospital_manager_archive_ambulance");
const deactivate = functionBody("hospital_manager_deactivate_driver");

test("1. the migration is an unapplied, forward-only draft", () => {
  assert.match(migration, /NOT APPLIED/);
  assert.match(migration, /Nothing in this file has been executed/);
  // Forward-only: no destructive DDL of an existing object.
  assert.doesNotMatch(migration, /drop function/i);
  assert.doesNotMatch(migration, /drop trigger/i);
  assert.doesNotMatch(migration, /drop table/i);
  // It depends on the fleet helper and snapshot rather than redefining them.
  assert.match(migration, /to_regprocedure\('public\.assert_hospital_manager_fleet_access\(\)'\)/);
  assert.doesNotMatch(migration, /create or replace function public\.assert_hospital_manager_fleet_access/);
});

test("2. both RPCs are SECURITY DEFINER with a pinned search_path and narrow grants", () => {
  for (const body of [archive, deactivate]) {
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = pg_catalog, public/);
  }
  for (const name of [
    "hospital_manager_archive_ambulance",
    "hospital_manager_deactivate_driver",
  ]) {
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${name}\\(uuid\\)\\s+from public, anon;`),
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${name}\\(uuid\\)\\s+to authenticated;`),
    );
  }
  // No broad table privilege is granted: authorization stays in the functions.
  assert.doesNotMatch(migration, /grant delete/i);
  assert.doesNotMatch(migration, /alter table .*enable row level security/i);
  assert.doesNotMatch(migration, /alter policy/i);
});

test("3. the hospital is derived from the caller, never from a client argument", () => {
  assert.match(archive, /p_ambulance_id uuid/);
  assert.match(deactivate, /p_driver_id uuid/);
  assert.match(
    archive,
    /v_hospital uuid := public\.assert_hospital_manager_fleet_access\(\);/,
  );
  assert.match(
    deactivate,
    /v_hospital uuid := public\.assert_hospital_manager_fleet_access\(\);/,
  );
  // No hospital id parameter reaches either signature.
  assert.doesNotMatch(migration, /p_hospital_id/);
  assert.doesNotMatch(migration, /p_hospital\b/);
});

test("4. archiving refuses a live mission on the vehicle or its assigned driver", () => {
  assert.match(archive, /from public\.ambulances vehicle/);
  assert.match(archive, /for update;/);
  assert.match(archive, /mission\.ambulance_id = p_ambulance_id/);
  assert.match(
    archive,
    /\(v_driver_id is not null and mission\.driver_id = v_driver_id\)/,
  );
  assert.match(archive, /mission\.status::text not in \('completed', 'cancelled'\)/);
  assert.match(archive, /raise exception 'ambulance_mission_active' using errcode = '23514';/);
});

test("5. archiving preserves history and retires the vehicle instead of deleting it", () => {
  assert.match(archive, /set archived_at = coalesce\(archived_at, now\(\)\),/);
  assert.match(archive, /status = 'maintenance',/);
  assert.match(archive, /driver_id = null/);
  assert.doesNotMatch(archive, /delete from/i);
  assert.doesNotMatch(archive, /truncate/i);
  // Fuel, maintenance and mission tables are never written by this workflow.
  assert.doesNotMatch(archive, /update public\.missions/);
  assert.doesNotMatch(archive, /insert into public\.missions/);
});

test("6. deactivation requires an active driver membership of the derived hospital", () => {
  assert.match(deactivate, /from public\.hospital_memberships membership/);
  assert.match(deactivate, /membership\.user_id = p_driver_id/);
  assert.match(deactivate, /membership\.hospital_id = v_hospital/);
  assert.match(deactivate, /membership\.membership_role = 'driver'/);
  assert.match(deactivate, /for update;/);
  assert.match(
    deactivate,
    /join public\.profiles driver_profile\s+on driver_profile\.id = driver\.id/,
  );
  assert.match(deactivate, /driver_profile\.role = 'driver'/);
  assert.match(deactivate, /raise exception 'driver_not_found' using errcode = 'P0002';/);
  // The platform-admin deactivation also flips the same flag; this matches it.
  assert.match(deactivate, /set is_active = false,/);
});

test("7. deactivation refuses a driver with an active mission", () => {
  assert.match(deactivate, /where mission\.driver_id = p_driver_id/);
  assert.match(deactivate, /mission\.status::text not in \('completed', 'cancelled'\)/);
  assert.match(deactivate, /mission\.completed_at is null/);
  assert.match(deactivate, /mission\.cancelled_at is null/);
  assert.match(deactivate, /raise exception 'driver_mission_active' using errcode = '23514';/);
});

test("8. deactivation deletes nothing: membership off, availability off, vehicle released", () => {
  assert.doesNotMatch(deactivate, /delete from/i);
  assert.doesNotMatch(deactivate, /truncate/i);
  assert.doesNotMatch(deactivate, /from auth\.users/i);
  assert.match(deactivate, /update public\.ambulances\s+set driver_id = null/);
  assert.match(deactivate, /update public\.drivers\s+set availability = false/);
  assert.match(deactivate, /update public\.hospital_memberships\s+set is_active = false,/);
});

test("9. both workflows are scoped to the derived hospital on every write", () => {
  assert.match(archive, /where vehicle\.id = p_ambulance_id\s+and vehicle\.hospital_id = v_hospital/);
  assert.match(archive, /where id = p_ambulance_id\s+and hospital_id = v_hospital;/);
  assert.match(
    deactivate,
    /where driver\.id = p_driver_id\s+and driver\.hospital_id = v_hospital/,
  );
  assert.match(
    deactivate,
    /where driver_id = p_driver_id\s+and hospital_id = v_hospital/,
  );
  assert.match(
    deactivate,
    /where id = p_driver_id\s+and hospital_id = v_hospital;/,
  );
  assert.match(
    deactivate,
    /where user_id = p_driver_id\s+and hospital_id = v_hospital/,
  );
});

test("10. the browser sends only the row id and refreshes from server state", () => {
  assert.match(
    fleetService,
    /supabase\.rpc\(\s*"hospital_manager_archive_ambulance",\s*\{ p_ambulance_id: ambulanceId \}/,
  );
  assert.match(
    driverService,
    /supabase\.rpc\(\s*"hospital_manager_deactivate_driver",\s*\{ p_driver_id: driverId \}/,
  );
  // Neither service sends a hospital id from the browser.
  assert.doesNotMatch(fleetService, /p_hospital/);
  assert.doesNotMatch(driverService, /p_hospital/);
  // The fleet hook applies the authoritative snapshot; the drivers hook refetches.
  assert.match(fleetHook, /applySnapshot\(result\.snapshot\)/);
  assert.match(driverHook, /if \(result\.ok && mountedRef\.current\) refresh\(\);/);
  // No service-role key or admin client is used for these operations.
  assert.doesNotMatch(fleetService, /service_role|SERVICE_ROLE/);
  assert.doesNotMatch(driverService, /service_role|SERVICE_ROLE/);
});

test("11. the UI confirms, prevents duplicates, announces success and is localized", () => {
  for (const dialog of [fleetDialog, driverDialog]) {
    assert.match(dialog, /role="dialog"/);
    assert.match(dialog, /aria-modal="true"/);
    // Duplicate submissions are blocked before the RPC is called.
    assert.match(dialog, /if \(pending \|\| onMission\) return;/);
    assert.match(dialog, /setPending\(true\);/);
    assert.match(dialog, /aria-busy|animate-spin/);
    assert.match(dialog, /role="alert"/);
    // Closing is disabled while the request is in flight.
    assert.match(dialog, /if \(event\.key === "Escape" && !pending\) onClose\(\);/);
  }

  // Identity is shown in both confirmations.
  assert.match(fleetDialog, /ambulance\.plate_number/);
  assert.match(fleetDialog, /ambulance\.driver_name/);
  assert.match(driverDialog, /driver\.full_name/);
  assert.match(driverDialog, /driver\.phone/);

  // A live mission is surfaced and blocks the action client-side too.
  assert.match(fleetDialog, /vehicleState\(ambulance\) === "on_mission"/);
  assert.match(driverDialog, /driver\.status === "on_mission"/);

  // Both registry rows expose the action.
  assert.match(fleetDetails, /onDelete\(ambulance\)/);
  assert.match(driverDetails, /onDelete\(driver\)/);

  // Lists refresh in place and a success notice is shown, no page reload.
  assert.match(fleetView, /archiveAmbulance/);
  assert.match(fleetView, /fleet\.delete\.success/);
  assert.match(driversView, /deleteDriver/);
  assert.match(driversView, /drivers\.delete\.success/);
  assert.doesNotMatch(fleetView, /location\.reload/);
  assert.doesNotMatch(driversView, /location\.reload/);

  for (const key of [
    "fleet.delete.title",
    "fleet.delete.body",
    "fleet.delete.confirm",
    "fleet.delete.deleting",
    "fleet.delete.success",
    "fleet.delete.error.mission",
    "drivers.delete.title",
    "drivers.delete.body",
    "drivers.delete.confirm",
    "drivers.delete.deleting",
    "drivers.delete.success",
    "drivers.delete.error.mission",
  ]) {
    const occurrences = dictionaries.split(`"${key}"`).length - 1;
    assert.equal(occurrences, 3, `${key} must exist in en, fr and ar`);
  }
});
