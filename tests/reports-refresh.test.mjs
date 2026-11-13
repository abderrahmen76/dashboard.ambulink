import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDetailResult,
  detailIdentityKey,
  visibleDetailState,
} from "../src/lib/reports/detail-state.ts";

function detail(revisionNo, marker) {
  return { report: { id: "report-1", revision_no: revisionNo }, marker };
}

const ok = (data) => ({ ok: true, data });
const fail = (code = "network") => ({ ok: false, code });

test("the detail identity excludes the list poll counter", () => {
  const key = detailIdentityKey("report-1", null);
  assert.equal(key, "report-1:latest");
  // Same report + revision computed again on a later poll is the same identity.
  assert.equal(detailIdentityKey("report-1", null), key);
  assert.equal(detailIdentityKey("report-1", 3), "report-1:3");
  assert.equal(detailIdentityKey(null, null), "");
});

test("a background refresh updates the open report without a loading gap", () => {
  const key = detailIdentityKey("report-1", null);
  const first = applyDetailResult(null, key, ok(detail(1, "v1")));
  assert.equal(visibleDetailState(first, key).data.marker, "v1");

  // A poll revision bump does not change the key: the viewer stays mounted.
  const refreshed = applyDetailResult(first, key, ok(detail(2, "v2")));
  assert.equal(refreshed.key, key);
  assert.equal(refreshed.data.marker, "v2");
  assert.notEqual(visibleDetailState(refreshed, key), null);
});

test("a failed background refresh keeps the last content for the same report", () => {
  const key = detailIdentityKey("report-1", null);
  const loaded = applyDetailResult(null, key, ok(detail(1, "v1")));

  const failed = applyDetailResult(loaded, key, fail("network"));
  assert.equal(failed.error, "network");
  assert.equal(failed.data.marker, "v1");
  assert.notEqual(visibleDetailState(failed, key), null);
});

test("switching reports loads the new one instead of showing the old content", () => {
  const keyA = detailIdentityKey("report-1", null);
  const keyB = detailIdentityKey("report-2", null);
  const stateA = applyDetailResult(null, keyA, ok(detail(1, "a")));

  // Until B arrives, no state is visible for B, so the UI shows its loader.
  assert.equal(visibleDetailState(stateA, keyB), null);

  const failedB = applyDetailResult(stateA, keyB, fail());
  assert.equal(failedB.data, null);
  assert.equal(failedB.error, "network");
});

test("closing and reopening a report fetches it again with fresh content", () => {
  const key = detailIdentityKey("report-1", null);
  const loaded = applyDetailResult(null, key, ok(detail(1, "v1")));

  // Closed: no identity, no visible detail.
  assert.equal(visibleDetailState(loaded, detailIdentityKey(null, null)), null);

  const reopened = applyDetailResult(loaded, key, ok(detail(3, "v3")));
  assert.equal(reopened.data.report.revision_no, 3);
  assert.equal(reopened.data.marker, "v3");
});

test("selecting another revision of the same report has its own identity", () => {
  const latest = detailIdentityKey("report-1", null);
  const older = detailIdentityKey("report-1", 2);
  const state = applyDetailResult(null, latest, ok(detail(3, "latest")));

  assert.equal(visibleDetailState(state, older), null);
  const olderState = applyDetailResult(state, older, ok(detail(2, "older")));
  assert.equal(visibleDetailState(olderState, older).data.marker, "older");
});

test("applyDetailResult does not mutate the previous state", () => {
  const key = detailIdentityKey("report-1", null);
  const previous = applyDetailResult(null, key, ok(detail(1, "v1")));
  const snapshot = { ...previous, data: previous.data };

  applyDetailResult(previous, key, fail("unexpected"));

  assert.deepEqual(previous, snapshot);
});
