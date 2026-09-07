import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createThetaEngine } from "../src/engine.js";
import { MemoryStorageAdapter } from "../src/storage.js";

describe("Theta Engine End-to-End Runtime", () => {
  const conveyanceSchema = {
    id: "indian_conveyance_test",
    version: 1,
    sections: [
      {
        id: "meta",
        title: "Execution Meta",
        questions: [
          {
            id: "prop_category",
            sectionId: "meta",
            path: "property.category",
            kind: "card",
            label: "What is the property category?",
            options: [
              { value: "flat", label: "Apartment / Flat" },
              { value: "plot", label: "Plot of Land" },
              { value: "agri", label: "Agricultural Land" },
            ],
          },
          {
            id: "execution_place",
            sectionId: "meta",
            path: "execution.place",
            kind: "text",
            label: "What is the place of execution?",
          },
        ],
      },
      {
        id: "sellers",
        title: "Seller First Part",
        questions: [
          {
            id: "seller_type",
            sectionId: "sellers",
            path: "seller.type",
            kind: "card",
            label: "What is the legal status of the Seller?",
            options: [
              { value: "individual", label: "Individual" },
              { value: "company", label: "Private Limited / Limited Company" },
            ],
          },
          {
            id: "seller_ind_pan",
            sectionId: "sellers",
            path: "seller.pan",
            kind: "text",
            label: "What is the Seller's PAN?",
            visibleWhen: { equals: { path: "seller.type", value: "individual" } },
          },
          {
            id: "seller_comp_cin",
            sectionId: "sellers",
            path: "seller.cin",
            kind: "text",
            label: "What is the Company's CIN / Corporate ID?",
            visibleWhen: { equals: { path: "seller.type", value: "company" } },
          },
        ],
      },
    ],
    branches: [
      {
        id: "company_branch",
        activation: { equals: { path: "seller.type", value: "company" } },
        ownedPaths: ["seller.cin"],
      },
      {
        id: "individual_branch",
        activation: { equals: { path: "seller.type", value: "individual" } },
        ownedPaths: ["seller.pan"],
      },
    ],
  };

  test("initializes engine and returns first eligible unanswered question", () => {
    const engine = createThetaEngine({ schema: conveyanceSchema });
    const q = engine.getActiveQuestion();

    assert.notEqual(q, null);
    assert.equal(q.questionId, "prop_category");
    assert.equal(q.kind, "card");
    assert.equal(q.options.length, 3);
  });

  test("advances linearly as answers are committed", () => {
    const engine = createThetaEngine({ schema: conveyanceSchema });

    // Answer Q1: Property Category
    engine.dispatch({
      type: "SET_FACT",
      path: "property.category",
      value: "flat",
    });

    const q2 = engine.getActiveQuestion();
    assert.equal(q2.questionId, "execution_place");

    // Answer Q2: Place of Execution
    engine.dispatch({
      type: "SET_FACT",
      path: "execution.place",
      value: "Pune",
    });

    const q3 = engine.getActiveQuestion();
    assert.equal(q3.questionId, "seller_type");
  });

  test("dynamically activates conditional branch questions based on discriminator", () => {
    const engine = createThetaEngine({
      schema: conveyanceSchema,
      initialFacts: {
        property: { category: "flat" },
        execution: { place: "Pune" },
      },
    });

    // Select Seller Type: Company
    engine.dispatch({
      type: "SET_FACT",
      path: "seller.type",
      value: "company",
    });

    const qCompany = engine.getActiveQuestion();
    assert.equal(qCompany.questionId, "seller_comp_cin");
    assert.equal(qCompany.label.includes("CIN"), true);
  });

  test("atomic branch invalidation cleans stale facts when discriminator switches", () => {
    const engine = createThetaEngine({
      schema: conveyanceSchema,
      initialFacts: {
        property: { category: "flat" },
        execution: { place: "Pune" },
        seller: {
          type: "company",
          cin: "U12345MH2022PTC999999",
        },
      },
    });

    assert.equal(engine.getState().facts.seller.cin, "U12345MH2022PTC999999");

    // Switch to individual
    engine.dispatch({
      type: "SET_FACT",
      path: "seller.type",
      value: "individual",
    });

    // Old CIN must be completely purged!
    assert.equal(engine.getState().facts.seller.cin, undefined);
    assert.equal(engine.getState().facts.seller.type, "individual");

    // Next question must now be Individual PAN
    const nextQ = engine.getActiveQuestion();
    assert.equal(nextQ.questionId, "seller_ind_pan");
  });

  test("one-click edit jump sets target cursor and returns cleanly", () => {
    const engine = createThetaEngine({
      schema: conveyanceSchema,
      initialFacts: {
        property: { category: "flat" },
        execution: { place: "Pune" },
        seller: { type: "individual", pan: "ABCDE1234F" },
      },
    });

    // User is on Review page and clicks [EDIT] on Execution Place
    engine.dispatch({
      type: "SET_CURSOR",
      questionId: "execution_place",
      returnTo: "review",
    });

    assert.equal(engine.getActiveQuestion().questionId, "execution_place");
    assert.equal(engine.getReturnTo(), "review");

    // Edit value
    engine.dispatch({
      type: "SET_FACT",
      path: "execution.place",
      value: "Haveli, Pune",
    });

    assert.equal(engine.getState().facts.execution.place, "Haveli, Pune");

    // Clear cursor to resume normal review
    engine.dispatch({ type: "CLEAR_CURSOR" });
    assert.equal(engine.getReturnTo(), null);
  });

  test("builds Master Review Tree with statistics", () => {
    const engine = createThetaEngine({
      schema: conveyanceSchema,
      initialFacts: {
        property: { category: "flat" },
        execution: { place: "Pune" },
        seller: { type: "individual" },
      },
    });

    const review = engine.getReviewTree();
    assert.equal(review.sections.length, 2);
    assert.equal(review.stats.complete, 3); // category, place, seller_type
    assert.equal(review.stats.blockers, 1); // seller_ind_pan is missing!
  });

  test("persists state to storage adapter and reloads cleanly", async () => {
    const storage = new MemoryStorageAdapter();

    const engine1 = createThetaEngine({
      schema: conveyanceSchema,
      storage,
    });

    engine1.dispatch({
      type: "SET_FACT",
      path: "property.category",
      value: "plot",
    });

    // Wait a tick for async persist
    await new Promise((r) => setTimeout(r, 10));

    // Spin up engine 2 using the same storage
    const engine2 = createThetaEngine({
      schema: conveyanceSchema,
      storage,
    });

    await engine2.init();

    assert.equal(engine2.getState().facts.property.category, "plot");
    assert.equal(engine2.getRevision(), engine1.getRevision());
  });

  test("COMMIT_ANSWER executes question validation contract and rejects invalid input", () => {
    const validatingSchema = {
      id: "pan_validation_schema",
      version: 1,
      sections: [
        {
          id: "kyc",
          title: "KYC Details",
          questions: [
            {
              id: "pan_number",
              sectionId: "kyc",
              path: "seller.pan",
              kind: "pan",
              label: "Enter 10-digit Permanent Account Number (PAN)",
              validate: (val) => {
                if (typeof val !== "string" || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(val)) {
                  return "Invalid Indian PAN format (expected ABCDE1234F)";
                }
                return true;
              },
            },
          ],
        },
      ],
    };

    const engine = createThetaEngine({ schema: validatingSchema });
    const initialRev = engine.getRevision();

    // 1. Submit invalid PAN
    const failRes = engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "pan_number",
      value: "123INVALID",
    });

    assert.equal(failRes.ok, false);
    assert.equal(failRes.error, "Invalid Indian PAN format (expected ABCDE1234F)");
    assert.equal(engine.getState().facts.seller?.pan, undefined);
    assert.equal(engine.getRevision(), initialRev); // Revision must NOT increment on validation failure!

    // 2. Submit valid PAN
    const passRes = engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "pan_number",
      value: "ABCDE1234F",
    });

    assert.equal(passRes.ok, true);
    assert.equal(engine.getState().facts.seller.pan, "ABCDE1234F");
    assert.equal(engine.getRevision(), initialRev + 1);
  });

  test("repeater collections expand into QuestionInstances in active question and review tree", () => {
    const repeaterSchema = {
      id: "parties_schema",
      version: 1,
      sections: [
        {
          id: "parties_sec",
          title: "Parties First Part",
          questions: [
            {
              id: "party_name",
              sectionId: "parties_sec",
              path: "parties[$party].name",
              kind: "text",
              label: "Party Full Legal Name",
            },
            {
              id: "party_pan",
              sectionId: "parties_sec",
              path: "parties[$party].pan",
              kind: "pan",
              label: "Party PAN",
            },
          ],
        },
      ],
      repeaters: [
        {
          id: "party_repeater",
          collectionPath: "parties",
          scopeName: "party",
          itemLabel: "Party",
        },
      ],
    };

    const engine = createThetaEngine({
      schema: repeaterSchema,
      initialFacts: {
        parties: [
          { id: "p1", name: "Suresh Sharma" },
          { id: "p2" }, // Missing name and pan
        ],
      },
    });

    // Q1 for Party 1 (name is answered, so active should be party_pan for Party 1)
    const active1 = engine.getActiveQuestion();
    assert.equal(active1.questionId, "party_pan");
    assert.equal(active1.id, "party_pan@party:p1");
    assert.equal(active1.path, "parties[0].pan");

    // Commit Party 1 PAN
    engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "party_pan@party:p1",
      path: "parties[0].pan",
      value: "AAAPS1234K",
    });

    // Next active question must be Party 2 Name!
    const active2 = engine.getActiveQuestion();
    assert.equal(active2.questionId, "party_name");
    assert.equal(active2.id, "party_name@party:p2");
    assert.equal(active2.path, "parties[1].name");

    // Verify Review Tree contains both items
    const tree = engine.getReviewTree();
    assert.equal(tree.stats.total, 4); // 2 questions * 2 parties
    assert.equal(tree.stats.complete, 2); // p1.name, p1.pan
    assert.equal(tree.stats.blockers, 2); // p2.name, p2.pan
  });

  test("persistence queue serializes rapid async persistence writes in order", async () => {
    const storage = new MemoryStorageAdapter();
    const engine = createThetaEngine({ schema: conveyanceSchema, storage });

    // Rapid dispatches
    for (let i = 1; i <= 5; i++) {
      engine.dispatch({
        type: "SET_FACT",
        path: "property.category",
        value: `category_${i}`,
      });
    }

    await engine.flush();

    const loaded = await storage.load();
    assert.equal(loaded.facts.property.category, "category_5");
    assert.equal(loaded.revision, 6);
  });
});
