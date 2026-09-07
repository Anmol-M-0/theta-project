/**
 * @file scope.js
 * @description Immutable ScopeStack and dynamic collection repeater management for Theta.
 */

import { getAt, setAt, deleteAt } from "./path.js";

/**
 * @typedef {import('./contracts.js').ScopeFrame} ScopeFrame
 * @typedef {import('./contracts.js').RepeaterDefinition} RepeaterDefinition
 */

/**
 * Immutable Stack representing active nested scopes (e.g. party -> director).
 */
export class ScopeStack {
  /**
   * @param {ScopeFrame[]} [frames]
   */
  constructor(frames = []) {
    /** @type {readonly ScopeFrame[]} */
    this.frames = Object.freeze([...frames]);
  }

  /**
   * Pushes a new frame and returns a new ScopeStack instance.
   * @param {ScopeFrame} frame
   * @returns {ScopeStack}
   */
  push(frame) {
    if (!frame || typeof frame.name !== "string" || typeof frame.index !== "number") {
      throw new Error(`Invalid ScopeFrame: ${JSON.stringify(frame)}`);
    }
    return new ScopeStack([...this.frames, frame]);
  }

  /**
   * Pops the topmost frame and returns a new ScopeStack instance.
   * @returns {ScopeStack}
   */
  pop() {
    if (this.frames.length === 0) return this;
    return new ScopeStack(this.frames.slice(0, -1));
  }

  /**
   * Returns the topmost frame.
   * @returns {ScopeFrame | undefined}
   */
  current() {
    return this.frames[this.frames.length - 1];
  }

  /**
   * Finds the nearest frame matching scopeName (from top to bottom).
   * @param {string} name
   * @returns {ScopeFrame | undefined}
   */
  get(name) {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      if (this.frames[i].name === name) {
        return this.frames[i];
      }
    }
    return undefined;
  }

  /**
   * Returns true if stack is empty.
   * @returns {boolean}
   */
  isEmpty() {
    return this.frames.length === 0;
  }

  /**
   * Returns the array representation.
   * @returns {ScopeFrame[]}
   */
  toArray() {
    return [...this.frames];
  }

  /**
   * Recreates a ScopeStack from a plain array.
   * @param {ScopeFrame[]} [arr]
   * @returns {ScopeStack}
   */
  static fromArray(arr) {
    return new ScopeStack(Array.isArray(arr) ? arr : []);
  }
}

/**
 * Appends a new item to a repeater collection immutably.
 * @param {Record<string, unknown>} facts
 * @param {RepeaterDefinition} repeater
 * @param {Record<string, unknown>} [item]
 * @param {ScopeStack} [scopeStack]
 * @returns {Record<string, unknown>}
 */
export function addRepeaterItem(facts, repeater, item, scopeStack) {
  const currentItems = getAt(facts, repeater.collectionPath, scopeStack);
  const arr = Array.isArray(currentItems) ? [...currentItems] : [];

  if (repeater.maxItems && arr.length >= repeater.maxItems) {
    throw new Error(`Repeater '${repeater.id}' reached maximum capacity of ${repeater.maxItems} items`);
  }

  const newItem = item ?? (repeater.createItem ? repeater.createItem() : {});
  arr.push(newItem);

  return setAt(facts, repeater.collectionPath, arr, scopeStack);
}

/**
 * Removes an item from a repeater collection immutably.
 * @param {Record<string, unknown>} facts
 * @param {RepeaterDefinition} repeater
 * @param {number} index
 * @param {ScopeStack} [scopeStack]
 * @returns {Record<string, unknown>}
 */
export function removeRepeaterItem(facts, repeater, index, scopeStack) {
  const currentItems = getAt(facts, repeater.collectionPath, scopeStack);
  if (!Array.isArray(currentItems)) return facts;

  if (repeater.minItems && currentItems.length <= repeater.minItems) {
    throw new Error(`Repeater '${repeater.id}' requires a minimum of ${repeater.minItems} items`);
  }

  if (index < 0 || index >= currentItems.length) {
    throw new Error(`Index ${index} out of bounds for repeater '${repeater.id}' (length: ${currentItems.length})`);
  }

  const copy = [...currentItems];
  copy.splice(index, 1);

  return setAt(facts, repeater.collectionPath, copy, scopeStack);
}
