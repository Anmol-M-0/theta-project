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
});
