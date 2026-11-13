import assert from "node:assert/strict";
import test from "node:test";

import { canCancelMission, isExpiredOffer } from "../src/lib/dashboard/format.ts";
import {
  isTerminalStatus,
  mergeMissionLists,
  removeMissionById,
} from "../src/lib/dashboard/missions.ts";

function pending(overrides = {}) {
  return {
    id: "mission-1",
    manager_entry: true,
    status: "requested",
    driver_id: null,
    attempt: { state: "expired" },
    created_at: "2026-11-13T08:00:00.000Z",
    ...overrides,
  };
}

test("a pending manager mission whose offer expired can be cancelled", () => {
  const mission = pending();
  assert.equal(isExpiredOffer(mission), true);
  assert.equal(canCancelMission(mission), true);
  // The capability must not mutate the mission: expiry alone leaves it pending.
  assert.equal(mission.status, "requested");
});

test("a mission that was never dispatched can also be cancelled", () => {
  assert.equal(canCancelMission(pending({ attempt: null })), true);
});

test("a live offer window is not cancellable", () => {
  const mission = pending({ attempt: { state: "offering" } });
  assert.equal(canCancelMission(mission), false);
});

test("an accepted attempt is not cancellable even if the mission still reads requested", () => {
  assert.equal(canCancelMission(pending({ attempt: { state: "accepted" } })), false);
});

test("accepted and in-progress missions keep their existing cancellation rules", () => {
  for (const status of ["accepted", "en_route", "arrived", "in_progress", "completed"]) {
    assert.equal(canCancelMission(pending({ status })), false, status);
  }
});

test("a mission that already has a driver cannot be cancelled", () => {
  assert.equal(canCancelMission(pending({ driver_id: "driver-1" })), false);
});

test("a patient-created mission is outside the manager cancellation action", () => {
  assert.equal(canCancelMission(pending({ manager_entry: false })), false);
});

test("after cancellation the mission leaves the active queue and stops being cancellable", () => {
  const mission = pending();
  const active = [mission];
  const cancelled = pending({ status: "cancelled" });

  assert.equal(isTerminalStatus(cancelled.status), true);
  assert.deepEqual(removeMissionById(active, mission.id), []);
  assert.equal(canCancelMission(cancelled), false);
  assert.equal(isExpiredOffer(cancelled), false);

  // The queue keeps one row, updated in place with the terminal status.
  const queue = mergeMissionLists([mission], [cancelled]);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].status, "cancelled");
});
