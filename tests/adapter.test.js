import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createIntakeEngine } from "../src/engine.js";
import { createStoreAdapter } from "../src/adapter.js";

describe("Theta Universal Store & Selective Subscription Adapter Subsystem", () => {
  const schema = {
    id: "adapter_test_schema",
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
            ],
          },
          {
            id: "q_cin",
            sectionId: "sec1",
            branch: "b_comp",
            path: "entity.cin",
            kind: "cin",
            label: "CIN",
            visibleWhen: { equals: { path: "entity.type", value: "company" } },
          },
          {
            id: "q_unrelated",
            sectionId: "sec1",
            path: "property.address",
            kind: "text",
            label: "Address",
          },
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

  test("Selective question subscriptions only invoke callbacks when target question is dirty", () => {
    const engine = createIntakeEngine(schema);
    const adapter = createStoreAdapter(engine);

    let cinNotificationCount = 0;
    let unrelatedNotificationCount = 0;

    const unsubCin = adapter.subscribeToQuestion("q_cin", () => {
      cinNotificationCount++;
    });

    const unsubUnrelated = adapter.subscribeToQuestion("q_unrelated", () => {
      unrelatedNotificationCount++;
    });

    // 1. Commit entity.type = company (makes q_cin dirty)
    engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "q_type",
      path: "entity.type",
      value: "company",
    });

    assert.equal(cinNotificationCount, 1);
    assert.equal(unrelatedNotificationCount, 0, "Unrelated question listener must not be invoked");

    // 2. Commit property.address (unrelated to q_cin)
    engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "q_unrelated",
      path: "property.address",
      value: "123 High St",
    });

    assert.equal(cinNotificationCount, 1, "q_cin must not be notified on unrelated property.address mutation");
    assert.equal(unrelatedNotificationCount, 0); // q_unrelated is a static question, its visibility did not change

    // 3. Test clean unsubscription and memory release
    unsubCin();
    unsubUnrelated();
    assert.equal(adapter._internal.getQuestionListenerCount(), 0);

    engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "q_type",
      path: "entity.type",
      value: "individual",
    });

    assert.equal(cinNotificationCount, 1, "Callback must never fire after unsubscribe");
  });

  test("Selective path subscriptions fire only on overlapping mutations", () => {
    const engine = createIntakeEngine(schema);
    const adapter = createStoreAdapter(engine);

    let entityPathCount = 0;
    const unsub = adapter.subscribeToPath("entity.*", () => {
      entityPathCount++;
    });

    engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "q_type",
      path: "entity.type",
      value: "company",
    });
    assert.equal(entityPathCount, 1);

    engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "q_unrelated",
      path: "property.address",
      value: "Pune",
    });
    assert.equal(entityPathCount, 1); // Not an entity.* path

    unsub();
    assert.equal(adapter._internal.getPathListenerCount(), 0);
  });

  test("Synthetic React and Svelte store contracts work seamlessly", () => {
    const engine = createIntakeEngine(schema);
    const adapter = createStoreAdapter(engine);

    // React useSyncExternalStore contract
    const reactStore = adapter.toReactStore();
    assert.equal(typeof reactStore.subscribe, "function");
    assert.equal(typeof reactStore.getSnapshot, "function");
    assert.deepEqual(reactStore.getSnapshot().facts, {});

    // Svelte readable store contract
    const svelteStore = adapter.toSvelteStore();
    let svelteReceived = null;
    const unsubSvelte = svelteStore.subscribe((state) => {
      svelteReceived = state;
    });

    assert.deepEqual(svelteReceived.facts, {});

    engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: "q_unrelated",
      path: "property.address",
      value: "Mumbai",
    });

    assert.equal(svelteReceived.facts.property.address, "Mumbai");
    unsubSvelte();
  });

  test("observe selector triggers callback only when derived value changes", () => {
    const engine = createIntakeEngine(schema);
    const adapter = createStoreAdapter(engine);

    let observedValues = [];
    adapter.observe((state) => state.facts.entity?.type, (val) => observedValues.push(val));

    engine.dispatch({ type: "COMMIT_ANSWER", questionId: "q_unrelated", path: "property.address", value: "Goa" });
    assert.equal(observedValues.length, 0); // type didn't change

    engine.dispatch({ type: "COMMIT_ANSWER", questionId: "q_type", path: "entity.type", value: "company" });
    assert.deepEqual(observedValues, ["company"]);
  });

  test("destroy() is terminal and prevents subsequent subscriptions or snapshot reads", () => {
    const engine = createIntakeEngine(schema);
    const adapter = createStoreAdapter(engine);

    let callCount = 0;
    adapter.subscribe(() => {
      callCount++;
    });

    engine.dispatch({ type: "COMMIT_ANSWER", questionId: "q_unrelated", path: "property.address", value: "Delhi" });
    assert.equal(callCount, 1);

    adapter.destroy();
    assert.equal(adapter.isDestroyed(), true);
    assert.equal(adapter._internal.getGlobalListenerCount(), 0);

    // Engine mutation after destroy does not invoke old listeners
    engine.dispatch({ type: "COMMIT_ANSWER", questionId: "q_unrelated", path: "property.address", value: "Bengaluru" });
    assert.equal(callCount, 1);

    // All interactions on destroyed adapter throw immediately
    assert.throws(() => adapter.subscribe(() => {}), /Cannot interact with a destroyed StoreAdapter/);
    assert.throws(() => adapter.subscribeToQuestion("q_type", () => {}), /Cannot interact with a destroyed StoreAdapter/);
    assert.throws(() => adapter.subscribeToPath("entity.*", () => {}), /Cannot interact with a destroyed StoreAdapter/);
    assert.throws(() => adapter.observe((s) => s.facts, () => {}), /Cannot interact with a destroyed StoreAdapter/);
    assert.throws(() => adapter.toReactStore(), /Cannot interact with a destroyed StoreAdapter/);
    assert.throws(() => adapter.toSvelteStore(), /Cannot interact with a destroyed StoreAdapter/);
    assert.throws(() => adapter.getStoreSnapshot(), /Cannot interact with a destroyed StoreAdapter/);
  });
});
