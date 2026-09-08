import { useCallback, useSyncExternalStore } from "react";
import { useThetaContext } from "./context.js";

/**
 * Reactively subscribes to the engine's active question.
 * Re-renders only when the active question ID, scope, or completion state changes.
 *
 * @returns {import("../../schema.js").QuestionInstance | null}
 */
export function useActiveQuestion() {
  const { adapter, engine } = useThetaContext();

  const getSnapshot = useCallback(() => {
    return engine.getActiveQuestion();
  }, [engine]);

  return useSyncExternalStore(
    adapter.subscribe,
    getSnapshot,
    getSnapshot
  );
}

/**
 * Returns whether the intake flow is fully completed (no remaining eligible unanswered questions).
 *
 * @returns {boolean}
 */
export function useIsIntakeComplete() {
  const active = useActiveQuestion();
  return active === null;
}
