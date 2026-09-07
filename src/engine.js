/**
 * @file engine.js
 * @description Core deterministic intake runtime engine for Theta.
 */

import { compileSchema } from "./schema.js";
import { commitFactTransaction, deleteFactTransaction } from "./transaction.js";
import { resolveActiveQuestion, buildQuestionProjectionById, buildReviewTree } from "./projections.js";
import { ScopeStack } from "./scope.js";
import { addRepeaterItem, removeRepeaterItem } from "./scope.js";
import { getAffectedQuestions } from "./dag.js";

/**
 * @typedef {import('./contracts.js').IntakeEngine} IntakeEngine
 * @typedef {import('./contracts.js').IntakeSchema} IntakeSchema
 * @typedef {import('./contracts.js').IntakeState} IntakeState
 * @typedef {import('./contracts.js').StorageAdapter} StorageAdapter
 * @typedef {import('./contracts.js').EngineOptions} EngineOptions
 * @typedef {import('./contracts.js').QuestionProjection} QuestionProjection
 * @typedef {import('./contracts.js').ReviewTree} ReviewTree
 * @typedef {import('./contracts.js').ScopeFrame} ScopeFrame
 */

/**
 * Creates and initializes a Theta intake engine instance.
 * Accepts either:
 *   createIntakeEngine(schema, initialState, options)
 *   createIntakeEngine({ schema, storage, initialState, initialFacts })
 *
 * @param {IntakeSchema | { schema: IntakeSchema, storage?: StorageAdapter, initialState?: IntakeState, initialFacts?: Record<string, unknown> }} schemaOrConfig
 * @param {IntakeState} [initialState]
 * @param {EngineOptions} [options]
 * @returns {IntakeEngine}
 */
