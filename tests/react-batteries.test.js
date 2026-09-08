import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { createThetaEngine } from "../src/index.js";
import { createStoreAdapter } from "../src/adapter.js";
import {
  ThetaProvider,
  useThetaStore,
  useActiveQuestion,
  useIsIntakeComplete,
  useQuestionState,
  useQuestionValue,
  useFactPath,
  useReviewTree,
  useIntakeProgress,
  useThetaDispatch,
} from "../src/batteries/react/index.js";

describe("Theta React Batteries Subsystem", () => {
  const schema = {
    id: "react_battery_test_schema",
    version: 1,
    sections: [
      {
        id: "sec_entity",
        title: "Entity Classification",
        questions: [
          {
            id: "entity_type",
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
            id: "pan_number",
            sectionId: "sec_entity",
            path: "entity.pan",
            kind: "text",
            label: "PAN",
          },
          {
            id: "cin_number",
            sectionId: "sec_entity",
            path: "entity.company.cin",
            kind: "text",
            label: "CIN",
            visibleWhen: { equals: { path: "entity.type", value: "company" } },
          },
        ],
      },
    ],
    branches: [
      {
        id: "company_branch",
        activation: { equals: { path: "entity.type", value: "company" } },
        ownedPaths: ["entity.company"],
      },
    ],
  };

  test("ThetaProvider initializes cleanly and provides engine and adapter", () => {
    const engine = createThetaEngine({ schema });
    const adapter = createStoreAdapter(engine);

    assert.throws(
      () => ThetaProvider({ engine: null, children: null }),
      /\[ThetaProvider\] 'engine' prop is required/
    );

    const element = React.createElement(ThetaProvider, { engine, adapter }, "child");
    assert.ok(React.isValidElement(element));
  });

  test("Selective question subscriptions isolate re-render triggers across DAG", () => {
    const engine = createThetaEngine({ schema });
    const adapter = createStoreAdapter(engine);

    let cinNotified = 0;
    let panNotified = 0;

    adapter.subscribeToQuestion("cin_number", () => {
      cinNotified++;
    });

    adapter.subscribeToQuestion("pan_number", () => {
      panNotified++;
    });

    // 1. Commit answer to entity_type
    engine.dispatch({ type: "COMMIT_ANSWER", questionId: "entity_type", value: "company" });

    // Conditional question cin_number became eligible, so it was marked dirty
    assert.equal(cinNotified, 1);
    // pan_number was already eligible, so it was NOT marked dirty
    assert.equal(panNotified, 0);

    // 2. Switch entity_type to individual
    engine.dispatch({ type: "COMMIT_ANSWER", questionId: "entity_type", value: "individual" });

    // cin_number became ineligible, so it was marked dirty again
    assert.equal(cinNotified, 2);
    assert.equal(panNotified, 0);
  });

  test("Granular fact path subscription tracks only affected branches", () => {
    const engine = createThetaEngine({ schema });
    const adapter = createStoreAdapter(engine);

    let companyPathNotified = 0;
    let typePathNotified = 0;

    adapter.subscribeToPath("entity.company", () => {
      companyPathNotified++;
    });

    adapter.subscribeToPath("entity.type", () => {
      typePathNotified++;
    });

    // Answering entity_type mutates entity.type
    engine.dispatch({ type: "COMMIT_ANSWER", questionId: "entity_type", value: "company" });
    assert.equal(typePathNotified, 1);
    assert.equal(companyPathNotified, 0);

    // Answering cin mutates entity.company.cin
    engine.dispatch({ type: "COMMIT_ANSWER", questionId: "cin_number", value: "U12345DL2020PTC000000" });
    assert.equal(typePathNotified, 1);
    assert.equal(companyPathNotified, 1);

    // Switching entity_type to individual triggers atomic branch invalidation on entity.company!
    engine.dispatch({ type: "COMMIT_ANSWER", questionId: "entity_type", value: "individual" });
    assert.equal(typePathNotified, 2);
    // entity.company was pruned, so companyPath was notified of deletion!
    assert.equal(companyPathNotified, 2);
    assert.equal(engine.getState().facts.entity?.company, undefined);
  });

  test("Adapter teardown cleans all listeners cleanly without memory leaks", () => {
    const engine = createThetaEngine({ schema });
    const adapter = createStoreAdapter(engine);

    let count = 0;
    adapter.subscribe(() => count++);
    adapter.subscribeToQuestion("entity_type", () => count++);
    adapter.subscribeToPath("entity.type", () => count++);

    assert.equal(adapter._internal.getGlobalListenerCount(), 1);
    assert.equal(adapter._internal.getQuestionListenerCount(), 1);
    assert.equal(adapter._internal.getPathListenerCount(), 1);

    adapter.destroy();
    assert.equal(adapter.isDestroyed(), true);
    assert.equal(adapter._internal.getGlobalListenerCount(), 0);
    assert.equal(adapter._internal.getQuestionListenerCount(), 0);
    assert.equal(adapter._internal.getPathListenerCount(), 0);
  });
});
