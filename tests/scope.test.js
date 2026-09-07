import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ScopeStack, addRepeaterItem, removeRepeaterItem } from "../src/scope.js";
import { getAt } from "../src/path.js";

describe("Theta Scope & Repeater Subsystem", () => {
  test("ScopeStack pushes and pops immutably", () => {
    const s0 = new ScopeStack();
    assert.equal(s0.isEmpty(), true);

    const s1 = s0.push({ name: "party", index: 0 });
    assert.equal(s0.isEmpty(), true); // s0 untouched
    assert.equal(s1.current().name, "party");
    assert.equal(s1.current().index, 0);

    const s2 = s1.push({ name: "director", index: 3 });
    assert.equal(s2.current().name, "director");
    assert.equal(s2.get("party").index, 0);

    const s3 = s2.pop();
    assert.equal(s3.current().name, "party");
  });

  test("addRepeaterItem appends item immutably", () => {
    const facts = { sellers: [] };
    const repeater = {
      id: "sellers_rep",
      collectionPath: "sellers",
      scopeName: "seller",
      createItem: () => ({ name: "", pan: "" }),
    };

    const updated = addRepeaterItem(facts, repeater, { name: "Seller 1" });
    assert.equal(facts.sellers.length, 0); // Original untouched
    assert.equal(updated.sellers.length, 1);
    assert.equal(updated.sellers[0].name, "Seller 1");

    const updated2 = addRepeaterItem(updated, repeater, { name: "Seller 2" });
    assert.equal(updated2.sellers.length, 2);
  });

  test("removeRepeaterItem removes specified item immutably", () => {
    const facts = {
      directors: [
        { name: "Dir A" },
        { name: "Dir B" },
        { name: "Dir C" },
      ],
    };
    const repeater = {
      id: "dir_rep",
      collectionPath: "directors",
      scopeName: "director",
      minItems: 1,
    };

    const updated = removeRepeaterItem(facts, repeater, 1); // remove Dir B
    assert.equal(facts.directors.length, 3);
    assert.equal(updated.directors.length, 2);
    assert.equal(updated.directors[0].name, "Dir A");
    assert.equal(updated.directors[1].name, "Dir C");

    // Min items constraint
    const atMin = { directors: [{ name: "Sole Dir" }] };
    assert.throws(() => removeRepeaterItem(atMin, repeater, 0), /minimum of 1 items/);
  });
});
