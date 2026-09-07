import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { tokenizePath, resolvePath, getAt, setAt, deleteAt } from "../src/path.js";
import { ScopeStack } from "../src/scope.js";

describe("Theta Path Subsystem", () => {
  test("tokenizes dot and bracket paths correctly", () => {
    const tokens = tokenizePath("parties[0].directors.$current.name");
    assert.deepEqual(tokens, [
      { type: "key", value: "parties" },
      { type: "index", value: 0 },
      { type: "key", value: "directors" },
      { type: "scope", value: "current" },
      { type: "key", value: "name" },
    ]);
  });

  test("resolves scope tokens via ScopeStack", () => {
    const stack = new ScopeStack()
      .push({ name: "party", index: 2 })
      .push({ name: "director", index: 1 });

    const resolved = resolvePath("parties.$party.directors.$current.pan", stack);
    assert.equal(resolved, "parties[2].directors[1].pan");
  });

  test("immutable getAt reads values cleanly", () => {
    const data = {
      parties: {
        sellers: [
          { name: "Alpha", age: 40 },
          { name: "Beta", age: 50 },
        ],
      },
    };

    assert.equal(getAt(data, "parties.sellers[0].name"), "Alpha");
    assert.equal(getAt(data, "parties.sellers[1].age"), 50);
    assert.equal(getAt(data, "parties.sellers[99].name"), undefined);
    assert.equal(getAt(data, "nonexistent.field"), undefined);
  });

  test("immutable setAt returns new root without mutating original", () => {
    const original = {
      property: {
        category: "flat",
      },
    };

    const updated = setAt(original, "property.flat.carpetArea", 850);

    // Original must remain untouched
    assert.equal(original.property.carpetArea, undefined);
    assert.equal(original.property.flat, undefined);

    // Updated must have the new structure
    assert.equal(updated.property.flat.carpetArea, 850);
    assert.equal(updated.property.category, "flat");
    assert.notEqual(original, updated);
  });

  test("immutable setAt handles arrays seamlessly", () => {
    const original = { items: ["first"] };
    const updated = setAt(original, "items[1]", "second");

    assert.equal(original.items.length, 1);
    assert.equal(updated.items.length, 2);
    assert.equal(updated.items[1], "second");
  });

  test("immutable deleteAt removes properties cleanly", () => {
    const original = {
      seller: {
        name: "Test",
        pan: "ABCDE1234F",
      },
    };

    const updated = deleteAt(original, "seller.pan");

    assert.equal(original.seller.pan, "ABCDE1234F");
    assert.equal(updated.seller.pan, undefined);
    assert.equal(updated.seller.name, "Test");
  });

  test("unscoped getAt and deleteAt operate across all array collection items", () => {
    const data = {
      partners: [
        { name: "Partner 1", din: "DIN-1" },
        { name: "Partner 2", din: "DIN-2" },
        { name: "Partner 3" },
      ],
    };

    // getAt without ScopeStack finds if any partner has a DIN
    assert.equal(getAt(data, "partners[$partner].din"), "DIN-1");

    // deleteAt without ScopeStack deletes din from all partners
    const cleaned = deleteAt(data, "partners[$partner].din");
    assert.equal(cleaned.partners.length, 3);
    assert.equal(cleaned.partners[0].din, undefined);
    assert.equal(cleaned.partners[1].din, undefined);
    assert.equal(cleaned.partners[0].name, "Partner 1");
    assert.equal(cleaned.partners[1].name, "Partner 2");
    assert.equal(cleaned.partners[2].name, "Partner 3");
  });

  test("setAt throws descriptive error if attempting to write with unresolved scope token", () => {
    const data = { partners: [] };
    assert.throws(
      () => setAt(data, "partners[$partner].name", "Alice"),
      /Cannot write to scoped path containing unresolved token '\$partner'/
    );
  });
});
