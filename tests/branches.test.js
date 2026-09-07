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

  test("fixed-point cascading branch invalidation (3-level deep cascade: A -> B -> C)", () => {
    const cascadeSchema = {
      id: "cascade_schema",
      version: 1,
      sections: [],
      branches: [
        {
          id: "branch_commercial",
          activation: { equals: { path: "property.category", value: "commercial" } },
          ownedPaths: ["property.commercialKind"],
        },
        {
          id: "branch_office",
          activation: { equals: { path: "property.commercialKind", value: "office" } },
          ownedPaths: ["property.officeSpecs", "property.isSez"],
        },
        {
          id: "branch_sez",
          activation: { equals: { path: "property.isSez", value: true } },
          ownedPaths: ["property.sezApprovalCode", "property.customsZone"],
        },
      ],
    };

    const state = {
      facts: {
        property: {
          category: "commercial",
          commercialKind: "office",
          officeSpecs: { floor: 5, areaSqFt: 5000 },
          isSez: true,
          sezApprovalCode: "SEZ-9988",
          customsZone: "Zone-A",
        },
      },
      revision: 10,
    };

    // Switch top-level category from 'commercial' to 'residential'
    const res = commitFactTransaction(cascadeSchema, state, "property.category", "residential");

    assert.equal(res.state.revision, 11);
    assert.equal(res.state.facts.property.category, "residential");
    // All 3 tiers must be completely purged!
    assert.equal(res.state.facts.property.commercialKind, undefined);
    assert.equal(res.state.facts.property.officeSpecs, undefined);
    assert.equal(res.state.facts.property.isSez, undefined);
    assert.equal(res.state.facts.property.sezApprovalCode, undefined);
    assert.equal(res.state.facts.property.customsZone, undefined);

    // Verify changedPaths and invalidatedPaths
    assert.equal(res.invalidatedPaths.includes("property.commercialKind"), true);
    assert.equal(res.invalidatedPaths.includes("property.officeSpecs"), true);
    assert.equal(res.invalidatedPaths.includes("property.isSez"), true);
    assert.equal(res.invalidatedPaths.includes("property.sezApprovalCode"), true);
    assert.equal(res.invalidatedPaths.includes("property.customsZone"), true);
  });

  test("diamond dependency cascading branch invalidation (A -> B, A -> C, B+C -> D)", () => {
    const diamondSchema = {
      id: "diamond_schema",
      version: 1,
      sections: [],
      branches: [
        {
          id: "branch_entity",
          activation: { equals: { path: "entity.kind", value: "corporate" } },
          ownedPaths: ["entity.hasGst", "entity.hasCin"],
        },
        {
          id: "branch_gst",
          activation: { equals: { path: "entity.hasGst", value: true } },
          ownedPaths: ["entity.gstin"],
        },
        {
          id: "branch_cin",
          activation: { equals: { path: "entity.hasCin", value: true } },
          ownedPaths: ["entity.cinNumber"],
        },
        {
          id: "branch_compliance",
          activation: {
            all: [
              { exists: { path: "entity.gstin" } },
              { exists: { path: "entity.cinNumber" } },
            ],
          },
          ownedPaths: ["entity.complianceStatus", "entity.taxAuditYear"],
        },
      ],
    };

    const state = {
      facts: {
        entity: {
          kind: "corporate",
          hasGst: true,
          hasCin: true,
          gstin: "27AAACG0000A1Z5",
          cinNumber: "U72200MH2020PTC123456",
          complianceStatus: "VERIFIED",
          taxAuditYear: 2025,
        },
      },
      revision: 1,
    };

    const res = commitFactTransaction(diamondSchema, state, "entity.kind", "trust");

    assert.equal(res.state.facts.entity.kind, "trust");
    assert.equal(res.state.facts.entity.hasGst, undefined);
    assert.equal(res.state.facts.entity.hasCin, undefined);
    assert.equal(res.state.facts.entity.gstin, undefined);
    assert.equal(res.state.facts.entity.cinNumber, undefined);
    assert.equal(res.state.facts.entity.complianceStatus, undefined);
    assert.equal(res.state.facts.entity.taxAuditYear, undefined);
  });

  test("branch reactivation cleanly re-establishes without reviving stale sub-branch data", () => {
    const schema = {
      id: "toggle_schema",
      version: 1,
      sections: [],
      branches: [
        {
          id: "power_of_attorney",
          activation: { equals: { path: "transaction.isPoa", value: true } },
          ownedPaths: ["transaction.poaDetails"],
        },
      ],
    };

    let state = {
      facts: {
        transaction: {
          isPoa: true,
          poaDetails: { grantor: "Suresh", date: "2024-01-15" },
        },
      },
      revision: 1,
    };

    // Toggle off: isPoa = false
    state = commitFactTransaction(schema, state, "transaction.isPoa", false).state;
    assert.equal(state.facts.transaction.isPoa, false);
    assert.equal(state.facts.transaction.poaDetails, undefined);

    // Toggle back on: isPoa = true
    state = commitFactTransaction(schema, state, "transaction.isPoa", true).state;
    assert.equal(state.facts.transaction.isPoa, true);
    // Should NOT have old poaDetails magically revived
    assert.equal(state.facts.transaction.poaDetails, undefined);
  });
});
