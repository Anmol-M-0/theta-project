import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createIntakeEngine } from "../src/engine.js";
import { buildReviewTree, resolveActiveQuestion } from "../src/projections.js";

describe("Theta Incremental Invalidation & Topological Reconciliation Subsystem", () => {
  const complexSchema = {
    id: "incremental_test_schema",
    version: 1,
    sections: [
      {
        id: "sec_entity",
        title: "Entity Information",
        questions: [
          {
            id: "q_entity_type",
            sectionId: "sec_entity",
            path: "entity.type",
            kind: "select",
            label: "Entity Type",
            options: [
              { label: "Individual", value: "individual" },
              { label: "Company", value: "company" },
            ],
          },
          {
            id: "q_cin",
            sectionId: "sec_entity",
            branch: "branch_company",
            path: "entity.cin",
            kind: "cin",
            label: "Company CIN",
            visibleWhen: { equals: { path: "entity.type", value: "company" } },
          },
          {
            id: "q_is_sez",
            sectionId: "sec_entity",
            branch: "branch_company",
            path: "entity.isSez",
            kind: "select",
            label: "Is SEZ Unit?",
            options: [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ],
            visibleWhen: { equals: { path: "entity.type", value: "company" } },
          },
          {
            id: "q_sez_code",
            sectionId: "sec_entity",
            branch: "branch_sez",
            path: "entity.sezCode",
            kind: "text",
            label: "SEZ Registration Code",
            visibleWhen: { equals: { path: "entity.isSez", value: true } },
          },
        ],
      },
    ],
    branches: [
      {
        id: "branch_company",
        activation: { equals: { path: "entity.type", value: "company" } },
        ownedPaths: ["entity.cin", "entity.isSez"],
      },
      {
        id: "branch_sez",
        activation: { equals: { path: "entity.isSez", value: true } },
        ownedPaths: ["entity.sezCode"],
      },
    ],
  };

  test("Reactive subscription receives structured event metadata with dirtyQuestions and changedPaths", () => {
    const engine = createIntakeEngine(complexSchema);
    const receivedEvents = [];

    engine.subscribe((state, event) => {
      receivedEvents.push(event);
    });

    // 1. Commit entity type = company
    engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "q_entity_type",
      value: "company",
    });

    assert.equal(receivedEvents.length, 1);
    const evt1 = receivedEvents[0];
    assert.equal(evt1.type, "commit_answer");
    assert.deepEqual(evt1.changedPaths, ["entity.type"]);
    assert.equal(evt1.revision, 2);
    assert.equal(evt1.dirtyQuestions.includes("q_cin"), true);
    assert.equal(evt1.dirtyQuestions.includes("q_is_sez"), true);

    // 2. Commit CIN
    engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "q_cin",
      value: "U12345MH2020PTC000000",
    });

    // 3. Commit isSez = true
    engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "q_is_sez",
      value: true,
    });

    // 4. Commit sezCode
    engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "q_sez_code",
      value: "SEZ-9999",
    });

    assert.equal(engine.getState().facts.entity.sezCode, "SEZ-9999");

    // 5. Deactivate company branch by changing entity type to individual
    engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "q_entity_type",
      value: "individual",
    });

    const lastEvt = receivedEvents[receivedEvents.length - 1];
    assert.equal(lastEvt.type, "commit_answer");
    // Invalidated paths should contain all cascading dead branch facts
    assert.equal(lastEvt.invalidatedPaths.includes("entity.cin"), true);
    assert.equal(lastEvt.invalidatedPaths.includes("entity.isSez"), true);
    assert.equal(lastEvt.invalidatedPaths.includes("entity.sezCode"), true);

    // Canonical facts should only have entity.type = individual
    assert.deepEqual(engine.getState().facts, {
      entity: { type: "individual" },
    });
  });

  test("Equivalence Property: Incremental state transitions match full cold rebuilds exactly", () => {
    const engine = createIntakeEngine(complexSchema);

    const commands = [
      { type: "COMMIT_ANSWER", questionId: "q_entity_type", value: "company" },
      { type: "COMMIT_ANSWER", questionId: "q_cin", value: "U12345MH2020PTC000000" },
      { type: "COMMIT_ANSWER", questionId: "q_is_sez", value: true },
      { type: "COMMIT_ANSWER", questionId: "q_sez_code", value: "SEZ-9999" },
      { type: "COMMIT_ANSWER", questionId: "q_is_sez", value: false },
      { type: "COMMIT_ANSWER", questionId: "q_is_sez", value: true },
      { type: "COMMIT_ANSWER", questionId: "q_sez_code", value: "SEZ-8888" },
      { type: "COMMIT_ANSWER", questionId: "q_entity_type", value: "individual" },
      { type: "COMMIT_ANSWER", questionId: "q_entity_type", value: "company" },
    ];

    for (const cmd of commands) {
      engine.dispatch(cmd);
      const incrementalState = engine.getState();
      const incrementalActiveQ = engine.getActiveQuestion();
      const incrementalReviewTree = engine.getReviewTree();

      // Cold rebuild from scratch using pure projections over the canonical facts
      const coldActiveQ = resolveActiveQuestion(complexSchema, incrementalState.facts);
      const coldReviewTree = buildReviewTree(complexSchema, incrementalState.facts);

      assert.deepEqual(
        incrementalActiveQ,
        coldActiveQ,
        `Active Question mismatch at revision ${incrementalState.revision}`
      );
      assert.deepEqual(
        incrementalReviewTree,
        coldReviewTree,
        `Review Tree mismatch at revision ${incrementalState.revision}`
      );
    }
  });
});

  test("Repeater Instance Isolation: mutating parties[0] does not dirty concrete parties[1] dependencies", () => {
    const repeaterSchema = {
      id: "repeater_isolation_schema",
      version: 1,
      sections: [
        {
          id: "sec_parties",
          title: "Parties",
          questions: [
            {
              id: "q_p0_pan",
              sectionId: "sec_parties",
              path: "parties[0].pan",
              kind: "pan",
              label: "Party 0 PAN",
              visibleWhen: { equals: { path: "parties[0].isCompany", value: true } },
            },
            {
              id: "q_p1_pan",
              sectionId: "sec_parties",
              path: "parties[1].pan",
              kind: "pan",
              label: "Party 1 PAN",
              visibleWhen: { equals: { path: "parties[1].isCompany", value: true } },
            },
          ],
        },
      ],
      branches: [],
    };

    const engine = createIntakeEngine(repeaterSchema);
    const events = [];
    engine.subscribe((state, evt) => events.push(evt));

    // Mutate party 0
    engine.dispatch({
      type: "SET_FACT",
      path: "parties[0].isCompany",
      value: true,
    });

    assert.equal(events.length, 1);
    const evt = events[0];
    assert.deepEqual(evt.changedPaths, ["parties[0].isCompany"]);
    // dirtyQuestions must contain q_p0_pan, but MUST NOT contain q_p1_pan!
    assert.equal(evt.dirtyQuestions.includes("q_p0_pan"), true);
    assert.equal(evt.dirtyQuestions.includes("q_p1_pan"), false);
  });
