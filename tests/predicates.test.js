import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { evaluatePredicate, deepEqual, isPresent } from "../src/predicates.js";
import { ScopeStack } from "../src/scope.js";

describe("Theta Predicates Subsystem", () => {
  test("deepEqual compares primitives, objects, and arrays accurately", () => {
    assert.equal(deepEqual(1, 1), true);
    assert.equal(deepEqual("test", "test"), true);
    assert.equal(deepEqual([1, 2], [1, 2]), true);
    assert.equal(deepEqual([1, 2], [1, 3]), false);
    assert.equal(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
    assert.equal(deepEqual({ a: 1 }, { a: 2 }), false);
  });

  test("isPresent handles empty values correctly", () => {
    assert.equal(isPresent(null), false);
    assert.equal(isPresent(undefined), false);
    assert.equal(isPresent(""), false);
    assert.equal(isPresent("   "), false);
    assert.equal(isPresent([]), false);
    assert.equal(isPresent("valid"), true);
    assert.equal(isPresent(0), true);
    assert.equal(isPresent(false), true);
    assert.equal(isPresent(["item"]), true);
  });

  test("evaluates equals and notEquals operators", () => {
    const facts = { transaction: { type: "agreement_to_sale" } };

    assert.equal(
      evaluatePredicate({ equals: { path: "transaction.type", value: "agreement_to_sale" } }, { facts }),
      true
    );
    assert.equal(
      evaluatePredicate({ equals: { path: "transaction.type", value: "sale_deed" } }, { facts }),
      false
    );
    assert.equal(
      evaluatePredicate({ notEquals: { path: "transaction.type", value: "sale_deed" } }, { facts }),
      true
    );
  });

  test("evaluates in and notIn operators", () => {
    const facts = { party: { type: "company" } };

    assert.equal(
      evaluatePredicate({ in: { path: "party.type", values: ["company", "llp"] } }, { facts }),
      true
    );
    assert.equal(
      evaluatePredicate({ in: { path: "party.type", values: ["individual", "trust"] } }, { facts }),
      false
    );
    assert.equal(
      evaluatePredicate({ notIn: { path: "party.type", values: ["individual", "trust"] } }, { facts }),
      true
    );
  });

  test("evaluates exists operator", () => {
    const facts = { seller: { pan: "ABCDE1234F", cin: "" } };

    assert.equal(evaluatePredicate({ exists: { path: "seller.pan" } }, { facts }), true);
    assert.equal(evaluatePredicate({ exists: { path: "seller.cin" } }, { facts }), false);
    assert.equal(evaluatePredicate({ exists: { path: "seller.missing" } }, { facts }), false);
  });

  test("evaluates boolean composition: all, any, not with scope", () => {
    const facts = {
      parties: [
        { type: "company", resident: true },
        { type: "individual", resident: false },
      ],
    };

    const stack = new ScopeStack().push({ name: "party", index: 0 });

    const complexPredicate = {
      all: [
        { equals: { path: "parties.$current.type", value: "company" } },
        {
          any: [
            { equals: { path: "parties.$current.resident", value: true } },
            { not: { exists: { path: "parties.$current.type" } } },
          ],
        },
      ],
    };

    assert.equal(evaluatePredicate(complexPredicate, { facts, scope: stack }), true);

    const stack1 = new ScopeStack().push({ name: "party", index: 1 });
    assert.equal(evaluatePredicate(complexPredicate, { facts, scope: stack1 }), false);
  });
});
