/**
 * @file transaction.js
 * @description Atomic state transaction runner for Theta.
 */

import { setAt, deleteAt } from "./path.js";
import { planInvalidations, applyInvalidations } from "./branches.js";

/**
 * @typedef {import('./contracts.js').IntakeState} IntakeState
 * @typedef {import('./contracts.js').IntakeSchema} IntakeSchema
 * @typedef {import('./scope.js').ScopeStack} ScopeStack
 */

/**
 * Executes an atomic mutation on the intake state:
 * Sets fact -> Calculates & applies cascading branch invalidations -> Increments revision.
 * @param {IntakeSchema} schema
 * @param {IntakeState} currentState
 * @param {string} path
 * @param {unknown} value
 * @param {string[]} [explicitInvalidates]
 * @param {ScopeStack} [scopeStack]
 * @returns {{ state: IntakeState, changedPaths: string[], invalidatedPaths: string[] }}
 */
export function commitFactTransaction(
  schema,
  currentState,
  path,
  value,
  explicitInvalidates = [],
  scopeStack
) {
  const oldFacts = currentState.facts;
  const mutatedFacts = setAt(oldFacts, path, value, scopeStack);

  const invalidatedPaths = planInvalidations(
    schema,
    oldFacts,
    mutatedFacts,
    explicitInvalidates,
    scopeStack
  );

  const finalFacts = applyInvalidations(mutatedFacts, invalidatedPaths, scopeStack);
  const changedPaths = Array.from(new Set([path, ...invalidatedPaths]));

  return {
    state: {
      facts: finalFacts,
      revision: (currentState.revision || 0) + 1,
    },
    changedPaths,
    invalidatedPaths,
  };
}

/**
 * Executes an atomic delete mutation on the intake state.
 * @param {IntakeSchema} schema
 * @param {IntakeState} currentState
 * @param {string} path
 * @param {ScopeStack} [scopeStack]
 * @returns {{ state: IntakeState, changedPaths: string[], invalidatedPaths: string[] }}
 */
export function deleteFactTransaction(schema, currentState, path, scopeStack) {
  const oldFacts = currentState.facts;
  const mutatedFacts = deleteAt(oldFacts, path, scopeStack);

  const invalidatedPaths = planInvalidations(
    schema,
    oldFacts,
    mutatedFacts,
    [path],
    scopeStack
  );

  const finalFacts = applyInvalidations(mutatedFacts, invalidatedPaths, scopeStack);
  const changedPaths = Array.from(new Set([path, ...invalidatedPaths]));

  return {
    state: {
      facts: finalFacts,
      revision: (currentState.revision || 0) + 1,
    },
    changedPaths,
    invalidatedPaths,
  };
}
