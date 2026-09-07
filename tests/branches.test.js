import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { planInvalidations, applyInvalidations } from "../src/branches.js";
import { commitFactTransaction } from "../src/transaction.js";

describe("Theta Branch Invalidation Subsystem", () => {
  const schema = {
    id: "test_schema",
    version: 1,
    sections: [],
    branches: [
      {
        id: "company_branch",
        activation: { equals: { path: "seller.type", value: "company" } },
        ownedPaths: ["seller.companyDetails", "seller.directors"],
      },
      {
        id: "individual_branch",
        activation: { equals: { path: "seller.type", value: "individual" } },
        ownedPaths: ["seller.personalDetails"],
      },
    ],
  };

  test("plans invalidations when branch switches from active to inactive", () => {
    const oldFacts = {
      seller: {
        type: "company",
        companyDetails: { cin: "U12345MH2020PTC123456" },
        directors: [{ name: "Director 1" }],
      },
    };

    const newFacts = {
      seller: {
        type: "individual",
        companyDetails: { cin: "U12345MH2020PTC123456" },
        directors: [{ name: "Director 1" }],
      },
    };

    const invalidations = planInvalidations(schema, oldFacts, newFacts);
    assert.equal(invalidations.includes("seller.companyDetails"), true);
    assert.equal(invalidations.includes("seller.directors"), true);
    assert.equal(invalidations.includes("seller.personalDetails"), false);
  });

  test("applyInvalidations purges declared paths cleanly", () => {
    const facts = {
      seller: {
        type: "individual",
        companyDetails: { cin: "stale" },
        directors: [{ name: "stale" }],
        name: "Rajesh Kumar",
      },
    };

    const cleaned = applyInvalidations(facts, ["seller.companyDetails", "seller.directors"]);
    assert.equal(cleaned.seller.companyDetails, undefined);
    assert.equal(cleaned.seller.directors, undefined);
    assert.equal(cleaned.seller.name, "Rajesh Kumar");
    assert.equal(cleaned.seller.type, "individual");
  });

  test("commitFactTransaction executes atomic mutation and invalidation together", () => {
    const state = {
      facts: {
        seller: {
          type: "company",
          companyDetails: { cin: "U12345" },
        },
      },
      revision: 5,
    };

    const res = commitFactTransaction(schema, state, "seller.type", "individual");

    assert.equal(res.state.revision, 6);
    assert.equal(res.state.facts.seller.type, "individual");
    assert.equal(res.state.facts.seller.companyDetails, undefined);
  });
});
