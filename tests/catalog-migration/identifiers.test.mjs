import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { parseIdentifierRegistry } from "../../scripts/lib/m07b3-plan.mjs";

const root = resolve(import.meta.dirname, "../..");

test("the first five identifiers remain exact and four new mappings end at BU-0009", () => {
  const registry = readFileSync(resolve(root, "docs/IDENTIFIER_REGISTRY.md"), "utf8");
  const rows = parseIdentifierRegistry(registry);
  assert.deepEqual(rows.slice(0, 5).map(({ public_id, legacy_id, slug }) => ({ public_id, legacy_id, slug })), [
    { public_id: "BU-0001", legacy_id: 1, slug: "gold-twisted-rope-bracelet" },
    { public_id: "BU-0002", legacy_id: 2, slug: "silver-stackable-ring-set" },
    { public_id: "BU-0003", legacy_id: 3, slug: "pearl-drop-earrings" },
    { public_id: "BU-0004", legacy_id: 4, slug: "layered-gold-chain-necklace" },
    { public_id: "BU-0005", legacy_id: 5, slug: "crystal-stud-earrings" }
  ]);
  assert.deepEqual(rows.slice(5).map(({ public_id, legacy_id, slug }) => ({ public_id, legacy_id, slug })), [
    { public_id: "BU-0006", legacy_id: null, slug: "vintage-ceramic-handbell" },
    { public_id: "BU-0007", legacy_id: null, slug: "burgundy-montblanc-pen" },
    { public_id: "BU-0008", legacy_id: null, slug: "hand-painted-decorative-shell" },
    { public_id: "BU-0009", legacy_id: null, slug: "vintage-floral-teacup-saucer" }
  ]);
  assert.match(registry, /The next new public ID is `BU-0010`/);
});

test("sequence migration is monotonic, content-free, and exposes no public helper", () => {
  const source = readFileSync(resolve(root, "supabase/migrations/20260722120000_m07b3_public_id_reservations.sql"), "utf8");
  assert.match(source, /current_value < 9 or \(current_value = 9 and not current_called\)/);
  assert.match(source, /setval\('public\.find_public_id_seq', 9, true\)/);
  assert.doesNotMatch(source, /insert\s+into/i);
  assert.doesNotMatch(source, /create\s+(?:or\s+replace\s+)?function\s+public\./i);
});

test("migration workflow never derives IDs from runtime row order", () => {
  const source = [
    readFileSync(resolve(root, "admin-src/migration-plan.js"), "utf8"),
    readFileSync(resolve(root, "admin-src/migration-executor.js"), "utf8"),
    readFileSync(resolve(root, "scripts/lib/m07b3-plan.mjs"), "utf8")
  ].join("\n");
  assert.doesNotMatch(source, /row\s*(?:index|number).*(?:public|BU-)/i);
  for (const id of ["BU-0006", "BU-0007", "BU-0008", "BU-0009"]) assert.ok(source.includes(id));
});
