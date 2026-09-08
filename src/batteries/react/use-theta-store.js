import { useSyncExternalStore, useCallback, useRef } from "react";
import { useThetaContext } from "./context.js";

/**
 * Subscribes a React component to the Theta Engine state via React 18 useSyncExternalStore.
 * Supports optional selector mapping with referential memoization.
 *
 * @template T
 * @param {(state: any) => T} [selector] - State selector function (defaults to identity)
 * @returns {T}
 */
export function useThetaStore(selector) {
  const { adapter } = useThetaContext();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const getSnapshot = useCallback(() => {
    const raw = adapter.getStoreSnapshot();
    return selectorRef.current ? selectorRef.current(raw) : raw;
  }, [adapter]);

  return useSyncExternalStore(
    adapter.subscribe,
    getSnapshot,
    getSnapshot
  );
}
