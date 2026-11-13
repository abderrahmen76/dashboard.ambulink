import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const migration = read(
  "../../ambulink/supabase/migrations/202611130006_hospital_manager_vehicle_record_writes.sql",
);
const service = read("../src/lib/fleet/service.ts");
const types = read("../src/lib/fleet/types.ts");
const dialog = read("../src/components/fleet/fleet-record-dialog.tsx");
const deleteDialog = read("../src/components/fleet/fleet-record-delete-dialog.tsx");
const history = read("../src/components/fleet/fleet-history.tsx");
const dictionaries = read("../src/lib/i18n/dictionaries.ts");

const fuelUpdate = migration.slice(
  migration.indexOf("create or replace function public.hospital_manager_update_fuel_record"),
  migration.indexOf("-- 2. Fuel delete."),
);
const fuelDelete = migration.slice(
  migration.indexOf("create or replace function public.hospital_manager_delete_fuel_record"),
  migration.indexOf("-- 3. Maintenance edit."),
);
const maintenanceUpdate = migration.slice(
  migration.indexOf("create or replace function public.hospital_manager_update_maintenance_record"),
  migration.indexOf("-- 4. Maintenance delete."),
);
const maintenanceDelete = migration.slice(
  migration.indexOf("create or replace function public.hospital_manager_delete_maintenance_record"),
  migration.indexOf("-- 5. Postflight."),
);

test("1. draft is forward-only and touches no policy or table grant", () => {
  assert.match(migration, /DRAFT, NOT APPLIED/);
  assert.match(migration, /^begin;/m);
  assert.match(migration, /^commit;/m);
  assert.doesNotMatch(migration, /create\s+policy/i);
  assert.doesNotMatch(migration, /drop\s+policy/i);
  assert.doesNotMatch(migration, /alter\s+table\s+public\..*enable\s+row\s+level/i);
  assert.doesNotMatch(migration, /service_role/);
});

test("2. every write derives the hospital and rejects foreign rows", () => {
  for (const body of [fuelUpdate, fuelDelete, maintenanceUpdate, maintenanceDelete]) {
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = pg_catalog, public/);
    assert.match(body, /public\.assert_hospital_manager_fleet_access\(\)/);
  }
  assert.match(migration, /fuel_record\.hospital_id = v_hospital/);
  assert.match(migration, /ambulance\.hospital_id = v_hospital/);
  assert.match(migration, /maintenance\.hospital_id = v_hospital/);
  assert.match(migration, /for update of fuel_record/);
  assert.match(migration, /for update of maintenance/);
  assert.match(migration, /raise exception 'fuel_record_scope_forbidden' using errcode = '42501'/);
  assert.match(
    migration,
    /raise exception 'maintenance_record_scope_forbidden' using errcode = '42501'/,
  );
  assert.doesNotMatch(migration, /p_hospital/);
});

test("3. fuel edit validates with the creation rules and auto-fills the unit price", () => {
  assert.match(fuelUpdate, /raise exception 'fuel_total_price_required'/);
  assert.match(fuelUpdate, /raise exception 'fuel_mileage_required'/);
  assert.match(fuelUpdate, /raise exception 'fuel_liters_invalid'/);
  assert.match(fuelUpdate, /raise exception 'fuel_total_price_invalid'/);
  assert.match(fuelUpdate, /raise exception 'fuel_mileage_invalid'/);
  assert.match(fuelUpdate, /v_price_per_liter := round\(v_total \/ v_liters, 3\)/);
  assert.match(fuelUpdate, /recorded_at = coalesce\(p_recorded_at, v_record\.recorded_at\)/);
});

