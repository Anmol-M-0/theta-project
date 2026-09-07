import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { canonicalize, canonicalEqual, canonicalJson } from "../src/canonical.js";

describe("Theta Canonical State & Equality Subsystem", () => {
  test("canonicalize sorts object keys deterministically", () => {
    const obj1 = { z: 1, a: 2, m: { b: 3, a: 4 } };
    const obj2 = { a: 2, m: { a: 4, b: 3 }, z: 1 };

    assert.equal(canonicalJson(obj1), canonicalJson(obj2));
    assert.deepEqual(Object.keys(canonicalize(obj1)), ["a", "m", "z"]);
  });

  test("canonicalEqual performs deep structural equality regardless of key insertion order", () => {
    const a = {
      parties: [{ name: "Alice", id: "p1" }, { name: "Bob", id: "p2" }],
      meta: { place: "Pune", timestamp: 12345 },
    };
    const b = {
      meta: { timestamp: 12345, place: "Pune" },
      parties: [{ id: "p1", name: "Alice" }, { id: "p2", name: "Bob" }],
    };

    assert.equal(canonicalEqual(a, b), true);
    assert.equal(canonicalEqual(a, { ...b, meta: { ...b.meta, place: "Mumbai" } }), false);
  });
});
