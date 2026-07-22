import assert from "node:assert/strict";
import test from "node:test";

import { performDryRun } from "../../admin-src/migration-executor.js";
import { createMockClient, loadVerifiedPlan } from "./mock-client.mjs";

const verified = loadVerifiedPlan();

test("plan contains the exact six Collections with repository status mapping", () => {
  assert.deepEqual(verified.plan.collections.map((item) => item.id), [
    "jewelry", "vintage", "home-decor", "kitchen", "collectibles", "new-items"
  ]);
  assert.equal(verified.plan.collections[0].status, "active");
  assert.ok(verified.plan.collections.slice(1).every((item) => item.status === "coming_soon"));
});

test("a Collection mismatch blocks dry-run without a write", async () => {
  const collections = verified.plan.collections.map((item) => ({ ...item }));
  collections[1].label = "Wrong";
  const client = createMockClient({ collections });
  const result = await performDryRun({ client, verified, clock: () => 1 });
  assert.equal(result.ready, false);
  assert.match(result.errors.join("\n"), /Collection vintage/);
  assert.equal(client.calls.writes, 0);
  assert.equal(collections[1].label, "Wrong");
});
