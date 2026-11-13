import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../ambulink/supabase/migrations/202611130001_hospital_manager_cancel_mission.sql",
    import.meta.url,
  ),
  "utf8",
);
const service = readFileSync(
  new URL("../src/lib/dashboard/service.ts", import.meta.url),
  "utf8",
);
const hook = readFileSync(
  new URL("../src/lib/dashboard/use-dispatch-center.ts", import.meta.url),
  "utf8",
);
const dialog = readFileSync(
  new URL("../src/components/dashboard/cancel-mission-dialog.tsx", import.meta.url),
  "utf8",
);

test("the cancellation migration is clearly marked as not applied", () => {
  assert.match(migration, /NOT APPLIED/);
});

test("the RPC is SECURITY DEFINER and rewrites no existing entry point", () => {
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = pg_catalog, public/);
  // The patient/driver contract must stay untouched.
  assert.doesNotMatch(migration, /create or replace function public\.cancel_mission/);
});

test("the mission row is locked before status is evaluated", () => {
  const lockAt = migration.indexOf("where mission.id = p_mission_id\n  for update");
  const statusAt = migration.indexOf(
    "if v_mission.status::text is distinct from 'requested'",
  );
  assert.notEqual(lockAt, -1, "mission row lock missing");
  assert.notEqual(statusAt, -1, "status precondition missing");
  assert.ok(lockAt < statusAt, "status check must happen under the row lock");
  assert.match(migration, /v_mission\.driver_id is not null/);
});

test("cross-hospital and non-manager missions are reported as not found", () => {
  assert.match(
    migration,
    /v_mission\.target_hospital_id is distinct from v_hospital_id/,
  );
  assert.match(migration, /not v_mission\.manager_entry/);
  assert.match(migration, /raise exception 'mission_not_found'/);
});

test("a live offer window is refused instead of raced", () => {
  assert.match(migration, /v_attempt\.state = 'offering'/);
  assert.match(migration, /v_attempt\.deadline_at > clock_timestamp\(\)/);
  assert.match(migration, /raise exception 'dispatch_in_progress'/);
});

test("terminal transitions mirror the existing cancellation RPC", () => {
  assert.match(migration, /set status = 'cancelled', cancelled_at = v_cancelled_at/);
  assert.match(migration, /set state = 'expired'[\s\S]*state = 'offering'/);
  assert.match(migration, /set state = 'withdrawn', responded_at = v_cancelled_at/);
});

test("authenticated managers can execute it, anon cannot", () => {
  assert.match(
    migration,
    /revoke all on function public\.hospital_manager_cancel_mission\(uuid\)[\s\S]*from public, anon/,
  );
  assert.match(
    migration,
    /grant execute on function public\.hospital_manager_cancel_mission\(uuid\)[\s\S]*to authenticated/,
  );
});

test("the client cancels through the RPC and never updates missions directly", () => {
  assert.match(service, /supabase\.rpc\("hospital_manager_cancel_mission"/);
  assert.doesNotMatch(service, /\.from\("missions"\)/);
  assert.doesNotMatch(hook, /\.from\("missions"\)/);
});

test("a failed cancellation does not apply an optimistic snapshot", () => {
  const start = hook.indexOf("const cancelMission");
  assert.notEqual(start, -1);
  const body = hook.slice(start, hook.indexOf("const createMission", start));
  const failureReturn = body.indexOf("if (!result.ok)");
  const apply = body.indexOf("applyMutationSnapshot(");
  assert.notEqual(failureReturn, -1);
  assert.notEqual(apply, -1);
  assert.ok(failureReturn < apply, "snapshot must only be applied on success");
});

test("the action requires an explicit confirmation dialog", () => {
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /await onConfirm\(mission\.id\)/);
  assert.match(dialog, /dc\.cancel\.keep/);
});
