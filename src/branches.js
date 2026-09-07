/**
 * @file branches.js
 * @description Branch ownership tracking and atomic invalidation planner for Theta.
 */

import { evaluatePredicate } from "./predicates.js";
import { deleteAt } from "./path.js";

/**
 * @typedef {import('./contracts.js').BranchDefinition} BranchDefinition
 * @typedef {import('./contracts.js').IntakeSchema} IntakeSchema
 * @typedef {import('./scope.js').ScopeStack} ScopeStack
 */

/**
 * Calculates which paths should be purged when transitioning from oldFacts to newFacts.
 * Checks both schema branch activations and question-level explicit invalidates.
 * @param {IntakeSchema} schema
 * @param {Record<string, unknown>} oldFacts
 * @param {Record<string, unknown>} newFacts
 * @param {string[]} [explicitInvalidations]
 * @param {ScopeStack} [scopeStack]
 * @returns {string[]} Paths to delete
 */
export function planInvalidations(schema, oldFacts, newFacts, explicitInvalidations = [], scopeStack) {
  const pathsToClear = new Set(explicitInvalidations);

  if (!schema.branches || !Array.isArray(schema.branches)) {
    return Array.from(pathsToClear);
  }

  for (const branch of schema.branches) {
    if (!branch.activation) continue;

    const wasActive = evaluatePredicate(branch.activation, { facts: oldFacts, scope: scopeStack });
    const isActive = evaluatePredicate(branch.activation, { facts: newFacts, scope: scopeStack });

    // Branch transitioned from active to inactive: purge all owned paths!
    if (wasActive && !isActive) {
      for (const ownedPath of branch.ownedPaths) {
        pathsToClear.add(ownedPath);
      }
    }
  }

  return Array.from(pathsToClear);
}

/**
 * Immutably removes all invalidated paths from the facts object.
 * @param {Record<string, unknown>} facts
 * @param {string[]} invalidationPaths
 * @param {ScopeStack} [scopeStack]
 * @returns {Record<string, unknown>}
 */
export function applyInvalidations(facts, invalidationPaths, scopeStack) {
  if (!invalidationPaths.length) return facts;

  let current = facts;
  for (const path of invalidationPaths) {
    current = deleteAt(current, path, scopeStack);
  }

  return current;
}
