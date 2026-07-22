import assert from "node:assert/strict";
import test from "node:test";

import {
  executeCatalogMigration,
  performDryRun
} from "../../admin-src/migration-executor.js";
import {
  createMockClient,
  databaseFind,
  databasePhoto,
  loadVerifiedPlan
} from "./mock-client.mjs";

const verified = loadVerifiedPlan();
const confirmation = { checked: true, phrase: "IMPORT 4 FINDS" };

async function dryRun(client, now = 100) {
  return performDryRun({ client, verified, clock: () => now });
}

test("absent records import once and duplicate execution creates no duplicates", async () => {
  const client = createMockClient({ collections: verified.plan.collections });
  const initial = await dryRun(client);
  const result = await executeCatalogMigration({ client, verified, dryRun: initial, ...confirmation, clock: () => 100 });
  assert.equal(result.state, "complete");
  assert.equal(client.state.finds.length, 4);
  assert.equal(client.state.find_photos.length, 4);
  assert.equal(client.objects.size, 4);
  assert.ok(client.state.finds.every((find) => !find.is_published && !find.is_featured && find.legacy_id === null));

  const second = await dryRun(client, 200);
  assert.equal(second.all_complete, true);
  await assert.rejects(
    () => executeCatalogMigration({ client, verified, dryRun: second, ...confirmation, clock: () => 200 }),
    /current dry-run/i
  );
  assert.equal(client.state.finds.length, 4);
  assert.equal(client.state.find_photos.length, 4);
  assert.equal(client.objects.size, 4);
});

test("an exact complete record is skipped while absent records import", async () => {
  const planned = verified.plan.finds[0];
  const find = databaseFind(planned);
  const photo = databasePhoto(planned, find);
  const objects = new Map([[photo.storage_path, verified.photos.get(planned.public_id)]]);
  const client = createMockClient({ collections: verified.plan.collections, finds: [find], photos: [photo], objects });
  const initial = await dryRun(client);
  assert.equal(initial.records[0].state, "complete");
  const result = await executeCatalogMigration({ client, verified, dryRun: initial, ...confirmation, clock: () => 100 });
  assert.deepEqual(result.results[0], { public_id: "BU-0006", state: "skipped" });
  assert.equal(client.state.finds.length, 4);
});

test("an exact Find with an incomplete photo step resumes without replacing the Find", async () => {
  const planned = verified.plan.finds[0];
  const find = databaseFind(planned);
  const client = createMockClient({ collections: verified.plan.collections, finds: [find] });
  const initial = await dryRun(client);
  assert.equal(initial.records[0].state, "resumable");
  await executeCatalogMigration({ client, verified, dryRun: initial, ...confirmation, clock: () => 100 });
  assert.equal(client.state.finds.filter((item) => item.public_id === planned.public_id).length, 1);
  assert.equal(client.state.finds.find((item) => item.public_id === planned.public_id).id, find.id);
  assert.equal(client.state.find_photos.filter((item) => item.find_id === find.id).length, 1);
});

test("field, slug, and Storage mismatches block before writes", async () => {
  const planned = verified.plan.finds[0];
  const fieldMismatch = databaseFind(planned);
  fieldMismatch.title = "Wrong title";
  const fieldClient = createMockClient({ collections: verified.plan.collections, finds: [fieldMismatch] });
  const fieldResult = await dryRun(fieldClient);
  assert.equal(fieldResult.ready, false);
  assert.equal(fieldClient.calls.writes, 0);

  const slugOwner = databaseFind({ ...planned, public_id: "BU-8000" });
  const slugClient = createMockClient({ collections: verified.plan.collections, finds: [slugOwner] });
  const slugResult = await dryRun(slugClient);
  assert.equal(slugResult.ready, false);
  assert.match(slugResult.errors.join("\n"), /slug belongs/);

  const find = databaseFind(planned);
  const wrongPath = `finds/${find.id}/unexpected.png`;
  const objectClient = createMockClient({
    collections: verified.plan.collections,
    finds: [find],
    objects: new Map([[wrongPath, verified.photos.get(planned.public_id)]])
  });
  const objectResult = await dryRun(objectClient);
  assert.equal(objectResult.ready, false);
  assert.match(objectResult.errors.join("\n"), /Storage object/);
  assert.equal(objectClient.calls.writes, 0);
});

