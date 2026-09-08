import { useCallback, useSyncExternalStore } from "react";
import { useThetaContext } from "./context.js";

/**
 * Subscribes to a specific question's state.
 * Leverages Theta's DAG to only trigger component re-renders when this specific
 * question's value, eligibility, or validation changes.
 *
 * @param {string} questionId - Schema question identifier
 * @returns {any} Current projection of the question or null
 */
export function useQuestionState(questionId) {
  const { adapter, engine } = useThetaContext();

  const subscribe = useCallback(
    (onStoreChange) => adapter.subscribeToQuestion(questionId, onStoreChange),
    [adapter, questionId]
  );

  const getSnapshot = useCallback(() => {
    return engine.getQuestionProjectionById(questionId);
  }, [engine, questionId]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Returns the committed canonical fact value for a specific question.
 * Re-renders only when this question's value changes.
 *
 * @param {string} questionId
 * @returns {any} Current value or undefined
 */
export function useQuestionValue(questionId) {
  const projection = useQuestionState(questionId);
  return projection ? projection.value : undefined;
}

/**
 * Subscribes to a specific canonical fact path.
 * Re-renders only when that path (or a parent path) is modified or invalidated.
 *
 * @param {string} path - Canonical dot/bracket path (e.g. "property.type")
 * @returns {any} Value at path
 */
export function useFactPath(path) {
  const { adapter, engine } = useThetaContext();

  const subscribe = useCallback(
    (onStoreChange) => adapter.subscribeToPath(path, onStoreChange),
    [adapter, path]
  );

  const getSnapshot = useCallback(() => {
    return engine.getFact(path);
  }, [engine, path]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
