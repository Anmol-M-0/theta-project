import { useCallback, useSyncExternalStore } from "react";
import { useThetaContext } from "./context.js";

/**
 * Subscribes to the master review tree.
 * Re-renders when eligible questions or stats update.
 *
 * @returns {import("../../projections.js").ReviewTree}
 */
export function useReviewTree() {
  const { adapter, engine } = useThetaContext();

  const getSnapshot = useCallback(() => {
    return engine.getReviewTree();
  }, [engine]);

  return useSyncExternalStore(adapter.subscribe, getSnapshot, getSnapshot);
}

/**
 * Subscribes to intake progress statistics.
 *
 * @returns {{ totalEligible: number, completed: number, remaining: number, percentComplete: number }}
 */
export function useIntakeProgress() {
  const { adapter, engine } = useThetaContext();

  const getSnapshot = useCallback(() => {
    return engine.getReviewTree().stats;
  }, [engine]);

  return useSyncExternalStore(adapter.subscribe, getSnapshot, getSnapshot);
}
