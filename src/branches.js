/**
 * @file branches.js
 * @description Branch ownership tracking and fixed-point cascading atomic invalidation planner for Theta.
 */

import { evaluatePredicate } from "./predicates.js";
import { getAt, deleteAt } from "./path.js";

/**
 * @typedef {import('./contracts.js').BranchDefinition} BranchDefinition
 * @typedef {import('./contracts.js').IntakeSchema} IntakeSchema
 * @typedef {import('./scope.js').ScopeStack} ScopeStack
 */

/**
 * Checks if a path or value exists in the facts object.
 * @param {Record<string, unknown>} facts
 * @param {string} path
 * @param {ScopeStack} [scopeStack]
 * @returns {boolean}
 */
export function hasFact(facts, path, scopeStack) {
  return getAt(facts, path, scopeStack) !== undefined;
}

/**
 * Calculates which paths should be purged when transitioning from oldFacts to newFacts.
 * Implements fixed-point iterative evaluation to correctly handle cascading branch invalidations
 * (e.g., deactivating Branch A purges facts that cause Branch B to deactivate).
 * Evaluates branches in topological order when available for fast, deterministic convergence.
 *
 * Invariant: inactive branch => none of its owned facts exist in state.
 *
 * @param {IntakeSchema} schema
 * @param {Record<string, unknown>} oldFacts
 * @param {Record<string, unknown>} newFacts
 * @param {string[]} [explicitInvalidations]
 * @param {ScopeStack} [scopeStack]
 * @returns {string[]} Paths to delete
 */
export function planInvalidations(schema, oldFacts, newFacts, explicitInvalidations = [], scopeStack) {
  const allInvalidated = new Set(explicitInvalidations);

  const branches = schema.branches || [];
  if (!Array.isArray(branches) || branches.length === 0) {
    return Array.from(allInvalidated);
  }

  let workingFacts = applyInvalidations(newFacts, Array.from(allInvalidated), scopeStack);

  // If topologicalOrder is compiled on schema or schema.dag, order branch evaluation topologically
  const topologicalOrder = schema.dag?.topologicalOrder || schema.topologicalOrder || null;
  const branchMap = new Map(branches.map((b) => [b.id, b]));

  const evaluationList = topologicalOrder
    ? topologicalOrder.map((id) => branchMap.get(id)).filter(Boolean)
    : branches;

  let changed = true;
  let iterations = 0;
  const maxIterations = evaluationList.length + 2;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const branch of evaluationList) {
      if (!branch.activation || !branch.ownedPaths || !branch.ownedPaths.length) continue;

      const wasActiveInOld = evaluatePredicate(branch.activation, { facts: oldFacts, scope: scopeStack });
      const hasFactsInWorking = branch.ownedPaths.some((p) => hasFact(workingFacts, p, scopeStack));

      // If branch was previously active OR currently has facts in state
      if (wasActiveInOld || hasFactsInWorking) {
        const isActiveNow = evaluatePredicate(branch.activation, { facts: workingFacts, scope: scopeStack });

        // Branch is now inactive: purge all owned paths!
        if (!isActiveNow) {
          for (const ownedPath of branch.ownedPaths) {
            if (!allInvalidated.has(ownedPath)) {
              allInvalidated.add(ownedPath);
              changed = true;
            }
          }
        }
      }
    }

    if (changed) {
      workingFacts = applyInvalidations(newFacts, Array.from(allInvalidated), scopeStack);
    }
  }

  return Array.from(allInvalidated);
}

/**
 * Immutably removes all invalidated paths from the facts object.
 * @param {Record<string, unknown>} facts
 * @param {string[]} invalidationPaths
 * @param {ScopeStack} [scopeStack]
 * @returns {Record<string, unknown>}
 */
export function applyInvalidations(facts, invalidationPaths, scopeStack) {
  if (!invalidationPaths || !invalidationPaths.length) return facts;

  let current = facts;
  for (const path of invalidationPaths) {
    current = deleteAt(current, path, scopeStack);
  }

  return current;
}
