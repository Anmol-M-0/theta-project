/**
 * @file canonical.js
 * @description Canonical state normalization, deterministic key ordering, and structural equality for Theta Engine.
 */

/**
 * Recursively normalizes an arbitrary value (object, array, primitive) into a canonical representation
 * with sorted object keys and immutable copies.
 * @param {unknown} value
 * @returns {unknown}
 */
export function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number") {
      if (Number.isNaN(value)) return null;
      if (Object.is(value, -0)) return 0;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  // Value is a plain object
  const sortedKeys = Object.keys(value).sort();
  const result = {};
  for (const key of sortedKeys) {
    const val = value[key];
    if (val !== undefined && typeof val !== "function" && typeof val !== "symbol") {
      result[key] = canonicalize(val);
    }
  }

  return result;
}

/**
 * Returns a deterministic JSON string representing the canonical form of a value.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

/**
 * Performs deep structural equality checking between two values using canonical serialization.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function canonicalEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  return canonicalJson(a) === canonicalJson(b);
}
