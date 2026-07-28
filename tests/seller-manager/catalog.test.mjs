import assert from "node:assert/strict";
import test from "node:test";
import {
  CatalogPublicationError,
  archivePayload,
  createSubmissionGuard,
  restorePayload,
  runConfirmedPublication,
  setFindPublished,
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
  });

  assert.deepEqual(payload, {
    title: "Test Find",
    collection_id: "jewelry",
    price_amount: "25.00",
    price_currency: "USD",
    availability: "reserved",
    description: "Fictional test record.",
    condition: null
  });
});

test("ordinary edits never change current publication state", () => {
  assert.equal(Object.hasOwn(toFindPayload({ ...approved, is_published: true }), "is_published"), false);
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

test("publication confirmation cancellation performs no operation", async () => {
  let operations = 0;
  const cancelled = await runConfirmedPublication(
    () => false,
    "Fictional confirmation",
    async () => { operations += 1; }
  );
  assert.deepEqual(cancelled, { cancelled: true });
  assert.equal(operations, 0);

  const accepted = await runConfirmedPublication(
    () => true,
    "Fictional confirmation",
    async () => { operations += 1; return "verified"; }
  );
  assert.deepEqual(accepted, { cancelled: false, value: "verified" });
  assert.equal(operations, 1);
});

function publicationClient({ updateData, updateError = null, verifiedData, verifyError = null }) {
  const calls = { updates: [], deletes: 0, filters: [], reads: 0 };
  return {
    calls,
    from(table) {
      assert.equal(table, "finds");
      return {
        update(payload) {
          calls.updates.push(payload);
          return {
            eq(name, value) {
              calls.filters.push([name, value]);
              return this;
            },
            is(name, value) {
              calls.filters.push([name, value]);
              return this;
            },
            select() { return this; },
            async maybeSingle() {
              return { data: updateData, error: updateError };
            }
          };
        },
        select() {
          calls.reads += 1;
          return {
            eq() { return this; },
            async single() {
              return { data: verifiedData, error: verifyError };
            }
          };
        },
        delete() {
          calls.deletes += 1;
          throw new Error("delete must not be called");
        }
      };
    }
  };
}

const publicationSnapshot = Object.freeze({
  id: "fictional-find-id",
  public_id: "BU-9101",
  is_published: false,
  archived_at: null
});

test("publish uses optimistic state filters and succeeds only after an exact refetch", async () => {
  const published = { ...publicationSnapshot, is_published: true };
  const client = publicationClient({ updateData: published, verifiedData: published });
  assert.deepEqual(await setFindPublished(client, publicationSnapshot, true), published);
  assert.deepEqual(client.calls.updates, [{ is_published: true }]);
  assert.deepEqual(client.calls.filters, [
    ["id", publicationSnapshot.id],
    ["is_published", false],
    ["archived_at", null]
  ]);
  assert.equal(client.calls.reads, 1);
  assert.equal(client.calls.deletes, 0);
});

test("unpublish preserves the Find and photographs while verifying hidden state", async () => {
  const snapshot = { ...publicationSnapshot, is_published: true };
  const hidden = { ...snapshot, is_published: false };
  const client = publicationClient({ updateData: hidden, verifiedData: hidden });
  assert.deepEqual(await setFindPublished(client, snapshot, false), hidden);
  assert.deepEqual(client.calls.updates, [{ is_published: false }]);
  assert.equal(client.calls.deletes, 0);
});

test("concurrent state changes and final-state mismatches never report success", async () => {
  const conflict = publicationClient({ updateData: null, verifiedData: null });
  await assert.rejects(
    setFindPublished(conflict, publicationSnapshot, true),
    (error) => error instanceof CatalogPublicationError && error.code === "conflict"
  );

  const returned = { ...publicationSnapshot, is_published: true };
  const mismatch = publicationClient({
    updateData: returned,
    verifiedData: { ...returned, is_published: false }
  });
  await assert.rejects(
    setFindPublished(mismatch, publicationSnapshot, true),
    (error) => error instanceof CatalogPublicationError && error.code === "verification"
  );
});

test("session expiration and authorization failures return neutral errors", async () => {
  for (const [failure, expectedCode] of [
    [{ status: 401 }, "session"],
    [{ status: 403, code: "42501" }, "authorization"]
  ]) {
    const client = publicationClient({ updateData: null, updateError: failure });
    await assert.rejects(
      setFindPublished(client, publicationSnapshot, true),
      (error) => (
        error instanceof CatalogPublicationError &&
        error.code === expectedCode &&
        !JSON.stringify(error).includes("fictional-private")
      )
    );
  }
});
