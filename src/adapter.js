/**
 * @file adapter.js
 * @description Universal store and selective subscription framework adapter for Theta Engine.
 */

import { pathsOverlap } from "./dag.js";

/**
 * @typedef {import('./contracts.js').IntakeEngine} IntakeEngine
 * @typedef {import('./contracts.js').IntakeState} IntakeState
 */

/**
 * @callback Unsubscribe
 * @returns {void}
 */

/**
 * Creates a universal reactive store adapter wrapping an IntakeEngine instance.
 * Provides selective question-level and path-level subscriptions without framework dependencies.
 *
 * @param {IntakeEngine} engine
 */
export function createStoreAdapter(engine) {
  if (!engine || typeof engine.subscribe !== "function") {
    throw new Error("createStoreAdapter requires a valid IntakeEngine instance");
  }

  let isDestroyed = false;

  /** @type {Set<() => void>} Global store listeners */
  const globalListeners = new Set();

  /** @type {Map<string, Set<(state: IntakeState, event: any) => void>>} QuestionId -> Set of callbacks */
  const questionListeners = new Map();

  /** @type {Map<string, Set<(state: IntakeState, event: any) => void>>} PathPattern -> Set of callbacks */
  const pathListeners = new Map();

  /**
   * Internal dispatcher subscribed to engine events.
   */
  const unsubscribeEngine = engine.subscribe((state, event) => {
    if (isDestroyed) return;

    // 1. Notify global listeners (at-most-once per transaction)
    for (const listener of globalListeners) {
      try {
        listener();
      } catch (err) {
        console.error("Theta StoreAdapter global listener error:", err);
      }
    }

    if (!event) return;

    const notifiedCallbacks = new Set();

    // 2. Selective Question Subscriptions (O(dirtyQuestions) complexity)
    if (Array.isArray(event.dirtyQuestions)) {
      for (const qId of event.dirtyQuestions) {
        const callbacks = questionListeners.get(qId);
        if (callbacks) {
          for (const cb of callbacks) {
            if (!notifiedCallbacks.has(cb)) {
              notifiedCallbacks.add(cb);
              try {
                cb(state, event);
              } catch (err) {
                console.error("Theta StoreAdapter question listener error:", err);
              }
            }
          }
        }
      }
    }

    // 3. Selective Path Subscriptions
    const allTouchedPaths = [...(event.changedPaths || []), ...(event.invalidatedPaths || [])];
    if (allTouchedPaths.length > 0 && pathListeners.size > 0) {
      for (const [pattern, callbacks] of pathListeners.entries()) {
        const isTouched = allTouchedPaths.some((p) => pathsOverlap(p, pattern));
        if (isTouched) {
          for (const cb of callbacks) {
            if (!notifiedCallbacks.has(cb)) {
              notifiedCallbacks.add(cb);
              try {
                cb(state, event);
              } catch (err) {
                console.error("Theta StoreAdapter path listener error:", err);
              }
            }
          }
        }
      }
    }
  });

  /**
   * Asserts that the adapter is still alive.
   */
  function assertActive() {
    if (isDestroyed) {
      throw new Error("Cannot interact with a destroyed StoreAdapter");
    }
  }

  /**
   * Returns current immutable engine state snapshot (useSyncExternalStore compatible).
   * @returns {IntakeState}
   */
  function getStoreSnapshot() {
    assertActive();
    return engine.getState();
  }

  /**
   * Subscribes a global callback to all engine state transitions.
   * @param {() => void} callback
   * @returns {Unsubscribe}
   */
  function subscribe(callback) {
    assertActive();
    if (typeof callback !== "function") throw new Error("Subscription callback must be a function");
    globalListeners.add(callback);
    return () => {
      globalListeners.delete(callback);
    };
  }

  /**
   * Selectively subscribes to updates for a specific question ID.
   * Callback only fires when `dirtyQuestions` contains the target question.
   *
   * @param {string} questionId
   * @param {(state: IntakeState, event: any) => void} callback
   * @returns {Unsubscribe}
   */
  function subscribeToQuestion(questionId, callback) {
    assertActive();
    if (typeof callback !== "function") throw new Error("Subscription callback must be a function");
    if (!questionId || typeof questionId !== "string") throw new Error("questionId must be a non-empty string");

    if (!questionListeners.has(questionId)) {
      questionListeners.set(questionId, new Set());
    }
    const bucket = questionListeners.get(questionId);
    bucket.add(callback);

    return () => {
      bucket.delete(callback);
      if (bucket.size === 0) {
        questionListeners.delete(questionId);
      }
    };
  }

  /**
   * Selectively subscribes to fact mutations matching a path pattern.
   *
   * @param {string} pathPattern
   * @param {(state: IntakeState, event: any) => void} callback
   * @returns {Unsubscribe}
   */
  function subscribeToPath(pathPattern, callback) {
    assertActive();
    if (typeof callback !== "function") throw new Error("Subscription callback must be a function");
    if (!pathPattern || typeof pathPattern !== "string") throw new Error("pathPattern must be a non-empty string");

    if (!pathListeners.has(pathPattern)) {
      pathListeners.set(pathPattern, new Set());
    }
    const bucket = pathListeners.get(pathPattern);
    bucket.add(callback);

    return () => {
      bucket.delete(callback);
      if (bucket.size === 0) {
        pathListeners.delete(pathPattern);
      }
    };
  }

  /**
   * Observes a derived selector against engine state.
   * @template T
   * @param {(state: IntakeState) => T} selector
   * @param {(value: T, prevValue: T) => void} callback
   * @param {(a: T, b: T) => boolean} [equalityFn]
   * @returns {Unsubscribe}
   */
  function observe(selector, callback, equalityFn = (a, b) => a === b) {
    assertActive();
    let currentVal = selector(engine.getState());
    return subscribe(() => {
      const nextVal = selector(engine.getState());
      if (!equalityFn(currentVal, nextVal)) {
        const prev = currentVal;
        currentVal = nextVal;
        callback(nextVal, prev);
      }
    });
  }

  /**
   * Returns a React 18+ useSyncExternalStore compatible contract.
   */
  function toReactStore() {
    assertActive();
    return {
      subscribe,
      getSnapshot: getStoreSnapshot,
    };
  }

  /**
   * Returns a Svelte-compatible readable store contract.
   */
  function toSvelteStore() {
    assertActive();
    return {
      subscribe: (run) => {
        run(getStoreSnapshot());
        return subscribe(() => {
          run(getStoreSnapshot());
        });
      },
    };
  }

  /**
   * Destroys adapter internal subscriptions and disables future registrations.
   */
  function destroy() {
    if (isDestroyed) return;
    isDestroyed = true;
    unsubscribeEngine();
    globalListeners.clear();
    questionListeners.clear();
    pathListeners.clear();
  }

  return {
    engine,
    getStoreSnapshot,
    subscribe,
    subscribeToQuestion,
    subscribeToPath,
    observe,
    toReactStore,
    toSvelteStore,
    destroy,
    isDestroyed: () => isDestroyed,
    _internal: {
      getGlobalListenerCount: () => globalListeners.size,
      getQuestionListenerCount: () => questionListeners.size,
      getPathListenerCount: () => pathListeners.size,
    },
  };
}
