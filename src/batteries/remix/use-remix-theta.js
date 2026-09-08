import { useMemo, useEffect, useState } from "react";
import { createIntakeEngine } from "../../engine.js";
import { createStoreAdapter } from "../../adapter.js";

/**
 * Client-side React hook that bridges Remix loader/action data with a reactive
 * Theta Engine instance. Seamlessly hydrates on the client and reacts to Remix navigation.
 *
 * @param {Object} options
 * @param {{
 *   schema: import("../../schema.js").Schema,
 *   state: { facts: Record<string, any>, revision: number },
 *   activeQuestion: any,
 *   stats: any,
 *   reviewTree: any
 * }} options.loaderData - Payload returned from thetaLoader
 * @param {any} [options.actionData] - Optional payload returned from thetaAction
 * @returns {{
 *   engine: import("../../engine.js").IntakeEngine,
 *   adapter: import("../../adapter.js").StoreAdapter,
 *   activeQuestion: any,
 *   stats: any,
 *   reviewTree: any,
 *   actionError: string | null
 * }}
 */
export function useRemixTheta(options) {
  const { loaderData, actionData } = options;

  if (!loaderData || !loaderData.schema) {
    throw new Error("[useRemixTheta] Valid 'loaderData' with schema is required.");
  }

  // Create or update client-side engine with hydrated facts from loader
  const { engine, adapter } = useMemo(() => {
    const initialFacts = loaderData.state?.facts || {};
    const eng = createIntakeEngine({
      schema: loaderData.schema,
      initialFacts,
    });
    const adapt = createStoreAdapter(eng);
    return { engine: eng, adapter: adapt };
  }, [loaderData.schema, loaderData.state?.revision]);

  // Clean up adapter subscriptions on unmount
  useEffect(() => {
    return () => {
      if (adapter && !adapter.isDestroyed()) {
        adapter.destroy();
      }
    };
  }, [adapter]);

  // Track reactive active question and stats
  const [activeQuestion, setActiveQuestion] = useState(() => engine.getActiveQuestion());
  const [stats, setStats] = useState(() => engine.getReviewTree().stats);
  const [reviewTree, setReviewTree] = useState(() => engine.getReviewTree());

  useEffect(() => {
    const unsubscribe = adapter.subscribe(() => {
      setActiveQuestion(engine.getActiveQuestion());
      const rt = engine.getReviewTree();
      setReviewTree(rt);
      setStats(rt.stats);
    });
    return unsubscribe;
  }, [adapter, engine]);

  const actionError = actionData && !actionData.ok ? actionData.error : null;

  return {
    engine,
    adapter,
    activeQuestion,
    stats,
    reviewTree,
    actionError,
  };
}
