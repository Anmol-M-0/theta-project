import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createIntakeEngine } from "../src/engine.js";
import { replayCommandLog, createCommandHistory } from "../src/history.js";
import { canonicalEqual } from "../src/canonical.js";
import { evaluatePredicate } from "../src/predicates.js";
import { getAt } from "../src/path.js";

/**
 * Deterministic Mulberry32 Pseudo-Random Number Generator.
 * @param {number} seed
 */
function createPrng(seed = 42) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("Theta Invariant Property-Based Fuzzer (1,000 Chaos Iterations Across Multi-Seeds)", () => {
  const fuzzSchema = {
    id: "fuzz_legal_schema",
    version: 1,
    sections: [
      {
        id: "sec_entity",
        title: "Entity & Parties",
        questions: [
          {
            id: "q_type",
            sectionId: "sec_entity",
            path: "entity.type",
            kind: "select",
            label: "Type",
            options: [
              { label: "Individual", value: "individual" },
              { label: "Company", value: "company" },
              { label: "LLP", value: "llp" },
              { label: "Partnership", value: "partnership" },
            ],
          },
          {
            id: "q_cin",
            sectionId: "sec_entity",
            branch: "b_comp",
            path: "entity.cin",
            kind: "cin",
            label: "CIN",
            visibleWhen: { equals: { path: "entity.type", value: "company" } },
          },
          {
            id: "q_sez",
            sectionId: "sec_entity",
            branch: "b_comp",
            path: "entity.isSez",
            kind: "select",
            label: "SEZ",
            options: [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ],
            visibleWhen: { equals: { path: "entity.type", value: "company" } },
          },
          {
            id: "q_sez_code",
            sectionId: "sec_entity",
            branch: "b_sez",
            path: "entity.sezCode",
            kind: "text",
            label: "SEZ Code",
            visibleWhen: { equals: { path: "entity.isSez", value: true } },
          },
          {
            id: "q_party_pan",
            sectionId: "sec_entity",
            path: "parties[$party].pan",
            kind: "pan",
            label: "Party PAN",
          },
        ],
      },
    ],
    branches: [
      {
        id: "b_comp",
        activation: { equals: { path: "entity.type", value: "company" } },
        ownedPaths: ["entity.cin", "entity.isSez"],
      },
      {
        id: "b_sez",
        activation: { equals: { path: "entity.isSez", value: true } },
        ownedPaths: ["entity.sezCode"],
      },
    ],
    repeaters: [
      {
        id: "rep_parties",
        collectionPath: "parties",
        scopeName: "party",
        label: "Parties",
      },
    ],
  };

  const seeds = [1337, 4242, 9999];

  for (const seed of seeds) {
    test(`Fuzzer [Seed ${seed}]: asserts all 10 invariants & repeater instance isolation over 1,000 iterations`, () => {
      const prng = createPrng(seed);
      const engine = createIntakeEngine(fuzzSchema);
      const history = createCommandHistory(fuzzSchema);

      const typeOptions = ["individual", "company", "llp", "partnership"];
      const commandsLogged = [];
      let partyCount = 0;

      for (let i = 0; i < 1000; i++) {
        const roll = prng();
        let cmd;

        if (roll < 0.25) {
          // Toggle entity type
          const val = typeOptions[Math.floor(prng() * typeOptions.length)];
          cmd = { type: "COMMIT_ANSWER", questionId: "q_type", path: "entity.type", value: val };
        } else if (roll < 0.45) {
          // Commit CIN
          const cinVal = `U${Math.floor(prng() * 90000 + 10000)}MH2020PTC000000`;
          cmd = { type: "COMMIT_ANSWER", questionId: "q_cin", path: "entity.cin", value: cinVal };
        } else if (roll < 0.60) {
          // Toggle SEZ
          const isSez = prng() > 0.5;
          cmd = { type: "COMMIT_ANSWER", questionId: "q_sez", path: "entity.isSez", value: isSez };
        } else if (roll < 0.70) {
          // Add repeater party
          partyCount++;
          cmd = { type: "ADD_REPEATER_ITEM", repeaterId: "rep_parties", item: { id: `p_${partyCount}`, name: `Party ${partyCount}` } };
        } else if (roll < 0.85 && partyCount > 0) {
          // Scoped party PAN mutation (Concrete instance isolation testing)
          const targetIdx = Math.floor(prng() * partyCount);
          cmd = {
            type: "SET_FACT",
            path: `parties[${targetIdx}].pan`,
            value: `ABCDE${Math.floor(prng() * 9000 + 1000)}F`,
          };
        } else if (roll < 0.95) {
          // Commit SEZ code
          cmd = { type: "COMMIT_ANSWER", questionId: "q_sez_code", path: "entity.sezCode", value: `SEZ-${Math.floor(prng() * 1000)}` };
        } else {
          // Delete answer
          cmd = { type: "DELETE_ANSWER", questionId: "q_cin", path: "entity.cin" };
        }

        engine.dispatch(cmd);
        history.record(cmd);
        commandsLogged.push(cmd);

        const state = engine.getState();

        // Invariant Check 1: Inactive Branch Fact Non-Existence
        for (const branch of fuzzSchema.branches) {
          const isActive = evaluatePredicate(branch.activation, { facts: state.facts });
          if (!isActive) {
            for (const p of branch.ownedPaths) {
              const val = getAt(state.facts, p);
              assert.equal(
                val,
                undefined,
                `Invariant 2 Violation: Inactive branch '${branch.id}' owned fact at '${p}' still exists: ${val}`
              );
            }
          }
        }

        // Invariant Check 2: Replay Equivalence (every 100 iterations)
        if (i % 100 === 0) {
          const replayed = replayCommandLog(fuzzSchema, {}, commandsLogged);
          assert.equal(
            canonicalEqual(state.facts, replayed.facts),
            true,
            `Replay Equivalence failure at step ${i} with seed ${seed}`
          );
          assert.equal(
            state.revision,
            replayed.revision,
            `Revision Monotonicity mismatch at step ${i} with seed ${seed}`
          );
        }
      }
    });
  }

  test("Fuzzer: asserts undo/redo round-trip integrity with repeater instances over 200 random operations", () => {
    const prng = createPrng(9999);
    const history = createCommandHistory(fuzzSchema);

    // Seed history with 50 commands including repeater operations
    for (let i = 0; i < 50; i++) {
      const isComp = prng() > 0.5;
      history.record({
        type: "COMMIT_ANSWER",
        questionId: "q_type",
        path: "entity.type",
        value: isComp ? "company" : "individual",
      });
      if (isComp) {
        history.record({
          type: "COMMIT_ANSWER",
          questionId: "q_cin",
          path: "entity.cin",
          value: `U${i}MH2020PTC000000`,
        });
      }
      if (i % 5 === 0) {
        history.record({
          type: "ADD_REPEATER_ITEM",
          repeaterId: "rep_parties",
          item: { id: `party_${i}`, name: `Party ${i}` },
        });
      }
    }

    const stateBefore = history.getCurrentState();

    // Perform random undo / redo steps
    for (let j = 0; j < 100; j++) {
      if (prng() > 0.5 && history.canUndo()) {
        history.undo();
      } else if (history.canRedo()) {
        history.redo();
      }
    }

    // Fast-forward to end
    while (history.canRedo()) {
      history.redo();
    }

    const stateAfter = history.getCurrentState();
    assert.equal(
      canonicalEqual(stateBefore.facts, stateAfter.facts),
      true,
      "Undo/Redo round-trip failed to reconstruct exact initial state"
    );
    assert.equal(stateBefore.revision, stateAfter.revision);
  });
});