test("4. fuel edit reconciles mileage only when the reading changed", () => {
  assert.match(fuelUpdate, /if p_mileage is distinct from v_record\.mileage then/);
  assert.match(fuelUpdate, /perform public\.assert_ambulance_mileage_increase\(/);
  // No blind rewrite: the monotonic helper is the only mileage writer.
  assert.doesNotMatch(fuelUpdate, /update public\.ambulances/i);
});

test("5. fuel delete removes only the selected row and recalculates mileage", () => {
  assert.match(fuelDelete, /delete from public\.ambulance_fuel_records where id = p_record_id;/);
  assert.match(fuelDelete, /v_mileage := public\.recalculate_ambulance_mileage\(v_record\.ambulance_id\)/);
  assert.match(fuelDelete, /'deleted_id', p_record_id/);
  assert.match(fuelDelete, /'mileage', v_mileage/);
  assert.doesNotMatch(fuelDelete, /delete from public\.ambulance_fuel_records\s+where\s+ambulance_id/s);
});

test("6. maintenance edit validates and reconciles mileage on change", () => {
  assert.match(maintenanceUpdate, /raise exception 'maintenance_price_required'/);
  assert.match(maintenanceUpdate, /raise exception 'maintenance_mileage_required'/);
  assert.match(maintenanceUpdate, /raise exception 'maintenance_next_mileage_invalid'/);
  assert.match(maintenanceUpdate, /if p_mileage is distinct from v_record\.mileage then/);
  assert.match(maintenanceUpdate, /perform public\.assert_ambulance_mileage_increase\(/);
  assert.match(
    maintenanceUpdate,
    /performed_at = coalesce\(p_performed_at, v_record\.performed_at\)/,
  );
  assert.doesNotMatch(maintenanceUpdate, /update public\.ambulances/i);
});

test("7. maintenance delete removes the row and never lowers mileage", () => {
  assert.match(
    maintenanceDelete,
    /delete from public\.ambulance_maintenance_records where id = p_record_id;/,
  );
  assert.match(
    maintenanceDelete,
    /v_mileage := public\.recalculate_ambulance_mileage\(v_record\.ambulance_id\)/,
  );
  // The helper itself keeps greatest(current, max(remaining records)).
  assert.match(migration, /never\s+lowers|never\s+lowered/i);
});

test("8. concurrent writes serialize on the vehicle row and stay atomic", () => {
  assert.match(migration, /for update of fuel_record/);
  assert.match(migration, /for update of maintenance/);
  // Record change and mileage reconciliation live in one function, so one
  // transaction commits or rolls back both.
  assert.match(fuelUpdate, /perform public\.assert_ambulance_mileage_increase\(/);
  assert.match(fuelDelete, /delete from public\.ambulance_fuel_records/);
  assert.match(migration, /revoke all on function public\.hospital_manager_update_fuel_record/);
  assert.match(migration, /grant execute on function public\.hospital_manager_update_fuel_record/);
  assert.match(
    migration,
    /grant execute on function public\.hospital_manager_delete_maintenance_record\(uuid\)\s+to authenticated;/,
  );
});

test("9. the client sends record ids only and maps forbidden scope to not found", () => {
  assert.match(types, /export type UpdateFuelRecordInput = \{/);
  assert.match(types, /recordId: string;/);
  assert.match(types, /export type UpdateMaintenanceRecordInput = \{/);
  assert.match(types, /export type FleetRecordDeleteResult =/);
  assert.match(service, /supabase\.rpc\("hospital_manager_update_fuel_record", \{/);
  assert.match(service, /supabase\.rpc\(\s*"hospital_manager_update_maintenance_record",/);
  assert.match(service, /supabase\.rpc\("hospital_manager_delete_fuel_record", \{/);
  assert.match(service, /supabase\.rpc\(\s*"hospital_manager_delete_maintenance_record",/);
  assert.match(service, /message\.includes\("fuel_record_scope_forbidden"\)/);
  assert.match(service, /message\.includes\("maintenance_record_scope_forbidden"\)/);
  assert.doesNotMatch(service, /p_hospital/);
});

test("10. edit dialogs prepopulate every field and switch to the update copy", () => {
  assert.match(dialog, /record\?: FleetFuelRecord \| null;/);
  assert.match(dialog, /record\?: FleetMaintenanceRecord \| null;/);
  assert.match(dialog, /toLocalDateTimeInput\(record\?\.recorded_at \?\? null\)/);
  assert.match(dialog, /toLocalDateTimeInput\(record\?\.performed_at \?\? null\)/);
  assert.match(dialog, /toInputValue\(record\?\.total_price \?\? null\)/);
  assert.match(dialog, /toInputValue\(record\?\.price \?\? null\)/);
  assert.match(dialog, /record\?\.mechanic_name \?\? ""/);
  assert.match(dialog, /record\?\.next_maintenance_on \?\? ""/);
  assert.match(
    dialog,
    /title=\{t\(editing \? "fleet\.fuel\.editTitle" : "fleet\.fuel\.formTitle"\)\}/,
  );
  assert.match(
    dialog,
    /title=\{t\(editing \? "fleet\.maintenance\.editTitle" : "fleet\.maintenance\.formTitle"\)\}/,
  );
  assert.match(dialog, /submitKey=\{editing \? "fleet\.record\.update" : "fleet\.record\.save"\}/);
  assert.match(dialog, /onUpdate\(\{ recordId: record\.id, \.\.\.fields \}\)/);
  assert.match(dialog, /onCreate\(\{ requestKey, ambulanceId: ambulance\.id, \.\.\.fields \}\)/);
});

test("11. delete is confirmed with its own dialog and pending/error states", () => {
  assert.match(deleteDialog, /role="dialog"/);
  assert.match(deleteDialog, /aria-modal="true"/);
  assert.match(deleteDialog, /t\("fleet\.record\.deleteTitle"\)/);
  assert.match(deleteDialog, /t\("fleet\.record\.deleteBody", \{ summary \}\)/);
  assert.match(deleteDialog, /t\("fleet\.record\.deleteNote"\)/);
  assert.match(deleteDialog, /t\("fleet\.record\.deleteConfirm"\)/);
  assert.match(deleteDialog, /if \(pending\) return;/);
  assert.match(deleteDialog, /if \(!result\.ok\) \{/);
});

test("12. the history wires actions, refreshes both layers and announces the result", () => {
  assert.match(history, /const \[editing, setEditing\] = useState<RecordTarget \| null>\(null\);/);
  assert.match(history, /const \[deleting, setDeleting\] = useState<RecordTarget \| null>\(null\);/);
  assert.match(history, /onEdit=\{\(\) => setEditing\(\{ kind: "fuel", record \}\)\}/);
  assert.match(history, /onDelete=\{\(\) => setDeleting\(\{ kind: "maintenance", record \}\)\}/);
  assert.match(history, /<RecordActions onEdit=\{onEdit\} onDelete=\{onDelete\} \/>/);
  assert.match(history, /aria-label=\{t\("fleet\.record\.edit"\)\}/);
  assert.match(history, /aria-label=\{t\("fleet\.record\.delete"\)\}/);
  assert.match(history, /record=\{editing\.record\}/);
  assert.match(history, /<FleetRecordDeleteDialog/);
  // Section refresh keeps pagination; the snapshot refresh updates mileage.
  assert.match(history, /const refreshSection = \(kind: Exclude<DialogKind, null>\) => \{/);
  assert.match(history, /onSaved\(\);/);
  assert.match(history, /setNotice\("updated"\);/);
  assert.match(history, /setNotice\("deleted"\);/);
});

test("13. every new label exists in en, fr and ar", () => {
  for (const key of [
    "fleet.record.updated",
    "fleet.record.deleted",
    "fleet.record.update",
    "fleet.record.edit",
    "fleet.record.delete",
    "fleet.record.deleteTitle",
    "fleet.record.deleteBody",
    "fleet.record.deleteNote",
    "fleet.record.deleteConfirm",
    "fleet.record.deleting",
    "fleet.fuel.editTitle",
    "fleet.maintenance.editTitle",
  ]) {
    const occurrences = dictionaries.split(`"${key}":`).length - 1;
    assert.equal(occurrences, 3, `${key} must exist in en, fr and ar`);
  }
});
