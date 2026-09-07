import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createThetaEngine } from "../src/engine.js";
import { compileSchema, validateSchema } from "../src/schema.js";
import { MemoryStorageAdapter } from "../src/storage.js";
import { ScopeStack, addRepeaterItem, removeRepeaterItem } from "../src/scope.js";
import { commitFactTransaction } from "../src/transaction.js";
import { getEligibleQuestions } from "../src/projections.js";

describe("Theta Invariant Verification Suite (8 Invariants)", () => {
  const baseSchema = {
    id: "invariant_test_schema",
    version: 1,
    sections: [
      {
        id: "sec_core",
        title: "Core Intake",
        questions: [
          {
            id: "entity_type",
            sectionId: "sec_core",
            path: "entity.type",
            kind: "select",
            label: "Entity Type",
            options: [
              { value: "llp", label: "LLP" },
              { value: "pvt_ltd", label: "Private Limited" },
              { value: "partnership", label: "Partnership Firm" },
            ],
          },
          {
            id: "cin_number",
            sectionId: "sec_core",
            path: "entity.cin",
            kind: "cin",
            label: "Corporate CIN",
            visibleWhen: { equals: { path: "entity.type", value: "pvt_ltd" } },
            validate: (val) => {
              if (typeof val === "string" && /^U\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(val)) return true;
              return "Invalid 21-digit Indian Corporate CIN format";
            },
          },
          {
            id: "llpin_number",
            sectionId: "sec_core",
            path: "entity.llpin",
            kind: "text",
            label: "LLP Identification Number",
            visibleWhen: { equals: { path: "entity.type", value: "llp" } },
          },
        ],
      },
      {
        id: "sec_partners",
        title: "Partners / Directors",
        questions: [
          {
            id: "partner_name",
            sectionId: "sec_partners",
            path: "partners[$partner].name",
            kind: "text",
            label: "Partner Legal Name",
          },
          {
            id: "partner_din",
            sectionId: "sec_partners",
            path: "partners[$partner].din",
            kind: "text",
            label: "Director Identification Number (DIN)",
            visibleWhen: { equals: { path: "entity.type", value: "pvt_ltd" } },
          },
        ],
      },
    ],
    branches: [
      {
        id: "branch_pvt_ltd",
        activation: { equals: { path: "entity.type", value: "pvt_ltd" } },
        ownedPaths: ["entity.cin", "partners[$partner].din"],
      },
      {
        id: "branch_llp",
        activation: { equals: { path: "entity.type", value: "llp" } },
        ownedPaths: ["entity.llpin"],
      },
    ],
    repeaters: [
      {
        id: "partner_repeater",
        collectionPath: "partners",
        scopeName: "partner",
        itemLabel: "Partner",
        minItems: 1,
        maxItems: 5,
      },
    ],
  };

  // --------------------------------------------------------------------------
  // Invariant 1: Canonical Fact Purity
  // --------------------------------------------------------------------------
  test("Invariant 1: Canonical Fact Purity - No projection/UI state is stored in canonical facts", () => {
    const engine = createThetaEngine({ schema: baseSchema });

    engine.dispatch({ type: "SET_FACT", path: "entity.type", value: "pvt_ltd" });
    engine.dispatch({ type: "SET_CURSOR", questionId: "cin_number", returnTo: "review" });

    const state = engine.getState();

    // Verify only canonical facts exist
    assert.deepEqual(Object.keys(state), ["facts", "revision"]);
    assert.deepEqual(Object.keys(state.facts), ["entity"]);
    assert.equal(state.facts.entity.type, "pvt_ltd");
    assert.equal(state.facts.activeCursorId, undefined);
    assert.equal(state.facts.returnTo, undefined);
    assert.equal(state.facts.validationErrors, undefined);

    // Verify immutability: mutating returned state does not affect engine
    state.facts.entity.type = "HACKED";
    assert.equal(engine.getState().facts.entity.type, "pvt_ltd");
  });

  // --------------------------------------------------------------------------
  // Invariant 2: Inactive Branch Fact Non-Existence
  // --------------------------------------------------------------------------
  test("Invariant 2: Inactive Branch Fact Non-Existence - Dead branch facts are completely purged", () => {
    const engine = createThetaEngine({
      schema: baseSchema,
      initialFacts: {
        entity: {
          type: "pvt_ltd",
          cin: "U12345MH2020PTC123456",
        },
      },
    });

    assert.equal(engine.getState().facts.entity.cin, "U12345MH2020PTC123456");

    // Transition away from pvt_ltd to llp
    engine.dispatch({
      type: "SET_FACT",
      path: "entity.type",
      value: "llp",
    });

    const facts = engine.getState().facts;
    assert.equal(facts.entity.type, "llp");
    assert.equal(facts.entity.cin, undefined); // Must NOT exist
  });

  test("Invariant 2: 4-Level Deep Cascading Branch Invalidation (A -> B -> C -> D)", () => {
    const deepSchema = {
      id: "deep_cascade",
      version: 1,
      sections: [],
      branches: [
        {
          id: "b1",
          activation: { equals: { path: "tier1", value: "active" } },
          ownedPaths: ["tier2"],
        },
        {
          id: "b2",
          activation: { equals: { path: "tier2", value: "active" } },
          ownedPaths: ["tier3"],
        },
        {
          id: "b3",
          activation: { equals: { path: "tier3", value: "active" } },
          ownedPaths: ["tier4"],
        },
        {
          id: "b4",
          activation: { equals: { path: "tier4", value: "active" } },
          ownedPaths: ["leaf_data"],
        },
      ],
    };

    const state = {
      facts: {
        tier1: "active",
        tier2: "active",
        tier3: "active",
        tier4: "active",
        leaf_data: "SECRET_VALUE",
      },
      revision: 1,
    };

    const res = commitFactTransaction(deepSchema, state, "tier1", "disabled");

    assert.equal(res.state.facts.tier1, "disabled");
    assert.equal(res.state.facts.tier2, undefined);
    assert.equal(res.state.facts.tier3, undefined);
    assert.equal(res.state.facts.tier4, undefined);
    assert.equal(res.state.facts.leaf_data, undefined);
  });

  // --------------------------------------------------------------------------
  // Invariant 3: Repeater Identity Stability & Lineage
  // --------------------------------------------------------------------------
  test("Invariant 3: Repeater Identity Stability - Deleting items preserves surviving item IDs", () => {
    let facts = {
      partners: [
        { id: "partner_001", name: "Anmol" },
        { id: "partner_002", name: "Virind" },
        { id: "partner_003", name: "Rina" },
      ],
    };
    const repeater = baseSchema.repeaters[0];

    // Remove middle item (Virind, index 1)
    const updated = removeRepeaterItem(facts, repeater, 1);

    assert.equal(updated.partners.length, 2);
    assert.equal(updated.partners[0].id, "partner_001");
    assert.equal(updated.partners[0].name, "Anmol");
    // Surviving item at index 1 must still have its original id!
    assert.equal(updated.partners[1].id, "partner_003");
    assert.equal(updated.partners[1].name, "Rina");
  });

  test("Invariant 3: Nested Scope Identity Lineage prevents ID collisions across parent entities", () => {
    const nestedSchema = {
      id: "nested_rep_schema",
      version: 1,
      sections: [
        {
          id: "sec_companies",
          title: "Companies",
          questions: [
            {
              id: "dir_name",
              sectionId: "sec_companies",
              path: "companies[$company].directors[$director].name",
              kind: "text",
              label: "Director Name",
            },
          ],
        },
      ],
      repeaters: [
        {
          id: "comp_rep",
          collectionPath: "companies",
          scopeName: "company",
          itemLabel: "Company",
        },
        {
          id: "dir_rep",
          collectionPath: "companies[$company].directors",
          scopeName: "director",
          itemLabel: "Director",
        },
      ],
    };

    const stackA = new ScopeStack()
      .push({ name: "company", index: 0, id: "comp_A" })
      .push({ name: "director", index: 0, id: "dir_X" });

    const stackB = new ScopeStack()
      .push({ name: "company", index: 1, id: "comp_B" })
      .push({ name: "director", index: 0, id: "dir_X" }); // Same director ID 'dir_X' inside different companies!

    const facts = {
      companies: [
        { id: "comp_A", directors: [{ id: "dir_X", name: "Alice" }] },
        { id: "comp_B", directors: [{ id: "dir_X", name: "Bob" }] },
      ],
    };

    const instancesA = getEligibleQuestions(nestedSchema, facts, stackA);
    const instancesB = getEligibleQuestions(nestedSchema, facts, stackB);

    assert.equal(instancesA[0].instanceId, "dir_name@company:comp_A/director:dir_X");
    assert.equal(instancesB[0].instanceId, "dir_name@company:comp_B/director:dir_X");
    assert.notEqual(instancesA[0].instanceId, instancesB[0].instanceId);
  });

  test("Invariant 3: Falsy ID support (id = 0 is preserved cleanly)", () => {
    const facts = { partners: [] };
    const repeater = baseSchema.repeaters[0];

    const updated = addRepeaterItem(facts, repeater, { id: 0, name: "Zero ID Partner" });
    assert.equal(updated.partners[0].id, 0);
  });

  // --------------------------------------------------------------------------
  // Invariant 4: Single-Transaction Atomicity & Determinism
  // --------------------------------------------------------------------------
  test("Invariant 4: Single-Transaction Atomicity - Failed validation leaves state and revision intact", () => {
    const engine = createThetaEngine({
      schema: baseSchema,
      initialFacts: { entity: { type: "pvt_ltd" } },
    });

    const initialRev = engine.getRevision();
    const initialFacts = engine.getState().facts;

    const res = engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "cin_number",
      value: "INVALID_CIN",
    });

    assert.equal(res.ok, false);
    assert.equal(engine.getRevision(), initialRev);
    assert.deepEqual(engine.getState().facts, initialFacts);
  });

  // --------------------------------------------------------------------------
  // Invariant 5: Fail-Fast Schema Compilation
  // --------------------------------------------------------------------------
  test("Invariant 5: Fail-Fast Schema Compilation - Malformed schemas throw immediately", () => {
    assert.throws(
      () => compileSchema({ id: "empty", version: 1, sections: [] }),
      /Schema must contain at least one section/
    );

    assert.throws(
      () =>
        compileSchema({
          id: "dup",
          version: 1,
          sections: [
            {
              id: "s1",
              title: "S1",
              questions: [
                { id: "q_dup", sectionId: "s1", path: "a", kind: "text", label: "Q1" },
                { id: "q_dup", sectionId: "s1", path: "b", kind: "text", label: "Q2" },
              ],
            },
          ],
        }),
      /Duplicate question id 'q_dup'/
    );
  });

  // --------------------------------------------------------------------------
  // Invariant 6: Semantic Command Validation vs Raw Mutation
  // --------------------------------------------------------------------------
  test("Invariant 6: Semantic Command Validation vs Raw Mutation", () => {
    const engine = createThetaEngine({
      schema: baseSchema,
      initialFacts: { entity: { type: "pvt_ltd" } },
    });

    // 1. COMMIT_ANSWER enforces validator
    const invalidCommit = engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "cin_number",
      value: "NOT_A_CIN",
    });
    assert.equal(invalidCommit.ok, false);

    // 2. SET_FACT provides low-level raw mutation
    const rawSet = engine.dispatch({
      type: "SET_FACT",
      path: "entity.cin",
      value: "RAW_PRE_SEEDED_VALUE",
    });
    assert.equal(rawSet.ok, true);
    assert.equal(engine.getState().facts.entity.cin, "RAW_PRE_SEEDED_VALUE");
  });

  // --------------------------------------------------------------------------
  // Invariant 7: Linear Revision Monotonicity
  // --------------------------------------------------------------------------
  test("Invariant 7: Linear Revision Monotonicity - Revisions increment strictly +1 per successful mutation", () => {
    const engine = createThetaEngine({ schema: baseSchema });
    assert.equal(engine.getRevision(), 1);

    engine.dispatch({ type: "SET_FACT", path: "entity.type", value: "llp" });
    assert.equal(engine.getRevision(), 2);

    engine.dispatch({ type: "SET_FACT", path: "entity.llpin", value: "AAA-1234" });
    assert.equal(engine.getRevision(), 3);

    engine.dispatch({ type: "DELETE_FACT", path: "entity.llpin" });
    assert.equal(engine.getRevision(), 4);
  });

  // --------------------------------------------------------------------------
  // Invariant 8: Durability Isolation & Write Ordering
  // --------------------------------------------------------------------------
  test("Invariant 8: Durability Isolation & Write Ordering", async () => {
    const storage = new MemoryStorageAdapter();
    const engine = createThetaEngine({ schema: baseSchema, storage });

    engine.dispatch({ type: "SET_FACT", path: "entity.type", value: "llp" });
    engine.dispatch({ type: "SET_FACT", path: "entity.llpin", value: "LLP-001" });
    engine.dispatch({ type: "SET_FACT", path: "entity.llpin", value: "LLP-002-FINAL" });

    await engine.flush();

    const saved = await storage.load();
    assert.equal(saved.facts.entity.llpin, "LLP-002-FINAL");
    assert.equal(saved.revision, 4);
  });
});
