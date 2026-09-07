/**
 * @file predicates.js
 * @description Pure, deterministic predicate rule engine for Theta.
 */

import { getAt } from "./path.js";

/**
 * Deep equality check for primitives, arrays, and plain objects.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

/**
 * Checks if a value is semantically present.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPresent(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Evaluates a predicate against the current state and active scope stack.
 * @param {import('./contracts.js').Predicate} predicate
 * @param {{ facts: Record<string, unknown>, scope?: import('./scope.js').ScopeStack }} context
 * @returns {boolean}
 */
export function evaluatePredicate(predicate, context) {
  if (!predicate || typeof predicate !== "object") return true;

  if ("all" in predicate && Array.isArray(predicate.all)) {
    return predicate.all.every((p) => evaluatePredicate(p, context));
  }

  if ("any" in predicate && Array.isArray(predicate.any)) {
    return predicate.any.some((p) => evaluatePredicate(p, context));
  }

  if ("not" in predicate && predicate.not) {
    return !evaluatePredicate(predicate.not, context);
  }

  if ("equals" in predicate && predicate.equals) {
    const actual = getAt(context.facts, predicate.equals.path, context.scope);
    return deepEqual(actual, predicate.equals.value);
  }

  if ("notEquals" in predicate && predicate.notEquals) {
    const actual = getAt(context.facts, predicate.notEquals.path, context.scope);
    return !deepEqual(actual, predicate.notEquals.value);
  }

  if ("in" in predicate && predicate.in) {
    const actual = getAt(context.facts, predicate.in.path, context.scope);
    return Array.isArray(predicate.in.values) && predicate.in.values.some((v) => deepEqual(v, actual));
  }

  if ("notIn" in predicate && predicate.notIn) {
    const actual = getAt(context.facts, predicate.notIn.path, context.scope);
    return Array.isArray(predicate.notIn.values) && !predicate.notIn.values.some((v) => deepEqual(v, actual));
  }

  if ("exists" in predicate && predicate.exists) {
    const actual = getAt(context.facts, predicate.exists.path, context.scope);
    return isPresent(actual);
  }

  return true;
}