test("photo metadata owned by another Find blocks the target path before writes", async () => {
  const planned = verified.plan.finds[0];
  const find = databaseFind(planned);
  const conflictingPhoto = {
    ...databasePhoto(planned, find),
    id: "31000000-0000-4000-8000-000000000099",
    find_id: "21000000-0000-4000-8000-000000000099"
  };
  const client = createMockClient({
    collections: verified.plan.collections,
    finds: [find],
    photos: [conflictingPhoto]
  });
  const result = await dryRun(client);
  assert.equal(result.ready, false);
  assert.match(result.errors.join("\n"), /BU-0006 has conflicting primary photo metadata/);
  assert.equal(client.calls.writes, 0);
});

test("upload failure rolls back only the newly inserted Find", async () => {
  const unrelated = {
    ...databaseFind({ ...verified.plan.finds[0], public_id: "BU-7000", slug: "unrelated-find" }, "22000000-0000-4000-8000-000000000001")
  };
  const client = createMockClient({ collections: verified.plan.collections, finds: [unrelated], fail: { upload: true } });
  const initial = await dryRun(client);
  await assert.rejects(
    () => executeCatalogMigration({ client, verified, dryRun: initial, ...confirmation, clock: () => 100 }),
    /rolled back/
  );
  assert.deepEqual(client.state.finds.map((find) => find.public_id), ["BU-7000"]);
  assert.equal(client.state.find_photos.length, 0);
  assert.equal(client.objects.size, 0);
  assert.equal(client.calls.removes, 0);
});

test("metadata failure removes the new object and the new Find", async () => {
  const client = createMockClient({ collections: verified.plan.collections, fail: { metadata: true } });
  const initial = await dryRun(client);
  await assert.rejects(
    () => executeCatalogMigration({ client, verified, dryRun: initial, ...confirmation, clock: () => 100 }),
    /rolled back/
  );
  assert.equal(client.state.finds.length, 0);
  assert.equal(client.state.find_photos.length, 0);
  assert.equal(client.objects.size, 0);
  assert.equal(client.calls.removes, 1);
});

test("rollback failure stops remaining records and reports recovery state", async () => {
  const client = createMockClient({ collections: verified.plan.collections, fail: { metadata: true, remove: true } });
  const initial = await dryRun(client);
  await assert.rejects(
    () => executeCatalogMigration({ client, verified, dryRun: initial, ...confirmation, clock: () => 100 }),
    (error) => error.partial === true && error.rollbackFailed === true && /rollback could not be verified/i.test(error.message)
  );
  assert.equal(client.state.finds.length, 0);
  assert.equal(client.state.find_photos.length, 0);
  assert.equal(client.objects.size, 1);
  assert.equal(client.calls.uploads, 1);
});

test("a thrown post-write verification rolls back the current attempt", async () => {
  const client = createMockClient({ collections: verified.plan.collections });
  const initial = await dryRun(client);
  let verificationCount = 0;
  const dryRunImpl = async (options) => {
    verificationCount += 1;
    if (verificationCount === 2) throw new Error("fictional verification outage");
    return performDryRun(options);
  };
  await assert.rejects(
    () => executeCatalogMigration({
      client,
      verified,
      dryRun: initial,
      ...confirmation,
      clock: () => 100,
      dryRunImpl
    }),
    (error) => error.partial === true && error.rollbackFailed === false && /absence was verified/i.test(error.message)
  );
  assert.equal(client.state.finds.length, 0);
  assert.equal(client.state.find_photos.length, 0);
  assert.equal(client.objects.size, 0);
  assert.equal(client.calls.uploads, 1);
});

test("a thrown final verification rolls back every attempt created by the execution", async () => {
  const client = createMockClient({ collections: verified.plan.collections });
  const initial = await dryRun(client);
  let verificationCount = 0;
  const dryRunImpl = async (options) => {
    verificationCount += 1;
    if (verificationCount === 6) throw new Error("fictional final verification outage");
    return performDryRun(options);
  };
  await assert.rejects(
    () => executeCatalogMigration({
      client,
      verified,
      dryRun: initial,
      ...confirmation,
      clock: () => 100,
      dryRunImpl
    }),
    (error) => error.partial === true && error.rollbackFailed === false && /final verification threw/i.test(error.message)
  );
  assert.equal(client.state.finds.length, 0);
  assert.equal(client.state.find_photos.length, 0);
  assert.equal(client.objects.size, 0);
  assert.equal(client.calls.uploads, 4);
});

