import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createMigrationRunner,
  renameFactPath,
  transformFactPath,
  deleteFactPath,
} from "../src/migration.js";

describe("Theta Schema & State Migration Subsystem", () => {
  test("declarative path manipulation helpers work immutably", () => {
    const facts = {
      entity: { oldCin: "U12345", category: "PRIVATE" },
      temp: "delete_me",
    };

    let updated = renameFactPath(facts, "entity.oldCin", "entity.cin");
    assert.equal(updated.entity.cin, "U12345");
    assert.equal(updated.entity.oldCin, undefined);

    updated = transformFactPath(updated, "entity.category", (val) => String(val).toLowerCase());
    assert.equal(updated.entity.category, "private");

    updated = deleteFactPath(updated, "temp");
    assert.equal(updated.temp, undefined);

    // Original facts remains unmutated
    assert.equal(facts.entity.oldCin, "U12345");
    assert.equal(facts.temp, "delete_me");
  });

  test("chains multi-version migrations deterministically (V1 -> V2 -> V3)", () => {
    const migrations = [
      {
        fromVersion: 1,
        toVersion: 2,
        description: "Rename seller.cin to seller.companyCin",
        up: (facts) => renameFactPath(facts, "seller.cin", "seller.companyCin"),
      },
      {
        fromVersion: 2,
        toVersion: 3,
        description: "Normalize party categories to uppercase",
        up: (facts) => transformFactPath(facts, "seller.category", (val) => String(val).toUpperCase()),
      },
    ];

    const runner = createMigrationRunner(migrations);

    const v1State = {
      facts: {
        seller: { cin: "L12345MH2020PLC000000", category: "pvt_ltd" },
      },
      revision: 5,
    };

    const v3State = runner.migrateState(v1State, 1, 3);
    assert.equal(v3State.facts.seller.companyCin, "L12345MH2020PLC000000");
    assert.equal(v3State.facts.seller.cin, undefined);
    assert.equal(v3State.facts.seller.category, "PVT_LTD");
    assert.equal(v3State.revision, 7); // 5 + 2 migration steps

    // Verify non-contiguous migration rejection
    assert.throws(() => runner.migrateFacts({}, 1, 4), /Missing contiguous migration step/);
  });
});
