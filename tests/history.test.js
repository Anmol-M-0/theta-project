import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCommandHistory, replayCommandLog } from "../src/history.js";
import { canonicalEqual } from "../src/canonical.js";

describe("Theta Command History & Deterministic Replay Subsystem", () => {
  const schema = {
    id: "history_test_schema",
    version: 1,
    sections: [
      {
        id: "sec1",
        title: "Section 1",
        questions: [
          {
            id: "q_type",
            sectionId: "sec1",
            path: "entity.type",
            kind: "select",
            label: "Type",
            options: [
              { label: "Individual", value: "individual" },
              { label: "Company", value: "company" },
              { label: "LLP", value: "llp" },
            ],
          },
          { id: "q_cin", sectionId: "sec1", path: "entity.cin", kind: "cin", label: "CIN" },
        ],
      },
    ],
    branches: [
      {
        id: "b_comp",
        activation: { equals: { path: "entity.type", value: "company" } },
        ownedPaths: ["entity.cin"],
      },
    ],
  };

  test("replayCommandLog deterministically reconstructs final state from command history", () => {
    const commands = [
      { type: "COMMIT_ANSWER", questionId: "q_type", value: "company" },
      { type: "COMMIT_ANSWER", questionId: "q_cin", value: "U12345MH2020PTC000000" },
      { type: "COMMIT_ANSWER", questionId: "q_type", value: "individual" },
    ];

    const finalState = replayCommandLog(schema, {}, commands);
    assert.deepEqual(finalState.facts, {
      entity: { type: "individual" },
    });
    assert.equal(finalState.revision, 4);
  });

  test("createCommandHistory supports multi-step time travel (undo / redo)", () => {
    const history = createCommandHistory(schema);

    history.record({ type: "COMMIT_ANSWER", questionId: "q_type", value: "company" });
    history.record({ type: "COMMIT_ANSWER", questionId: "q_cin", value: "U12345MH2020PTC000000" });

    assert.equal(history.getCurrentState().facts.entity.cin, "U12345MH2020PTC000000");
    assert.equal(history.canUndo(), true);
    assert.equal(history.canRedo(), false);

    // 1. Undo cin commit
    const afterUndo1 = history.undo();
    assert.equal(afterUndo1.facts.entity.cin, undefined);
    assert.equal(afterUndo1.facts.entity.type, "company");
    assert.equal(history.canRedo(), true);

    // 2. Undo type commit
    const afterUndo2 = history.undo();
    assert.deepEqual(afterUndo2.facts, {});
    assert.equal(history.canUndo(), false);

    // 3. Redo type commit
    const afterRedo1 = history.redo();
    assert.equal(afterRedo1.facts.entity.type, "company");

    // 4. Record new branch: drops old redo stack
    history.record({ type: "COMMIT_ANSWER", questionId: "q_type", value: "llp" });
    assert.equal(history.getCurrentState().facts.entity.type, "llp");
    assert.equal(history.canRedo(), false);
  });
});