test("an ambiguous upload on a resumable Find is inspected and never deleted", async () => {
  const planned = verified.plan.finds[0];
  const find = databaseFind(planned);
  const expectedPath = `finds/${find.id}/${planned.photo.filename}`;
  const client = createMockClient({
    collections: verified.plan.collections,
    finds: [find],
    fail: { uploadAfterWriteError: true }
  });
  const initial = await dryRun(client);
  await assert.rejects(
    () => executeCatalogMigration({ client, verified, dryRun: initial, ...confirmation, clock: () => 100 }),
    (error) => error.partial === true && error.manualReview === true && /no unconfirmed artifact was deleted/i.test(error.message)
  );
  assert.equal(client.state.finds.length, 1);
  assert.equal(client.state.find_photos.length, 0);
  assert.equal(client.objects.has(expectedPath), true);
  assert.equal(client.calls.removes, 0);
  assert.equal(client.calls.uploads, 1);
});

test("an ambiguous metadata insert is re-read and reconciled before verified rollback", async () => {
  const client = createMockClient({
    collections: verified.plan.collections,
    fail: { metadataAfterWriteError: true, photoDeleteAfterWriteError: true }
  });
  const initial = await dryRun(client);
  await assert.rejects(
    () => executeCatalogMigration({ client, verified, dryRun: initial, ...confirmation, clock: () => 100 }),
    (error) => error.partial === true && error.rollbackFailed === false && /metadata response was ambiguous/i.test(error.message)
  );
  assert.equal(client.state.finds.length, 0);
  assert.equal(client.state.find_photos.length, 0);
  assert.equal(client.objects.size, 0);
  assert.equal(client.calls.removes, 1);
});

test("ambiguous cleanup responses are reconciled by final absence reads", async () => {
  const client = createMockClient({
    collections: verified.plan.collections,
    fail: { metadata: true, removeAfterWriteError: true, findDeleteAfterWriteError: true }
  });
  const initial = await dryRun(client);
  await assert.rejects(
    () => executeCatalogMigration({ client, verified, dryRun: initial, ...confirmation, clock: () => 100 }),
    (error) => error.partial === true && error.rollbackFailed === false && /absence was verified/i.test(error.message)
  );
  assert.equal(client.state.finds.length, 0);
  assert.equal(client.objects.size, 0);
});

test("rollback success is verified rather than inferred from a successful no-op response", async () => {
  const client = createMockClient({
    collections: verified.plan.collections,
    fail: { metadata: true, removeNoop: true }
  });
  const initial = await dryRun(client);
  await assert.rejects(
    () => executeCatalogMigration({ client, verified, dryRun: initial, ...confirmation, clock: () => 100 }),
    (error) => error.partial === true && error.rollbackFailed === true && /remaining Finds were stopped/i.test(error.message)
  );
  assert.equal(client.objects.size, 1);
  assert.equal(client.state.finds.length, 0);
  assert.equal(client.calls.uploads, 1);
});

test("database drift makes the dry-run stale before execution writes", async () => {
  const client = createMockClient({ collections: verified.plan.collections });
  const initial = await dryRun(client);
  const mismatch = databaseFind(verified.plan.finds[0]);
  mismatch.availability = "sold";
  client.state.finds.push(mismatch);
  await assert.rejects(
    () => executeCatalogMigration({ client, verified, dryRun: initial, ...confirmation, clock: () => 100 }),
    /stale/
  );
  assert.equal(client.calls.writes, 0);
});

test("local source drift is revalidated before execution writes", async () => {
  const client = createMockClient({ collections: verified.plan.collections });
  const initial = await dryRun(client);
  const changed = structuredClone(verified.plan);
  changed.finds[0].title = "Changed after dry-run";
  await assert.rejects(
    () => executeCatalogMigration({
      client,
      verified,
      dryRun: initial,
      ...confirmation,
      clock: () => 100,
      revalidateSources: async () => ({ ...verified, plan: changed })
    }),
    /sources changed/
  );
  assert.equal(client.calls.writes, 0);
});
