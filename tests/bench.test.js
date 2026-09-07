import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createIntakeEngine } from "../src/engine.js";
import { createStoreAdapter } from "../src/adapter.js";
import { replayCommandLog } from "../src/history.js";
import { commitFactTransaction } from "../src/transaction.js";
import { compileSchema } from "../src/schema.js";

describe("Theta Engine v0.5 Stress Invariants & Performance Certification", () => {
  const schema = {
    id: "bench_schema",
    version: 1,
    sections: [
      {
        id: "sec1",
        title: "Section 1",
        questions: [
          { id: "q_type", sectionId: "sec1", path: "entity.type", kind: "select", label: "Type", options: [{ label: "Company", value: "company" }, { label: "Individual", value: "individual" }] },
          { id: "q_cin", sectionId: "sec1", branch: "b_comp", path: "entity.cin", kind: "cin", label: "CIN", visibleWhen: { equals: { path: "entity.type", value: "company" } } },
          { id: "q_desc", sectionId: "sec1", path: "entity.desc", kind: "text", label: "Desc" },
        ],
      },
    ],
    branches: [
      { id: "b_comp", activation: { equals: { path: "entity.type", value: "company" } }, ownedPaths: ["entity.cin"] },
    ],
  };

  test("Invariant I3 & I12: At-most-once notification & Cross-Instance Isolation", () => {
    const engine1 = createIntakeEngine(schema);
    const engine2 = createIntakeEngine(schema);
    const adapter1 = createStoreAdapter(engine1);
    const adapter2 = createStoreAdapter(engine2);

    let notify1 = 0;
    let notify2 = 0;

    adapter1.subscribeToQuestion("q_cin", () => notify1++);
    adapter2.subscribeToQuestion("q_cin", () => notify2++);

    // Mutate engine 1
    engine1.dispatch({ type: "COMMIT_ANSWER", questionId: "q_type", path: "entity.type", value: "company" });

    assert.equal(notify1, 1, "Invariant I3: Callback must receive exactly 1 notification per transaction");
    assert.equal(notify2, 0, "Invariant I12: Instance 2 must not be affected by Instance 1 mutations");
  });

  test("Invariant I6: Lifecycle & Unsubscribe Zero-Retention under 10,000 cycles", () => {
    const engine = createIntakeEngine(schema);
    const adapter = createStoreAdapter(engine);

    for (let i = 0; i < 10000; i++) {
      const unsubQ = adapter.subscribeToQuestion("q_cin", () => {});
      const unsubP = adapter.subscribeToPath("entity.*", () => {});
      unsubQ();
      unsubP();
    }

    assert.equal(adapter._internal.getQuestionListenerCount(), 0, "Question listener count must be 0 after unsubscriptions");
    assert.equal(adapter._internal.getPathListenerCount(), 0, "Path listener count must be 0 after unsubscriptions");
  });

  test("Benchmark: Transaction dispatch throughput (> 15,000 dispatches/sec)", () => {
    const engine = createIntakeEngine(schema);
    const start = performance.now();
    const ITERATIONS = 10000;

    for (let i = 0; i < ITERATIONS; i++) {
      engine.dispatch({
        type: "COMMIT_ANSWER",
        questionId: "q_desc",
        path: "entity.desc",
        value: `val_${i}`,
      });
    }

    const elapsedMs = performance.now() - start;
    const opsPerSec = Math.round((ITERATIONS / elapsedMs) * 1000);

    assert.equal(engine.getState().facts.entity.desc, `val_${ITERATIONS - 1}`);
    assert.equal(opsPerSec > 15000, true, `Throughput was ${opsPerSec} ops/sec (expected > 15,000)`);
  });

  test("Benchmark: Pure transaction core throughput (> 50,000 ops/sec)", () => {
    const compiled = compileSchema(schema);
    let state = { facts: {}, revision: 1 };
    const start = performance.now();
    const ITERATIONS = 20000;

    for (let i = 0; i < ITERATIONS; i++) {
      const res = commitFactTransaction(compiled, state, "entity.desc", `val_${i}`);
      state = res.state;
    }

    const elapsedMs = performance.now() - start;
    const opsPerSec = Math.round((ITERATIONS / elapsedMs) * 1000);

    assert.equal(state.facts.entity.desc, `val_${ITERATIONS - 1}`);
    assert.equal(opsPerSec > 50000, true, `Pure transaction throughput was ${opsPerSec} ops/sec (expected > 50,000)`);
  });

  test("Benchmark: Command replay throughput (> 50,000 commands/sec)", () => {
    const commands = [];
    for (let i = 0; i < 10000; i++) {
      commands.push({
        type: "SET_FACT",
        path: "entity.desc",
        value: `desc_${i}`,
      });
    }

    const start = performance.now();
    const finalState = replayCommandLog(schema, {}, commands);
    const elapsedMs = performance.now() - start;
    const opsPerSec = Math.round((commands.length / elapsedMs) * 1000);

    assert.equal(finalState.facts.entity.desc, "desc_9999");
    assert.equal(opsPerSec > 50000, true, `Replay throughput was ${opsPerSec} ops/sec (expected > 50,000)`);
  });
});
