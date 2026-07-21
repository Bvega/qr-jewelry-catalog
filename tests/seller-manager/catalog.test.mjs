import assert from "node:assert/strict";
import test from "node:test";
import {
  archivePayload,
  createSubmissionGuard,
  restorePayload,
  toFindPayload
} from "../../admin-src/catalog.js";
import { filterFinds } from "../../admin-src/ui.js";

const approved = {
  title: "Test Find",
  collection_id: "jewelry",
  price_amount: "25.00",
  availability: "reserved",
  description: "Fictional test record.",
  condition: null
};

test("create and edit payloads contain only approved catalog fields", () => {
  const payload = toFindPayload({
    ...approved,
    id: "must-not-pass",
    public_id: "must-not-pass",
    created_by: "must-not-pass",
    updated_at: "must-not-pass"
  }, { publish: true });

  assert.deepEqual(payload, {
    title: "Test Find",
    collection_id: "jewelry",
    price_amount: "25.00",
    price_currency: "USD",
    availability: "reserved",
    description: "Fictional test record.",
    condition: null,
    is_published: true
  });
});

test("archive hides with a timestamp and restore remains hidden", () => {
  const now = new Date("2026-07-20T15:00:00.000Z");
  assert.deepEqual(archivePayload(now), {
    archived_at: "2026-07-20T15:00:00.000Z",
    is_published: false
  });
  assert.deepEqual(restorePayload(), { archived_at: null, is_published: false });
});

test("catalog filters cover availability, publication, visibility, and archive state", () => {
  const finds = [
    { id: "a", availability: "available", is_published: true, archived_at: null },
    { id: "b", availability: "reserved", is_published: false, archived_at: null },
    { id: "c", availability: "sold", is_published: false, archived_at: "2026-07-20T00:00:00Z" }
  ];
  assert.deepEqual(filterFinds(finds, "all").map((find) => find.id), ["a", "b", "c"]);
  assert.deepEqual(filterFinds(finds, "published").map((find) => find.id), ["a"]);
  assert.deepEqual(filterFinds(finds, "hidden").map((find) => find.id), ["b"]);
  assert.deepEqual(filterFinds(finds, "archived").map((find) => find.id), ["c"]);
  assert.deepEqual(filterFinds(finds, "reserved").map((find) => find.id), ["b"]);
});

test("submission guard prevents duplicate work and unlocks after completion", async () => {
  const guard = createSubmissionGuard();
  let release;
  let calls = 0;
  const pending = guard.run(async () => {
    calls += 1;
    await new Promise((resolve) => { release = resolve; });
    return "saved";
  });
  assert.equal(guard.active, true);
  assert.deepEqual(await guard.run(async () => { calls += 1; }), { skipped: true });
  release();
  assert.equal(await pending, "saved");
  assert.equal(guard.active, false);
  assert.equal(calls, 1);
});
