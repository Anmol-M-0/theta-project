/**
 * @file engine.js
 * @description Main Theta Intake Engine factory and state orchestrator.
 */

import { ScopeStack, addRepeaterItem, removeRepeaterItem } from "./scope.js";
import { commitFactTransaction, deleteFactTransaction } from "./transaction.js";
import {
  resolveActiveQuestion,
  buildQuestionProjectionById,
  buildReviewTree,
} from "./projections.js";
import { MemoryStorageAdapter } from "./storage.js";

/**
 * @typedef {import('./contracts.js').IntakeSchema} IntakeSchema
 * @typedef {import('./contracts.js').IntakeState} IntakeState
 * @typedef {import('./contracts.js').QuestionProjection} QuestionProjection
 * @typedef {import('./contracts.js').ReviewTree} ReviewTree
 * @typedef {import('./contracts.js').ScopeFrame} ScopeFrame
 * @typedef {import('./storage.js').StorageAdapter} StorageAdapter
 */

/**
 * Creates an instance of the Theta Engine.
 * @param {Object} config
 * @param {IntakeSchema} config.schema
 * @param {Record<string, unknown>} [config.initialFacts]
 * @param {StorageAdapter} [config.storage]
 */
export function createThetaEngine(config) {
  if (!config || !config.schema) {
    throw new Error("createThetaEngine requires a valid 'schema'");
  }

  const schema = config.schema;
  const storage = config.storage || new MemoryStorageAdapter();

  /** @type {IntakeState} */
  let state = {
    facts: config.initialFacts ? structuredClone(config.initialFacts) : {},
    revision: 1,
  };

  /** @type {ScopeStack} */
  let scopeStack = new ScopeStack();

  /** @type {string | null} */
  let activeCursorId = null;

  /** @type {string | null} */
  let returnTo = null;

  /** @type {Set<(state: IntakeState, event?: string) => void>} */
  const listeners = new Set();

  function notify(event = "change") {
    for (const listener of listeners) {
      try {
        listener(getState(), event);
      } catch (err) {
        console.error("[Theta Engine] Listener error:", err);
      }
    }
  }

  function persistAsync() {
    storage.save(state).catch((err) => {
      console.warn("[Theta Engine] Storage save error:", err);
    });
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
      case "SET_FACT": {
        const { path, value, explicitInvalidates } = command;
        const res = commitFactTransaction(
          schema,
          state,
          path,
          value,
          explicitInvalidates || [],
          scopeStack
        );
        state = res.state;
        persistAsync();
        notify("set_fact");
        return { ok: true, state: getState(), changedPaths: res.changedPaths };
      }

      case "DELETE_FACT": {
        const { path } = command;
        const res = deleteFactTransaction(schema, state, path, scopeStack);
        state = res.state;
        persistAsync();
        notify("delete_fact");
        return { ok: true, state: getState(), changedPaths: res.changedPaths };
      }

      case "ADD_REPEATER_ITEM": {
        const { repeaterId, item } = command;
        const repeater = schema.repeaters?.find((r) => r.id === repeaterId);
        if (!repeater) {
          throw new Error(`Repeater '${repeaterId}' not found in schema`);
        }
        const updatedFacts = addRepeaterItem(state.facts, repeater, item, scopeStack);
        state = {
          facts: updatedFacts,
          revision: state.revision + 1,
        };
        persistAsync();
        notify("add_repeater_item");
        return { ok: true, state: getState() };
      }

      case "REMOVE_REPEATER_ITEM": {
        const { repeaterId, index } = command;
        const repeater = schema.repeaters?.find((r) => r.id === repeaterId);
        if (!repeater) {
          throw new Error(`Repeater '${repeaterId}' not found in schema`);
        }
        const updatedFacts = removeRepeaterItem(state.facts, repeater, index, scopeStack);
        state = {
          facts: updatedFacts,
          revision: state.revision + 1,
        };
        persistAsync();
        notify("remove_repeater_item");
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
   * @param {(state: IntakeState, event?: string) => void} listener
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
  };
}
