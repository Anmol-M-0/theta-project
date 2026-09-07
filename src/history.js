/**
 * @file history.js
 * @description Deterministic transaction command log, replay engine, and time-travel manager for Theta.
 */

import { commitFactTransaction, deleteFactTransaction } from "./transaction.js";
import { addRepeaterItem, removeRepeaterItem, ScopeStack } from "./scope.js";
import { compileSchema } from "./schema.js";

/**
 * @typedef {import('./contracts.js').IntakeSchema} IntakeSchema
 * @typedef {import('./contracts.js').IntakeState} IntakeState
 */

/**
 * Executes a pure replay of a sequence of commands starting from initialFacts.
 * Asserts deterministic equivalence: Replay(Schema, S_0, commands) === S_final.
 * Fails fast on malformed historical commands.
 *
 * @param {IntakeSchema} schema
 * @param {Record<string, unknown>} initialFacts
 * @param {Array<Object>} commands
 * @returns {IntakeState}
 */
export function replayCommandLog(schema, initialFacts = {}, commands = []) {
  const compiled = schema.raw ? schema : compileSchema(schema);
  let state = {
    facts: structuredClone(initialFacts),
    revision: 1,
  };
  const scopeStack = new ScopeStack();

  for (let idx = 0; idx < commands.length; idx++) {
    const cmd = commands[idx];
    const ctx = `Replay[Command ${idx}]`;

    if (!cmd || typeof cmd !== "object" || !cmd.type) {
      throw new Error(`${ctx}: Invalid or missing command type in history log`);
    }

    switch (cmd.type) {
      case "COMMIT_ANSWER": {
        const { questionId, value } = cmd;
        let targetPath = cmd.path;

        if (!targetPath && questionId) {
          const [baseQId] = questionId.includes("@") ? questionId.split("@") : [questionId];
          const qDef = compiled.questionsById.get(baseQId);
          if (qDef) {
            targetPath = qDef.path;
          }
        }

        if (!targetPath) {
          throw new Error(`${ctx}: COMMIT_ANSWER missing target path or valid questionId ('${questionId}')`);
        }

        const res = commitFactTransaction(
          compiled,
          state,
          targetPath,
          value,
          cmd.explicitInvalidates || [],
          scopeStack
        );
        state = res.state;
        break;
      }

      case "DELETE_ANSWER": {
        const { questionId } = cmd;
        let targetPath = cmd.path;

        if (!targetPath && questionId) {
          const [baseQId] = questionId.includes("@") ? questionId.split("@") : [questionId];
          const qDef = compiled.questionsById.get(baseQId);
          if (qDef) targetPath = qDef.path;
        }

        if (!targetPath) {
          throw new Error(`${ctx}: DELETE_ANSWER missing target path or valid questionId ('${questionId}')`);
        }

        const res = deleteFactTransaction(compiled, state, targetPath, scopeStack);
        state = res.state;
        break;
      }

      case "SET_FACT": {
        const { path, value, explicitInvalidates } = cmd;
        if (!path || typeof path !== "string") {
          throw new Error(`${ctx}: SET_FACT missing required 'path'`);
        }
        const res = commitFactTransaction(
          compiled,
          state,
          path,
          value,
          explicitInvalidates || [],
          scopeStack
        );
        state = res.state;
        break;
      }

      case "DELETE_FACT": {
        const { path } = cmd;
        if (!path || typeof path !== "string") {
          throw new Error(`${ctx}: DELETE_FACT missing required 'path'`);
        }
        const res = deleteFactTransaction(compiled, state, path, scopeStack);
        state = res.state;
        break;
      }

      case "ADD_REPEATER_ITEM": {
        const { repeaterId, item } = cmd;
        const repeater = compiled.repeatersById.get(repeaterId);
        if (!repeater) {
          throw new Error(`${ctx}: ADD_REPEATER_ITEM references unknown repeaterId '${repeaterId}'`);
        }
        const updatedFacts = addRepeaterItem(state.facts, repeater, item, scopeStack);
        state = {
          facts: updatedFacts,
          revision: state.revision + 1,
        };
        break;
      }

      case "REMOVE_REPEATER_ITEM": {
        const { repeaterId, index } = cmd;
        const repeater = compiled.repeatersById.get(repeaterId);
        if (!repeater) {
          throw new Error(`${ctx}: REMOVE_REPEATER_ITEM references unknown repeaterId '${repeaterId}'`);
        }
        const updatedFacts = removeRepeaterItem(state.facts, repeater, index, scopeStack);
        state = {
          facts: updatedFacts,
          revision: state.revision + 1,
        };
        break;
      }

      default:
        throw new Error(`${ctx}: Unknown command type '${cmd.type}'`);
    }
  }

  return state;
}

/**
 * Creates a command history manager with time-travel (undo/redo) via deterministic replay.
 * @param {IntakeSchema} schema
 * @param {Record<string, unknown>} [initialFacts]
 */
export function createCommandHistory(schema, initialFacts = {}) {
  const seedFacts = structuredClone(initialFacts);
  let log = [];
  let cursor = 0;

  /**
   * Records a command into history, dropping any orphaned redo history.
   * @param {Object} command
   */
  function record(command) {
    if (!command || !command.type) {
      throw new Error("Cannot record malformed command without type");
    }
    if (cursor < log.length) {
      log = log.slice(0, cursor);
    }
    log.push(structuredClone(command));
    cursor = log.length;
  }

  /**
   * Replays up to the current cursor position.
   * @returns {IntakeState}
   */
  function getCurrentState() {
    return replayCommandLog(schema, seedFacts, log.slice(0, cursor));
  }

  /**
   * Undoes the last command and returns the resulting state.
   * @returns {IntakeState | null}
   */
  function undo() {
    if (cursor === 0) return null;
    cursor--;
    return getCurrentState();
  }

  /**
   * Redoes the next command and returns the resulting state.
   * @returns {IntakeState | null}
   */
  function redo() {
    if (cursor >= log.length) return null;
    cursor++;
    return getCurrentState();
  }

  return {
    record,
    undo,
    redo,
    canUndo: () => cursor > 0,
    canRedo: () => cursor < log.length,
    getCurrentState,
    getLog: () => structuredClone(log),
    getCursor: () => cursor,
    jumpTo: (targetIndex) => {
      const idx = Math.max(0, Math.min(targetIndex, log.length));
      cursor = idx;
      return getCurrentState();
    },
  };
}