export function createIntakeEngine(schemaOrConfig, initialState, options = {}) {
  let rawSchema;
  let initState = initialState;
  let opts = options;

  if (schemaOrConfig && typeof schemaOrConfig === "object" && schemaOrConfig.schema) {
    rawSchema = schemaOrConfig.schema;
    if (schemaOrConfig.initialFacts && !initState) {
      initState = { facts: schemaOrConfig.initialFacts, revision: 1 };
    } else if (schemaOrConfig.initialState && !initState) {
      initState = schemaOrConfig.initialState;
    }
    if (schemaOrConfig.storage && !opts.storage) {
      opts = { ...opts, storage: schemaOrConfig.storage };
    }
  } else {
    rawSchema = schemaOrConfig;
  }

  const compiled = compileSchema(rawSchema);
  const schema = compiled.raw;
  const storage = opts.storage || {
    load: async () => null,
    save: async () => {},
  };

  /** @type {IntakeState} */
  let state = initState
    ? {
        facts: structuredClone(initState.facts || {}),
        revision: initState.revision || 1,
      }
    : { facts: {}, revision: 1 };

  /** @type {ScopeStack} */
  let scopeStack = new ScopeStack();

  /** @type {string | null} */
  let activeCursorId = null;

  /** @type {string | null} */
  let returnTo = null;

  /** @type {Set<(state: IntakeState, eventPayload?: any) => void>} */
  const listeners = new Set();

  /** @type {Promise<void>} Persistence serialization queue */
  let persistenceQueue = Promise.resolve();

  /**
   * Enqueues an asynchronous persistence task to ensure strict write ordering.
   */
  function persistAsync() {
    const snapshot = getState();
    persistenceQueue = persistenceQueue
      .then(() => storage.save(snapshot))
      .catch((err) => {
        console.error("Theta Engine persistence error:", err);
      });
  }

  /**
   * Flushes all pending storage persistence writes.
   * @returns {Promise<void>}
   */
  async function flush() {
    await persistenceQueue;
  }

  /**
   * Emits state update event to all subscribers with structured change metadata.
   * @param {string} eventType
   * @param {Object} [meta]
   */
  function notify(eventType, meta = {}) {
    const dirtyQuestions = meta.dirtyQuestions || (meta.changedPaths ? Array.from(getAffectedQuestions(compiled.dag, meta.changedPaths)) : []);
    const eventPayload = {
      type: eventType,
      state: getState(),
      revision: state.revision,
      changedPaths: meta.changedPaths || [],
      invalidatedPaths: meta.invalidatedPaths || [],
      dirtyQuestions,
    };

    for (const listener of listeners) {
      try {
        listener(eventPayload.state, eventPayload);
      } catch (err) {
        console.error("Theta Engine listener error:", err);
      }
    }
  }

  /**
   * Returns a copy of the canonical intake state.
   * @returns {IntakeState}
   */
  function getState() {
    return structuredClone(state);
  }

  /**
   * Returns current revision.
   * @returns {number}
   */
  function getRevision() {
    return state.revision;
  }

  /**
   * Returns active ScopeStack.
   * @returns {ScopeStack}
   */
  function getScope() {
    return scopeStack;
  }

  /**
   * Pushes a frame onto the scope stack.
   * @param {ScopeFrame} frame
   */
  function pushScope(frame) {
    scopeStack = scopeStack.push(frame);
    notify("scope");
  }

  /**
   * Pops the topmost frame from the scope stack.
   */
  function popScope() {
    scopeStack = scopeStack.pop();
    notify("scope");
  }

  /**
   * Directly sets the scope stack.
   * @param {ScopeStack} newScope
   */
  function setScope(newScope) {
    scopeStack = newScope;
    notify("scope");
  }

  /**
   * Dispatches an intake command through the transaction layer.
   * @param {Object} command
   */
  function dispatch(command) {
    if (!command || !command.type) {
      throw new Error(`Invalid command dispatched: ${JSON.stringify(command)}`);
    }

    switch (command.type) {
      case "COMMIT_ANSWER": {
        const { questionId, value } = command;
        const [baseQId] = questionId && questionId.includes("@") ? questionId.split("@") : [questionId];

        let targetPath = command.path;
        let qDef = baseQId ? compiled.questionsById.get(baseQId) : null;

        if (!targetPath && qDef) {
          targetPath = qDef.path;
        }

        if (!targetPath) {
          throw new Error(`Cannot commit answer: questionId "${questionId}" or path must be specified`);
        }

        // Question-Level Semantic Validation (Invariant 6)
        if (qDef && typeof qDef.validate === "function") {
          const validationResult = qDef.validate(value, getState());
          if (validationResult !== true) {
            const errorMessage = typeof validationResult === "string" ? validationResult : "Validation failed";
            return {
              ok: false,
              error: errorMessage,
              state: getState(),
            };
          }
        }

        const res = commitFactTransaction(
          compiled,
          state,
          targetPath,
          value,
          command.explicitInvalidates || qDef?.invalidates || [],
          scopeStack
        );
        state = res.state;

        if (activeCursorId === questionId || activeCursorId === baseQId) {
          activeCursorId = null;
          returnTo = null;
        }

        persistAsync();
        notify("commit_answer", { changedPaths: res.changedPaths, invalidatedPaths: res.invalidatedPaths });
        return { ok: true, state: getState(), changedPaths: res.changedPaths };
      }

      case "JUMP_TO_QUESTION": {
        activeCursorId = command.questionId;
        returnTo = command.returnTo || "review";
        if (command.scopeStack instanceof ScopeStack) {
          scopeStack = command.scopeStack;
        }
        notify("cursor");
        return { ok: true };
      }

      case "DELETE_ANSWER": {
        const { questionId } = command;
        const [baseQId] = questionId && questionId.includes("@") ? questionId.split("@") : [questionId];
        let targetPath = command.path;
        const qDef = baseQId ? compiled.questionsById.get(baseQId) : null;

        if (!targetPath && qDef) {
          targetPath = qDef.path;
        }
        if (!targetPath) {
          throw new Error(`Cannot delete answer: questionId "${questionId}" or path must be specified`);
        }

        const res = deleteFactTransaction(compiled, state, targetPath, scopeStack);
        state = res.state;
        persistAsync();
        notify("delete_answer", { changedPaths: res.changedPaths, invalidatedPaths: res.invalidatedPaths });
        return { ok: true, state: getState(), changedPaths: res.changedPaths };
      }

      case "SET_FACT": {
        const { path, value, explicitInvalidates } = command;
        const res = commitFactTransaction(
          compiled,
          state,
          path,
          value,
          explicitInvalidates || [],
          scopeStack
        );
        state = res.state;
        persistAsync();
        notify("set_fact", { changedPaths: res.changedPaths, invalidatedPaths: res.invalidatedPaths });
        return { ok: true, state: getState(), changedPaths: res.changedPaths };
      }

      case "DELETE_FACT": {
        const { path } = command;
        const res = deleteFactTransaction(compiled, state, path, scopeStack);
        state = res.state;
        persistAsync();
        notify("delete_fact", { changedPaths: res.changedPaths, invalidatedPaths: res.invalidatedPaths });
        return { ok: true, state: getState(), changedPaths: res.changedPaths };
      }

      case "ADD_REPEATER_ITEM": {
        const { repeaterId, item } = command;
        const repeater = compiled.repeatersById.get(repeaterId) || schema.repeaters?.find((r) => r.id === repeaterId);
        if (!repeater) {
          throw new Error(`Repeater '${repeaterId}' not found in schema`);
        }
        const updatedFacts = addRepeaterItem(state.facts, repeater, item, scopeStack);
        state = {
          facts: updatedFacts,
          revision: state.revision + 1,
        };
        persistAsync();
        notify("add_repeater_item", { changedPaths: [repeater.collectionPath] });
        return { ok: true, state: getState() };
      }

      case "REMOVE_REPEATER_ITEM": {
        const { repeaterId, index } = command;
        const repeater = compiled.repeatersById.get(repeaterId) || schema.repeaters?.find((r) => r.id === repeaterId);
        if (!repeater) {
          throw new Error(`Repeater '${repeaterId}' not found in schema`);
        }
        const updatedFacts = removeRepeaterItem(state.facts, repeater, index, scopeStack);
        state = {
          facts: updatedFacts,
          revision: state.revision + 1,
        };
        persistAsync();
        notify("remove_repeater_item", { changedPaths: [repeater.collectionPath] });
        return { ok: true, state: getState() };
      }

      case "SET_CURSOR": {
        activeCursorId = command.questionId;
        returnTo = command.returnTo || null;
        if (command.scopeStack instanceof ScopeStack) {
          scopeStack = command.scopeStack;
        }
        notify("cursor");
        return { ok: true };
      }

      case "CLEAR_CURSOR": {
        activeCursorId = null;
        returnTo = null;
        notify("cursor");
        return { ok: true };
      }

      default:
        throw new Error(`Unknown command type '${command.type}'`);
    }
  }

  /**
   * Returns the single question projection currently active.
   * @returns {QuestionProjection | null}
   */
  function getActiveQuestion() {
    if (activeCursorId) {
      const target = buildQuestionProjectionById(schema, state.facts, activeCursorId, scopeStack);
      if (target) return target;
    }
    return resolveActiveQuestion(schema, state.facts, scopeStack);
  }

  /**
   * Returns the current return context if any (e.g. 'review').
   * @returns {string | null}
   */
  function getReturnTo() {
    return returnTo;
  }

  /**
   * Returns the full Master Review Tree projection.
   * @returns {ReviewTree}
   */
  function getReviewTree() {
    return buildReviewTree(schema, state.facts, scopeStack);
  }

  /**
   * Subscribes to engine state changes.
   * @param {(state: IntakeState, eventPayload?: any) => void} listener
   * @returns {() => void} Unsubscribe function
   */
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /**
   * Initializes engine by loading persisted state from storage.
   * @returns {Promise<void>}
   */
  async function init() {
    const loaded = await storage.load();
    if (loaded && loaded.facts) {
      state = {
        facts: loaded.facts,
        revision: loaded.revision || 1,
      };
      notify("init");
    }
  }

  return {
    getState,
    getRevision,
    getScope,
    setScope,
    pushScope,
    popScope,
    dispatch,
    getActiveQuestion,
    getReturnTo,
    getReviewTree,
    subscribe,
    init,
    flush,
  };
}

// Export createThetaEngine alias for backward compatibility
export { createIntakeEngine as createThetaEngine };
