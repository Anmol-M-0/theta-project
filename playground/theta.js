/**
 * Theta Engine - Standalone Browser Bundle
 * Zero Runtime Dependencies • Pure ES Modules
 * (c) 2026 Anmol Maniyar • MIT License
 */

// ==========================================
// Module: contracts.js
// ==========================================
/**
 * @file contracts.js
 * @description Core types, schemas, and interface definitions for Theta.
 */

/**
 * @typedef {'text' | 'number' | 'boolean' | 'date' | 'select' | 'multiselect' | 'card' | 'address' | 'currency' | 'pan' | 'aadhaar' | 'cin' | 'repeater'} QuestionKind
 */

/**
 * @typedef {Object} OptionDefinition
 * @property {string | number | boolean} value
 * @property {string} label
 * @property {string} [description]
 * @property {string} [icon]
 */

/**
 * @typedef {Object} PredicateEquals
 * @property {string} path
 * @property {unknown} value
 */

/**
 * @typedef {Object} PredicateIn
 * @property {string} path
 * @property {unknown[]} values
 */

/**
 * @typedef {Object} PredicateExists
 * @property {string} path
 */

/**
 * @typedef {Object} Predicate
 * @property {PredicateEquals} [equals]
 * @property {PredicateEquals} [notEquals]
 * @property {PredicateIn} [in]
 * @property {PredicateIn} [notIn]
 * @property {PredicateExists} [exists]
 * @property {Predicate[]} [all]
 * @property {Predicate[]} [any]
 * @property {Predicate} [not]
 */

/**
 * @typedef {Object} IntakeState
 * @property {Record<string, unknown>} facts - The canonical document data tree
 * @property {number} revision - Monotonically increasing revision counter
 */

/**
 * @typedef {Object} QuestionDefinition
 * @property {string} id - Stable unique identifier
 * @property {string} sectionId - Top-level section identifier
 * @property {string} path - Target path in facts (supports $current / $scopeName)
 * @property {QuestionKind} kind - UI input kind
 * @property {string} label - The question prompt
 * @property {string} [description] - Contextual guidance
 * @property {OptionDefinition[]} [options] - Available options for choice kinds
 * @property {Predicate} [visibleWhen] - Visibility condition
 * @property {Predicate} [requiredWhen] - Requirement condition (defaults to true if omitted)
 * @property {string[]} [prerequisites] - Paths that must have values before this question is eligible
 * @property {string[]} [invalidates] - Paths cleared if this answer changes
 * @property {string} [branch] - Branch identifier this question belongs to
 * @property {string} [scope] - Scope name (if declared inside a repeater)
 * @property {(value: unknown, state: IntakeState) => true | string | boolean} [validate] - Custom validator function
 */

/**
 * @typedef {Object} SectionDefinition
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {QuestionDefinition[]} questions
 */

/**
 * @typedef {Object} BranchDefinition
 * @property {string} id
 * @property {Predicate} [activation]
 * @property {string[]} ownedPaths - Paths cleared when this branch becomes inactive
 */

/**
 * @typedef {Object} RepeaterDefinition
 * @property {string} id
 * @property {string} collectionPath - Path to the array in facts
 * @property {string} scopeName - Variable name bound in scope stack (e.g. 'seller')
 * @property {string} itemLabel - Singular item label
 * @property {number} [minItems]
 * @property {number} [maxItems]
 * @property {() => Record<string, unknown>} [createItem] - Factory for empty item
 * @property {QuestionDefinition[]} [questions] - Questions belonging to this repeater item
 */

/**
 * @typedef {Object} IntakeSchema
 * @property {string} id
 * @property {number} version
 * @property {SectionDefinition[]} sections
 * @property {BranchDefinition[]} [branches]
 * @property {RepeaterDefinition[]} [repeaters]
 */

/**
 * @typedef {Object} ScopeFrame
 * @property {string} name - Scope variable name (e.g. 'party', 'director')
 * @property {number} index - Active index in collection
 * @property {string} [id] - Stable entity id
 */

/**
 * @typedef {Object} FlowCursor
 * @property {string} questionId
 * @property {ScopeFrame[]} scopeStack
 * @property {string} [returnTo]
 */

/**
 * @typedef {Object} QuestionInstance
 * @property {string} id - Composite unique instance id (e.g. 'seller_name@seller_123' or 'prop_category')
 * @property {string} questionId - Base question definition id
 * @property {string} sectionId
 * @property {string} sectionTitle
 * @property {string} path - Fully resolved path in facts (e.g. 'sellers[0].name')
 * @property {QuestionKind} kind
 * @property {string} label
 * @property {string} [description]
 * @property {unknown} value
 * @property {unknown} [currentValue]
 * @property {OptionDefinition[]} [options]
 * @property {boolean} required
 * @property {boolean} isAnswered
 * @property {{ current: number, total: number }} progress
 * @property {ScopeFrame[]} scope
 * @property {QuestionDefinition} question
 */

/**
 * @typedef {QuestionInstance} QuestionProjection
 */

/**
 * @typedef {Object} ReviewNode
 * @property {string} id
 * @property {'section' | 'question' | 'repeater' | 'repeater-item'} kind
 * @property {string} label
 * @property {string} [title]
 * @property {string} [path]
 * @property {unknown} [value]
 * @property {'complete' | 'incomplete' | 'not-applicable'} status
 * @property {string} [questionId]
 * @property {ScopeFrame[]} [scope]
 * @property {boolean} [answered]
 * @property {boolean} [eligible]
 * @property {ReviewNode[]} [children]
 * @property {ReviewNode[]} [questions]
 * @property {number} [completedCount]
 * @property {number} [eligibleCount]
 */

/**
 * @typedef {Object} ReviewTree
 * @property {ReviewNode[]} sections
 * @property {{ total: number, complete: number, completed: number, totalEligible: number, blockers: number }} stats
 */


// ==========================================
// Module: path.js
// ==========================================
/**
 * @file path.js
 * @description Syntactic path tokenization, scope resolution, and immutable structural-copy accessors.
 */

/**
 * @typedef {Object} PathToken
 * @property {'key' | 'index' | 'scope'} type
 * @property {string | number} value
 */

/**
 * Parses a path string (e.g. "parties[0].directors.$current.name") into syntactic tokens.
 * @param {string} path
 * @returns {PathToken[]}
 */
export function tokenizePath(path) {
  if (!path || typeof path !== "string") return [];

  // Normalize bracket indices like [0] or [$current] into .0 or .$current
  const normalized = path.replace(/\[([^\]]+)\]/g, ".$1");
  const segments = normalized.split(".").filter(Boolean);

  return segments.map((seg) => {
    if (/^\d+$/.test(seg)) {
      return { type: "index", value: Number(seg) };
    }
    if (seg.startsWith("$")) {
      return { type: "scope", value: seg.slice(1) };
    }
    return { type: "key", value: seg };
  });
}

/**
 * Resolves scope tokens in an array of PathTokens using an active ScopeStack.
 * If a scope frame is not found in the stack, preserves the scope token to enable collection-wide matching.
 * @param {PathToken[]} tokens
 * @param {import('./scope.js').ScopeStack} [scopeStack]
 * @returns {PathToken[]}
 */
export function resolveTokens(tokens, scopeStack) {
  return tokens.map((token) => {
    if (token.type !== "scope") return token;

    if (!scopeStack) {
      return token;
    }

    const scopeName = String(token.value);
    const frame = scopeName === "current" ? scopeStack.current() : scopeStack.get(scopeName);

    if (!frame) {
      return token;
    }

    return { type: "index", value: frame.index };
  });
}

/**
 * Serializes PathTokens back to a canonical string path.
 * @param {PathToken[]} tokens
 * @returns {string}
 */
export function stringifyTokens(tokens) {
  return tokens
    .map((t, idx) => {
      if (t.type === "index") return `[${t.value}]`;
      if (t.type === "scope") return `[$${t.value}]`;
      return idx === 0 ? String(t.value) : `.${t.value}`;
    })
    .join("")
    .replace(/\.\[/g, "[");
}

/**
 * Resolves a path string against an active ScopeStack.
 * @param {string} path
 * @param {import('./scope.js').ScopeStack} [scopeStack]
 * @returns {string}
 */
export function resolvePath(path, scopeStack) {
  const tokens = tokenizePath(path);
  const resolved = resolveTokens(tokens, scopeStack);
  return stringifyTokens(resolved);
}

/**
 * Immutably reads a value from a target object using tokens or a path string.
 * Supports collection-wide wildcards for unscoped tokens.
 * @param {unknown} root
 * @param {string | PathToken[]} pathOrTokens
 * @param {import('./scope.js').ScopeStack} [scopeStack]
 * @returns {unknown}
 */
export function getAt(root, pathOrTokens, scopeStack) {
  if (root == null) return undefined;
  const rawTokens = Array.isArray(pathOrTokens) ? pathOrTokens : tokenizePath(pathOrTokens);
  const tokens = resolveTokens(rawTokens, scopeStack);

  function read(node, tokenIdx) {
    if (node == null) return undefined;
    if (tokenIdx >= tokens.length) return node;

    const token = tokens[tokenIdx];
    if (token.type === "key") {
      if (typeof node !== "object" || Array.isArray(node)) return undefined;
      return read(node[token.value], tokenIdx + 1);
    }
    if (token.type === "index") {
      if (!Array.isArray(node)) return undefined;
      return read(node[token.value], tokenIdx + 1);
    }
    if (token.type === "scope") {
      // Unresolved scope token: check if any item in the array has the child property
      if (!Array.isArray(node)) return undefined;
      for (const item of node) {
        const res = read(item, tokenIdx + 1);
        if (res !== undefined) return res;
      }
      return undefined;
    }
    return undefined;
  }

  return read(root, 0);
}

/**
 * Immutably writes a value into a root object using structural copy.
 * Leaves the original object untouched and returns a new root.
 * @param {unknown} root
 * @param {string | PathToken[]} pathOrTokens
 * @param {unknown} value
 * @param {import('./scope.js').ScopeStack} [scopeStack]
 * @returns {unknown}
 */
export function setAt(root, pathOrTokens, value, scopeStack) {
  const rawTokens = Array.isArray(pathOrTokens) ? pathOrTokens : tokenizePath(pathOrTokens);
  const tokens = resolveTokens(rawTokens, scopeStack);

  if (!tokens.length) return value;

  const unresolved = tokens.find((t) => t.type === "scope");
  if (unresolved) {
    throw new Error(
      `Cannot write to scoped path containing unresolved token '$${unresolved.value}' without an active ScopeStack`
    );
  }

  function update(node, tokenIdx) {
    if (tokenIdx >= tokens.length) return value;

    const token = tokens[tokenIdx];
    const isNextIndex = tokenIdx + 1 < tokens.length && tokens[tokenIdx + 1].type === "index";

    if (token.type === "index") {
      const arr = Array.isArray(node) ? [...node] : [];
      const idx = Number(token.value);
      arr[idx] = update(arr[idx], tokenIdx + 1);
      return arr;
    }

    // Key token
    const obj = node && typeof node === "object" && !Array.isArray(node) ? { ...node } : {};
    const key = String(token.value);
    const childNode = obj[key] ?? (isNextIndex ? [] : {});
    obj[key] = update(childNode, tokenIdx + 1);
    return obj;
  }

  return update(root, 0);
}

/**
 * Immutably deletes a path from a root object using structural copy.
 * Leaves the original object untouched and returns a new root.
 * Supports collection-wide wildcards for unscoped tokens.
 * @param {unknown} root
 * @param {string | PathToken[]} pathOrTokens
 * @param {import('./scope.js').ScopeStack} [scopeStack]
 * @returns {unknown}
 */
export function deleteAt(root, pathOrTokens, scopeStack) {
  if (root == null) return root;

  const rawTokens = Array.isArray(pathOrTokens) ? pathOrTokens : tokenizePath(pathOrTokens);
  const tokens = resolveTokens(rawTokens, scopeStack);

  if (!tokens.length) return undefined;

  function remove(node, tokenIdx) {
    if (node == null) return node;
    if (tokenIdx >= tokens.length) return node;

    const token = tokens[tokenIdx];
    const isLast = tokenIdx === tokens.length - 1;

    if (token.type === "index") {
      if (!Array.isArray(node)) return node;
      const idx = Number(token.value);
      if (idx < 0 || idx >= node.length) return node;

      if (isLast) {
        const copy = [...node];
        copy.splice(idx, 1);
        return copy;
      }

      const copy = [...node];
      copy[idx] = remove(copy[idx], tokenIdx + 1);
      return copy;
    }

    if (token.type === "scope") {
      // Unresolved scope token: apply deletion across all items in array
      if (!Array.isArray(node)) return node;
      return node.map((item) => remove(item, tokenIdx + 1));
    }

    // Key token
    if (typeof node !== "object" || Array.isArray(node)) return node;
    const key = String(token.value);
    if (!(key in node)) return node;

    if (isLast) {
      const copy = { ...node };
      delete copy[key];
      return copy;
    }

    const copy = { ...node };
    copy[key] = remove(copy[key], tokenIdx + 1);
    return copy;
  }

  return remove(root, 0);
}


// ==========================================
// Module: predicates.js
// ==========================================
/**
 * @file predicates.js
 * @description Pure, deterministic predicate rule engine for Theta.
 */


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


// ==========================================
// Module: scope.js
// ==========================================
/**
 * @file scope.js
 * @description Immutable ScopeStack and dynamic collection repeater management for Theta.
 */


/**
 * @typedef {import('./contracts.js').ScopeFrame} ScopeFrame
 * @typedef {import('./contracts.js').RepeaterDefinition} RepeaterDefinition
 */

/**
 * Generates a unique, URL-safe random identifier.
 * Zero-dependency, portable across Node.js, Bun, Deno, and modern browsers.
 * @param {string} [prefix]
 * @returns {string}
 */
export function generateId(prefix = "") {
  let rand = "";
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    rand = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  } else {
    rand = Math.random().toString(36).substring(2, 10);
  }
  return prefix ? `${prefix}_${rand}` : rand;
}

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
   * Preserves falsy IDs (e.g. 0) while ensuring every frame has a defined ID.
   * @param {ScopeFrame} frame
   * @returns {ScopeStack}
   */
  push(frame) {
    if (!frame || typeof frame.name !== "string" || typeof frame.index !== "number") {
      throw new Error(`Invalid ScopeFrame: ${JSON.stringify(frame)}`);
    }
    const frameId =
      frame.id != null && frame.id !== ""
        ? String(frame.id)
        : `${frame.name}_${frame.index}`;

    const frameWithId = {
      name: frame.name,
      index: frame.index,
      id: frameId,
    };
    return new ScopeStack([...this.frames, frameWithId]);
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
 * Stamping a stable unique identifier if missing (Invariant 3: id = identity, index = position).
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

  const rawItem = item ?? (repeater.createItem ? repeater.createItem() : {});
  const itemId =
    rawItem.id != null && rawItem.id !== ""
      ? rawItem.id
      : rawItem._id != null && rawItem._id !== ""
      ? rawItem._id
      : generateId(repeater.scopeName || "item");

  const newItem = {
    ...rawItem,
    id: itemId,
  };

  arr.push(newItem);

  return setAt(facts, repeater.collectionPath, arr, scopeStack);
}

/**
 * Removes an item from a repeater collection immutably.
 * Preserves the immutable item IDs of all surviving items.
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


// ==========================================
// Module: branches.js
// ==========================================
/**
 * @file branches.js
 * @description Branch ownership tracking and fixed-point cascading atomic invalidation planner for Theta.
 */



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


// ==========================================
// Module: dag.js
// ==========================================
/**
 * @file dag.js
 * @description Static dependency graph compiler, topological analyzer, and instance-isolated path matcher for Theta Engine.
 */



/**
 * @typedef {import('./contracts.js').IntakeSchema} IntakeSchema
 * @typedef {import('./schema.js').CompiledSchema} CompiledSchema
 */

/**
 * Normalizes a path string into a canonical pattern for dependency indexing.
 * Converts scope variables (e.g. 'parties[$party].name') and wildcards into '[*]',
 * while preserving concrete array indices (e.g. 'parties[0].name').
 * @param {string} path
 * @returns {string}
 */
export function normalizePathPattern(path) {
  if (!path || typeof path !== "string") return "";
  const tokens = tokenizePath(path);
  return tokens
    .map((t, idx) => {
      if (t.type === "scope" || t.value === "*" || t.value === "[*]") {
        return "[*]";
      }
      if (t.type === "index") {
        return `[${t.value}]`;
      }
      return idx === 0 ? String(t.value) : `.${t.value}`;
    })
    .join("")
    .replace(/\.\[/g, "[");
}

/**
 * Represents a normalized path token preserving concrete index/scope identity.
 * @typedef {Object} PathToken
 * @property {'property' | 'index' | 'scope' | 'wildcard'} type
 * @property {string | number} value
 */

/**
 * Extracts a typed token array from a path or pattern string.
 * Preserves concrete index (e.g. 0, 1) and scope ($party) while identifying wildcards (*).
 * @param {string} path
 * @returns {PathToken[]}
 */
export function getPathTokens(path) {
  if (!path || typeof path !== "string") return [];
  const tokens = tokenizePath(path);
  return tokens.map((t) => {
    if (t.value === "*" || t.value === "[*]") {
      return { type: "wildcard", value: "*" };
    }
    if (t.type === "index") {
      return { type: "index", value: Number(t.value) };
    }
    if (t.type === "scope") {
      return { type: "wildcard", value: "*" };
    }
    return { type: "property", value: String(t.value) };
  });
}

/**
 * Checks if a mutated/changed path overlaps with a registered dependency pattern,
 * with strict repeater instance isolation (e.g., parties[0] does NOT overlap parties[1]).
 *
 * Overlap occurs if and only if for all i < min(len(A), len(B)):
 *   A[i] === B[i] OR A[i] is wildcard OR B[i] is wildcard
 *
 * @param {string} changedPath
 * @param {string} dependencyPattern
 * @returns {boolean}
 */
export function pathsOverlap(changedPath, dependencyPattern) {
  if (!changedPath || !dependencyPattern) return false;
  if (changedPath === dependencyPattern) return true;

  const changedTokens = getPathTokens(changedPath);
  const patternTokens = getPathTokens(dependencyPattern);

  const minLen = Math.min(changedTokens.length, patternTokens.length);
  if (minLen === 0) return false;

  for (let i = 0; i < minLen; i++) {
    const c = changedTokens[i];
    const p = patternTokens[i];

    // Wildcards match any index/scope
    if (c.type === "wildcard" || p.type === "wildcard") {
      continue;
    }

    // Concrete tokens must match in both type and value
    if (c.type !== p.type || c.value !== p.value) {
      return false;
    }
  }

  return true;
}

/**
 * Performs topological sort on a directed graph using Kahn's algorithm.
 * @param {Map<string, Set<string>>} adjacencyMap
 * @returns {{ order: string[], hasCycle: boolean }}
 */
export function topologicalSort(adjacencyMap) {
  const inDegree = new Map();

  for (const node of adjacencyMap.keys()) {
    inDegree.set(node, 0);
  }

  for (const [, targets] of adjacencyMap.entries()) {
    for (const tgt of targets) {
      inDegree.set(tgt, (inDegree.get(tgt) || 0) + 1);
    }
  }

  const zeroQueue = [];
  for (const [node, deg] of inDegree.entries()) {
    if (deg === 0) zeroQueue.push(node);
  }

  const order = [];
  while (zeroQueue.length > 0) {
    const current = zeroQueue.shift();
    order.push(current);

    const neighbors = adjacencyMap.get(current) || new Set();
    for (const neighbor of neighbors) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        zeroQueue.push(neighbor);
      }
    }
  }

  const hasCycle = order.length !== adjacencyMap.size;
  return { order, hasCycle };
}

/**
 * @typedef {Object} DependencyDAG
 * @property {Map<string, Set<string>>} pathToBranches - Normalized path pattern -> Set of Branch IDs depending on it
 * @property {Map<string, Set<string>>} pathToQuestions - Normalized path pattern -> Set of Question IDs depending on it
 * @property {Map<string, Set<string>>} branchToQuestions - Branch ID -> Set of Question IDs declared under this branch
 * @property {Map<string, Set<string>>} branchToOwnedPaths - Branch ID -> Set of normalized owned paths
 * @property {Map<string, Set<string>>} branchGraph - Branch ID -> Set of downstream dependent Branch IDs
 * @property {string[]} topologicalOrder - Safe topological evaluation order of branches
 * @property {boolean} hasCycle - True if a dependency cycle was detected
 */

/**
 * Compiles a dependency DAG from a raw or compiled intake schema.
 * Throws if a cyclic branch dependency is detected.
 * @param {IntakeSchema | CompiledSchema} schema
 * @returns {DependencyDAG}
 */
export function buildDependencyDAG(schema) {
  const pathToBranches = new Map();
  const pathToQuestions = new Map();
  const branchToQuestions = new Map();
  const branchToOwnedPaths = new Map();
  const branchGraph = new Map();

  const branches = schema.branches || [];
  const sections = schema.sections || [];

  // Helper to record mapping
  function addMapping(map, key, value) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  }

  // 1. Index branch activation dependencies and owned paths
  for (const branch of branches) {
    branchGraph.set(branch.id, new Set());
    branchToQuestions.set(branch.id, new Set());
    const normalizedOwned = new Set();

    if (Array.isArray(branch.ownedPaths)) {
      for (const p of branch.ownedPaths) {
        normalizedOwned.add(normalizePathPattern(p));
      }
    }
    branchToOwnedPaths.set(branch.id, normalizedOwned);

    if (branch.activation) {
      const paths = extractPredicatePaths(branch.activation);
      for (const p of paths) {
        const norm = normalizePathPattern(p);
        addMapping(pathToBranches, norm, branch.id);
      }
    }
  }

  // 2. Index question visibility, requirement, prerequisite dependencies, and branch membership
  for (const section of sections) {
    for (const q of section.questions || []) {
      // Map branch membership
      if (q.branch) {
        if (!branchToQuestions.has(q.branch)) {
          branchToQuestions.set(q.branch, new Set());
        }
        branchToQuestions.get(q.branch).add(q.id);
      }

      const dependentPaths = new Set();

      if (q.visibleWhen) {
        for (const p of extractPredicatePaths(q.visibleWhen)) dependentPaths.add(p);
      }
      if (q.requiredWhen) {
        for (const p of extractPredicatePaths(q.requiredWhen)) dependentPaths.add(p);
      }
      if (Array.isArray(q.prerequisites)) {
        for (const p of q.prerequisites) dependentPaths.add(p);
      }

      for (const p of dependentPaths) {
        const norm = normalizePathPattern(p);
        addMapping(pathToQuestions, norm, q.id);
      }
    }
  }

  // 3. Build Branch-to-Branch Adjacency Graph (Branch A -> Branch B if A owns facts that overlap B's read paths)
  for (const [branchAId, ownedSet] of branchToOwnedPaths.entries()) {
    for (const ownedPath of ownedSet) {
      for (const [depPath, dependentBranches] of pathToBranches.entries()) {
        if (pathsOverlap(ownedPath, depPath)) {
          for (const branchBId of dependentBranches) {
            if (branchAId !== branchBId) {
              branchGraph.get(branchAId).add(branchBId);
            }
          }
        }
      }
    }
  }

  // 4. Compute topological ordering and check for cycles
  const { order: topologicalOrder, hasCycle } = topologicalSort(branchGraph);

  if (hasCycle) {
    throw new Error(
      `Cyclic branch dependency detected in schema. Branches involved in cycle cannot be ordered deterministically.`
    );
  }

  // Append any isolated branches not in the ordering
  const missing = branches.map((b) => b.id).filter((id) => !topologicalOrder.includes(id));
  const fullOrder = [...topologicalOrder, ...missing];

  return Object.freeze({
    pathToBranches,
    pathToQuestions,
    branchToQuestions,
    branchToOwnedPaths,
    branchGraph,
    topologicalOrder: fullOrder,
    hasCycle: false,
  });
}

/**
 * Returns all branch IDs directly affected by mutations at the given paths.
 * @param {DependencyDAG} dag
 * @param {string[]} changedPaths
 * @returns {Set<string>}
 */
export function getAffectedBranches(dag, changedPaths) {
  const affected = new Set();
  if (!changedPaths || !changedPaths.length) return affected;

  for (const path of changedPaths) {
    for (const [pattern, branchIds] of dag.pathToBranches.entries()) {
      if (pathsOverlap(path, pattern)) {
        for (const bId of branchIds) affected.add(bId);
      }
    }
  }

  return affected;
}

/**
 * Computes the full transitive closure of affected branches in topological order.
 * E.g., if Branch A is affected, and A -> B -> C in branchGraph, returns [A, B, C].
 *
 * @param {DependencyDAG} dag
 * @param {Iterable<string>} initialBranchIds
 * @returns {string[]} Transitive list of branch IDs in topological order
 */
export function getTransitiveAffectedBranches(dag, initialBranchIds) {
  const visited = new Set(initialBranchIds);
  const queue = Array.from(initialBranchIds);

  while (queue.length > 0) {
    const current = queue.shift();
    const downstream = dag.branchGraph.get(current) || new Set();
    for (const target of downstream) {
      if (!visited.has(target)) {
        visited.add(target);
        queue.push(target);
      }
    }
  }

  // Sort according to DAG topological order
  return dag.topologicalOrder.filter((bId) => visited.has(bId));
}

/**
 * Returns all question IDs whose eligibility or visibility may change due to mutations at the given paths.
 * @param {DependencyDAG} dag
 * @param {string[]} changedPaths
 * @returns {Set<string>}
 */
export function getAffectedQuestions(dag, changedPaths) {
  const affected = new Set();
  if (!changedPaths || !changedPaths.length) return affected;

  for (const path of changedPaths) {
    for (const [pattern, questionIds] of dag.pathToQuestions.entries()) {
      if (pathsOverlap(path, pattern)) {
        for (const qId of questionIds) affected.add(qId);
      }
    }
  }

  return affected;
}

/**
 * Returns all question IDs belonging to the given branch IDs.
 * @param {DependencyDAG} dag
 * @param {Iterable<string>} branchIds
 * @returns {Set<string>}
 */
export function getQuestionsForBranches(dag, branchIds) {
  const questions = new Set();
  for (const bId of branchIds) {
    const qIds = dag.branchToQuestions.get(bId);
    if (qIds) {
      for (const qId of qIds) questions.add(qId);
    }
  }
  return questions;
}


// ==========================================
// Module: canonical.js
// ==========================================
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


// ==========================================
// Module: diagnostics.js
// ==========================================
/**
 * @file diagnostics.js
 * @description Static schema analyzer, proof-based linter, and diagnostic verification for Theta Engine.
 */



/**
 * @typedef {import('./contracts.js').IntakeSchema} IntakeSchema
 * @typedef {import('./schema.js').CompiledSchema} CompiledSchema
 */

/**
 * @typedef {Object} Diagnostic
 * @property {'error' | 'warning'} severity
 * @property {string} code
 * @property {string} message
 * @property {string} [context]
 * @property {string} [path]
 */

/**
 * Checks if a predicate contains contradictory static equalities in an `all` clause
 * (e.g. x === 1 && x === 2).
 * @param {any} predicate
 * @returns {string | null} Description of contradiction if found
 */
function findContradictoryPredicate(predicate) {
  if (!predicate || typeof predicate !== "object") return null;

  if (Array.isArray(predicate.all)) {
    const equalitiesByPath = new Map();

    for (const sub of predicate.all) {
      if (sub && sub.equals && typeof sub.equals.path === "string") {
        const p = sub.equals.path;
        const val = JSON.stringify(sub.equals.value);
        if (equalitiesByPath.has(p) && equalitiesByPath.get(p) !== val) {
          return `Contradictory equality conditions on path '${p}' (${equalitiesByPath.get(p)} vs ${val})`;
        }
        equalitiesByPath.set(p, val);
      }
    }
  }

  return null;
}

/**
 * Performs comprehensive static diagnostic analysis on an intake schema using canonical typed paths.
 * @param {IntakeSchema | CompiledSchema} schema
 * @returns {{ ok: boolean, errors: Diagnostic[], warnings: Diagnostic[] }}
 */
export function analyzeSchemaDiagnostics(schema) {
  const errors = [];
  const warnings = [];

  const raw = schema.raw || schema;
  const branches = raw.branches || [];
  const sections = raw.sections || [];
  const repeaters = raw.repeaters || [];

  const branchMap = new Map(branches.map((b) => [b.id, b]));
  const allQuestionPaths = [];
  const allQuestions = [];

  for (const s of sections) {
    for (const q of s.questions || []) {
      allQuestions.push(q);
      if (q.path) allQuestionPaths.push(q.path);
    }
  }

  // Collect all declaratively reachable paths in schema (questions, repeaters, branches)
  const allDeclaredPaths = [
    ...allQuestionPaths,
    ...repeaters.map((r) => r.collectionPath),
    ...branches.flatMap((b) => b.ownedPaths || []),
  ];

  // 1. Validate Branch Reference Integrity & Ownership
  for (const q of allQuestions) {
    if (q.branch) {
      const targetBranch = branchMap.get(q.branch);
      if (!targetBranch) {
        errors.push({
          severity: "error",
          code: "ERR_DANGLING_BRANCH_REF",
          message: `Question '${q.id}' references non-existent branch '${q.branch}'`,
          context: `Question[${q.id}].branch`,
        });
      } else if (q.path && Array.isArray(targetBranch.ownedPaths)) {
        const isCovered = targetBranch.ownedPaths.some((owned) => pathsOverlap(q.path, owned));
        if (!isCovered) {
          errors.push({
            severity: "error",
            code: "ERR_UNOWNED_BRANCH_QUESTION",
            message: `Question '${q.id}' declares path '${q.path}' under branch '${q.branch}', but path is not listed in branch.ownedPaths [${targetBranch.ownedPaths.join(", ")}]`,
            context: `Question[${q.id}].path`,
            path: q.path,
          });
        }
      }
    }
  }

  // 2. Detect Orphan Branch Owned Paths (Warning)
  for (const b of branches) {
    for (const ownedPath of b.ownedPaths || []) {
      const hasWriter = allQuestions.some((q) => pathsOverlap(q.path, ownedPath));
      if (!hasWriter) {
        warnings.push({
          severity: "warning",
          code: "WARN_ORPHAN_OWNED_PATH",
          message: `Branch '${b.id}' owns path '${ownedPath}', but no question in schema writes to this path`,
          context: `Branch[${b.id}].ownedPaths`,
          path: ownedPath,
        });
      }
    }
  }

  // 3. Detect Dangling Path Dependencies using canonical typed token overlap
  function checkPredicatePaths(predicate, context) {
    if (!predicate) return;
    const contradiction = findContradictoryPredicate(predicate);
    if (contradiction) {
      errors.push({
        severity: "error",
        code: "ERR_CONTRADICTORY_PREDICATE",
        message: `${context}: ${contradiction}`,
        context,
      });
    }

    const paths = extractPredicatePaths(predicate);
    for (const p of paths) {
      const isKnown = allDeclaredPaths.some((dp) => pathsOverlap(p, dp));
      if (!isKnown) {
        errors.push({
          severity: "error",
          code: "ERR_DANGLING_PATH_DEPENDENCY",
          message: `${context} depends on unwritten path '${p}' which is never declared by any question, repeater, or branch`,
          context,
          path: p,
        });
      }
    }
  }

  for (const q of allQuestions) {
    if (q.visibleWhen) checkPredicatePaths(q.visibleWhen, `Question[${q.id}].visibleWhen`);
    if (q.requiredWhen) checkPredicatePaths(q.requiredWhen, `Question[${q.id}].requiredWhen`);
    if (Array.isArray(q.prerequisites)) {
      for (const req of q.prerequisites) {
        const isKnown = allDeclaredPaths.some((dp) => pathsOverlap(req, dp));
        if (!isKnown) {
          errors.push({
            severity: "error",
            code: "ERR_DANGLING_PATH_DEPENDENCY",
            message: `Question[${q.id}].prerequisites references unwritten path '${req}'`,
            context: `Question[${q.id}].prerequisites`,
            path: req,
          });
        }
      }
    }
  }

  for (const b of branches) {
    if (b.activation) checkPredicatePaths(b.activation, `Branch[${b.id}].activation`);
  }

  // 4. Validate Branch Dependency Graph Acyclicity
  try {
    buildDependencyDAG(raw);
  } catch (err) {
    const isCycle = err.message.toLowerCase().includes("cyclic");
    errors.push({
      severity: "error",
      code: isCycle ? "ERR_CYCLIC_DEPENDENCY" : "ERR_SCHEMA_DAG_COMPILATION",
      message: err.message,
      context: "schema.branches",
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}


// ==========================================
// Module: migration.js
// ==========================================
/**
 * @file migration.js
 * @description Pure versioned schema and state migration pipeline for Theta Engine.
 */


/**
 * @typedef {import('./contracts.js').IntakeState} IntakeState
 */

/**
 * @typedef {Object} MigrationStep
 * @property {number} fromVersion - Source schema version
 * @property {number} toVersion - Target schema version
 * @property {string} description - Human-readable description of changes
 * @property {(facts: Record<string, unknown>) => Record<string, unknown>} up - Pure transformation function
 * @property {(facts: Record<string, unknown>) => Record<string, unknown>} [down] - Optional rollback function
 */

/**
 * Declaratively renames a fact path immutably.
 * @param {Record<string, unknown>} facts
 * @param {string} oldPath
 * @param {string} newPath
 * @returns {Record<string, unknown>}
 */
export function renameFactPath(facts, oldPath, newPath) {
  const val = getAt(facts, oldPath);
  if (val === undefined) return facts;

  let updated = deleteAt(facts, oldPath);
  updated = setAt(updated, newPath, val);
  return updated;
}

/**
 * Declaratively transforms a fact value at a given path immutably.
 * @param {Record<string, unknown>} facts
 * @param {string} path
 * @param {(val: unknown) => unknown} transformFn
 * @returns {Record<string, unknown>}
 */
export function transformFactPath(facts, path, transformFn) {
  const val = getAt(facts, path);
  if (val === undefined) return facts;

  const newVal = transformFn(val);
  return setAt(facts, path, newVal);
}

/**
 * Declaratively removes a fact path immutably.
 * @param {Record<string, unknown>} facts
 * @param {string} path
 * @returns {Record<string, unknown>}
 */
export function deleteFactPath(facts, path) {
  return deleteAt(facts, path);
}

/**
 * Creates a deterministic migration runner for chaining schema upgrades.
 * Validates step continuity and rejects malformed/duplicate version transitions.
 * @param {MigrationStep[]} migrations
 */
export function createMigrationRunner(migrations = []) {
  const seenFrom = new Set();
  const seenTo = new Set();

  for (const step of migrations) {
    if (!step || typeof step !== "object") {
      throw new Error("Migration step must be a non-null object");
    }
    if (typeof step.fromVersion !== "number" || typeof step.toVersion !== "number") {
      throw new Error("Migration step must define numeric fromVersion and toVersion");
    }
    if (step.fromVersion >= step.toVersion) {
      throw new Error(
        `Invalid migration step (${step.fromVersion} -> ${step.toVersion}): fromVersion must be strictly less than toVersion`
      );
    }
    if (typeof step.up !== "function") {
      throw new Error(`Migration step (${step.fromVersion} -> ${step.toVersion}) must define an 'up' function`);
    }
    if (seenFrom.has(step.fromVersion)) {
      throw new Error(`Duplicate migration fromVersion '${step.fromVersion}' detected`);
    }
    if (seenTo.has(step.toVersion)) {
      throw new Error(`Duplicate migration toVersion '${step.toVersion}' detected`);
    }

    seenFrom.add(step.fromVersion);
    seenTo.add(step.toVersion);
  }

  // Sort migrations by fromVersion
  const steps = [...migrations].sort((a, b) => a.fromVersion - b.fromVersion);

  /**
   * Finds a contiguous migration path from startVersion to targetVersion.
   * @param {number} startVersion
   * @param {number} targetVersion
   * @returns {MigrationStep[]}
   */
  function findPath(startVersion, targetVersion) {
    if (startVersion === targetVersion) return [];
    if (startVersion > targetVersion) {
      throw new Error(`Downgrade migration (${startVersion} -> ${targetVersion}) not supported by default pipeline`);
    }

    const path = [];
    let current = startVersion;

    while (current < targetVersion) {
      const step = steps.find((s) => s.fromVersion === current);
      if (!step) {
        throw new Error(`Missing contiguous migration step from version ${current}`);
      }
      path.push(step);
      current = step.toVersion;
    }

    return path;
  }

  /**
   * Migrates canonical facts from currentVersion to targetVersion immutably.
   * @param {Record<string, unknown>} initialFacts
   * @param {number} currentVersion
   * @param {number} targetVersion
   * @returns {{ facts: Record<string, unknown>, applied: MigrationStep[] }}
   */
  function migrateFacts(initialFacts, currentVersion, targetVersion) {
    const path = findPath(currentVersion, targetVersion);
    let workingFacts = structuredClone(initialFacts || {});

    for (const step of path) {
      try {
        workingFacts = step.up(workingFacts);
      } catch (err) {
        throw new Error(
          `Migration failed during step ${step.fromVersion} -> ${step.toVersion} (${step.description}): ${err.message}`
        );
      }
    }

    return {
      facts: workingFacts,
      applied: path,
    };
  }

  /**
   * Migrates an entire IntakeState object immutably with monotonic revision increment.
   * @param {IntakeState} state
   * @param {number} currentVersion
   * @param {number} targetVersion
   * @returns {IntakeState}
   */
  function migrateState(state, currentVersion, targetVersion) {
    const result = migrateFacts(state.facts, currentVersion, targetVersion);
    return {
      facts: result.facts,
      revision: (state.revision || 1) + result.applied.length,
    };
  }

  return {
    migrateFacts,
    migrateState,
    getRegisteredSteps: () => [...steps],
  };
}


// ==========================================
// Module: history.js
// ==========================================
/**
 * @file history.js
 * @description Deterministic transaction command log, replay engine, and time-travel manager for Theta.
 */




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


// ==========================================
// Module: adapter.js
// ==========================================
/**
 * @file adapter.js
 * @description Universal store and selective subscription framework adapter for Theta Engine.
 */


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


// ==========================================
// Module: codegen.js
// ==========================================
/**
 * @file codegen.js
 * @description Zero-dependency, deterministic TypeScript code and types generator for Theta schemas.
 */


/**
 * @typedef {import('./contracts.js').IntakeSchema} IntakeSchema
 */

/**
 * Maps a question kind to its TypeScript primitive/domain type.
 * @param {string} kind
 * @returns {string}
 */
export function mapKindToTsType(kind) {
  switch (kind) {
    case "number":
    case "currency":
      return "number";
    case "boolean":
      return "boolean";
    case "date":
    case "text":
    case "pan":
    case "cin":
    case "din":
    case "aadhaar":
    case "select":
    case "card":
      return "string";
    case "multiselect":
      return "string[]";
    default:
      return "unknown";
  }
}

/**
 * @typedef {Object} LeafNode
 * @property {'leaf'} kind
 * @property {string} tsType
 */

/**
 * @typedef {Object} ObjectNode
 * @property {'object'} kind
 * @property {Map<string, TypeNode>} properties
 */

/**
 * @typedef {Object} ArrayNode
 * @property {'array'} kind
 * @property {TypeNode} element
 */

/**
 * @typedef {LeafNode | ObjectNode | ArrayNode} TypeNode
 */

/**
 * Renders a TypeNode to clean, formatted TypeScript.
 * @param {TypeNode} node
 * @param {string} [indent]
 * @returns {string}
 */
function renderNode(node, indent = "  ") {
  if (node.kind === "leaf") {
    return node.tsType;
  }

  if (node.kind === "array") {
    if (node.element.kind === "leaf") {
      return `Array<${node.element.tsType}>`;
    }
    const renderedElem = renderNode(node.element, indent);
    return `Array<${renderedElem}>`;
  }

  if (node.kind === "object") {
    if (node.properties.size === 0) {
      return "Record<string, unknown>";
    }

    const keys = Array.from(node.properties.keys()).sort();
    const lines = ["{"];
    for (const key of keys) {
      const child = node.properties.get(key);
      const renderedChild = renderNode(child, indent + "  ");
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
      lines.push(`${indent}  ${safeKey}?: ${renderedChild};`);
    }
    lines.push(`${indent}}`);
    return lines.join("\n");
  }

  return "unknown";
}

/**
 * Inserts a tokenized path into the type AST tree.
 * Enforces strict structural collision detection.
 *
 * @param {ObjectNode} root
 * @param {import('./path.js').PathToken[]} tokens
 * @param {string} targetTsType
 * @param {string} fullPath
 */
function insertPath(root, tokens, targetTsType, fullPath) {
  if (!tokens || tokens.length === 0) return;

  /** @type {TypeNode} */
  let curr = root;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isLast = i === tokens.length - 1;

    if (token.type === "key") {
      const key = String(token.value);
      if (curr.kind !== "object") {
        throw new Error(
          `Schema path collision: "${fullPath}" attempted to access property "${key}" on non-object node`
        );
      }

      if (curr.properties.has(key)) {
        const child = curr.properties.get(key);
        if (isLast) {
          if (child.kind !== "leaf" || child.tsType !== targetTsType) {
            throw new Error(
              `Schema path collision: "${fullPath}" conflicts with existing node structure at "${key}"`
            );
          }
          // Same leaf type, deterministic merge
          return;
        }

        if (child.kind === "leaf") {
          throw new Error(
            `Schema path collision: "${fullPath}" conflicts with existing leaf at "${key}"`
          );
        }

        const nextToken = tokens[i + 1];
        if (nextToken.type === "scope" || nextToken.type === "index") {
          if (child.kind !== "array") {
            throw new Error(
              `Schema path collision: "${fullPath}" expected array container for "${key}" but found object`
            );
          }
        } else {
          if (child.kind !== "object") {
            throw new Error(
              `Schema path collision: "${fullPath}" expected object container for "${key}" but found array`
            );
          }
        }
        curr = child;
      } else {
        if (isLast) {
          curr.properties.set(key, { kind: "leaf", tsType: targetTsType });
          return;
        }

        const nextToken = tokens[i + 1];
        if (nextToken.type === "scope" || nextToken.type === "index") {
          /** @type {ArrayNode} */
          const arrayNode = {
            kind: "array",
            element: { kind: "object", properties: new Map() },
          };
          curr.properties.set(key, arrayNode);
          curr = arrayNode;
        } else {
          /** @type {ObjectNode} */
          const objNode = { kind: "object", properties: new Map() };
          curr.properties.set(key, objNode);
          curr = objNode;
        }
      }
    } else if (token.type === "scope" || token.type === "index") {
      if (curr.kind !== "array") {
        throw new Error(
          `Schema path collision: "${fullPath}" encountered array token at non-array node`
        );
      }

      if (isLast) {
        if (curr.element.kind === "object" && curr.element.properties.size === 0) {
          curr.element = { kind: "leaf", tsType: targetTsType };
          return;
        }
        if (curr.element.kind === "leaf" && curr.element.tsType === targetTsType) {
          return;
        }
        throw new Error(
          `Schema path collision: "${fullPath}" conflicts with array element structure`
        );
      }

      const nextToken = tokens[i + 1];
      if (curr.element.kind === "leaf") {
        throw new Error(
          `Schema path collision: "${fullPath}" conflicts with existing array leaf element`
        );
      }

      if (nextToken.type === "scope" || nextToken.type === "index") {
        if (curr.element.kind === "object" && curr.element.properties.size === 0) {
          curr.element = {
            kind: "array",
            element: { kind: "object", properties: new Map() },
          };
        }
        if (curr.element.kind !== "array") {
          throw new Error(
            `Schema path collision: "${fullPath}" expected nested array container`
          );
        }
        curr = curr.element;
      } else {
        if (curr.element.kind !== "object") {
          throw new Error(
            `Schema path collision: "${fullPath}" expected object element in array container`
          );
        }
        curr = curr.element;
      }
    }
  }
}

/**
 * Generates deterministic TypeScript type declarations from an IntakeSchema.
 * Produces byte-identical output with full repeater topologies, collision safety, and escaped identifiers.
 *
 * @param {IntakeSchema} schema
 * @returns {string} Clean TypeScript source code
 */
export function generateTypeScript(schema) {
  if (!schema || typeof schema !== "object") {
    throw new Error("generateTypeScript requires a valid IntakeSchema object");
  }

  const sections = schema.sections || [];
  const branches = schema.branches || [];
  const repeaters = schema.repeaters || [];

  // 1. Collect and sort all Question IDs and path mappings
  const questionIds = [];
  const questionsByPath = [];

  for (const s of sections) {
    for (const q of s.questions || []) {
      if (q.id) {
        questionIds.push(q.id);
      }
      if (q.path) {
        questionsByPath.push(q);
      }
    }
  }
  questionIds.sort();

  const branchIds = branches.map((b) => b.id).filter(Boolean).sort();
  const repeaterIds = repeaters.map((r) => r.id).filter(Boolean).sort();

  // 2. Generate QuestionId Union Type (JSON-escaped for safety against quotes, backslashes, hyphens)
  const questionIdType =
    questionIds.length > 0
      ? questionIds.map((id) => `  | ${JSON.stringify(id)}`).join("\n")
      : "  | string";

  // 3. Generate BranchId Union Type
  const branchIdType =
    branchIds.length > 0
      ? branchIds.map((id) => `  | ${JSON.stringify(id)}`).join("\n")
      : "  | string";

  // 4. Generate RepeaterId Union Type
  const repeaterIdType =
    repeaterIds.length > 0
      ? repeaterIds.map((id) => `  | ${JSON.stringify(id)}`).join("\n")
      : "  | string";

  // 5. Build nested facts AST structure
  /** @type {ObjectNode} */
  const rootNode = { kind: "object", properties: new Map() };

  // Sort paths deterministically before inserting
  questionsByPath.sort((a, b) => a.path.localeCompare(b.path));

  for (const q of questionsByPath) {
    const tokens = tokenizePath(q.path);
    const tsType = mapKindToTsType(q.kind);
    insertPath(rootNode, tokens, tsType, q.path);
  }

  const factsType = renderNode(rootNode, "");

  // Safe schema comment sanitization (preventing */ breakout)
  const safeSchemaId = String(schema.id ?? "").replace(/\*\//g, "*\\/");
  const safeVersion = Number(schema.version) || 1;

  // 6. Assemble complete TypeScript file
  const out = `/**
 * AUTO-GENERATED BY THETA ENGINE CODEGEN. DO NOT EDIT DIRECTLY.
 * Schema ID: ${safeSchemaId}
 * Version: ${safeVersion}
 */

export type QuestionId =
${questionIdType};

export type BranchId =
${branchIdType};

export type RepeaterId =
${repeaterIdType};

export interface CanonicalFacts ${factsType}

export interface TypedIntakeState {
  facts: CanonicalFacts;
  revision: number;
}
`;

  return out;
}


// ==========================================
// Module: transaction.js
// ==========================================
/**
 * @file transaction.js
 * @description Atomic state transaction runner for Theta.
 */



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


// ==========================================
// Module: schema.js
// ==========================================
/**
 * @file schema.js
 * @description Fail-fast schema validator, indexer, and compilation pipeline for Theta.
 */


/**
 * @typedef {import('./contracts.js').IntakeSchema} IntakeSchema
 * @typedef {import('./contracts.js').QuestionDefinition} QuestionDefinition
 * @typedef {import('./contracts.js').SectionDefinition} SectionDefinition
 * @typedef {import('./contracts.js').BranchDefinition} BranchDefinition
 * @typedef {import('./contracts.js').RepeaterDefinition} RepeaterDefinition
 * @typedef {import('./contracts.js').Predicate} Predicate
 * @typedef {import('./dag.js').DependencyDAG} DependencyDAG
 */

export const SUPPORTED_QUESTION_KINDS = new Set([
  "text",
  "number",
  "boolean",
  "date",
  "select",
  "multiselect",
  "card",
  "address",
  "currency",
  "pan",
  "aadhaar",
  "cin",
  "repeater",
]);

/**
 * Validates a predicate recursively.
 * @param {Predicate} pred
 * @param {string} context - Error context path
 * @param {string[]} errors - Accumulator
 */
export function validatePredicate(pred, context, errors) {
  if (!pred || typeof pred !== "object") {
    errors.push(`${context}: Predicate must be a non-null object`);
    return;
  }

  const validKeys = new Set(["equals", "notEquals", "in", "notIn", "exists", "all", "any", "not"]);
  const presentKeys = Object.keys(pred).filter((k) => validKeys.has(k));

  if (presentKeys.length === 0) {
    errors.push(`${context}: Predicate must contain at least one valid operator (${Array.from(validKeys).join(", ")})`);
    return;
  }

  if ("all" in pred) {
    if (!Array.isArray(pred.all)) {
      errors.push(`${context}.all must be an array of predicates`);
    } else {
      pred.all.forEach((p, idx) => validatePredicate(p, `${context}.all[${idx}]`, errors));
    }
  }

  if ("any" in pred) {
    if (!Array.isArray(pred.any)) {
      errors.push(`${context}.any must be an array of predicates`);
    } else {
      pred.any.forEach((p, idx) => validatePredicate(p, `${context}.any[${idx}]`, errors));
    }
  }

  if ("not" in pred) {
    validatePredicate(pred.not, `${context}.not`, errors);
  }

  if ("equals" in pred) {
    if (!pred.equals || typeof pred.equals.path !== "string" || !pred.equals.path.trim()) {
      errors.push(`${context}.equals must specify a non-empty string path`);
    }
  }

  if ("notEquals" in pred) {
    if (!pred.notEquals || typeof pred.notEquals.path !== "string" || !pred.notEquals.path.trim()) {
      errors.push(`${context}.notEquals must specify a non-empty string path`);
    }
  }

  if ("in" in pred) {
    if (!pred.in || typeof pred.in.path !== "string" || !Array.isArray(pred.in.values)) {
      errors.push(`${context}.in must specify a string path and values array`);
    }
  }

  if ("notIn" in pred) {
    if (!pred.notIn || typeof pred.notIn.path !== "string" || !Array.isArray(pred.notIn.values)) {
      errors.push(`${context}.notIn must specify a string path and values array`);
    }
  }

  if ("exists" in pred) {
    if (!pred.exists || typeof pred.exists.path !== "string" || !pred.exists.path.trim()) {
      errors.push(`${context}.exists must specify a non-empty string path`);
    }
  }
}

/**
 * Extracts all fact paths referenced by a predicate.
 * @param {Predicate} [pred]
 * @returns {string[]}
 */
export function extractPredicatePaths(pred) {
  if (!pred || typeof pred !== "object") return [];
  const paths = [];

  if (pred.equals?.path) paths.push(pred.equals.path);
  if (pred.notEquals?.path) paths.push(pred.notEquals.path);
  if (pred.in?.path) paths.push(pred.in.path);
  if (pred.notIn?.path) paths.push(pred.notIn.path);
  if (pred.exists?.path) paths.push(pred.exists.path);

  if (Array.isArray(pred.all)) {
    for (const sub of pred.all) paths.push(...extractPredicatePaths(sub));
  }
  if (Array.isArray(pred.any)) {
    for (const sub of pred.any) paths.push(...extractPredicatePaths(sub));
  }
  if (pred.not) {
    paths.push(...extractPredicatePaths(pred.not));
  }

  return paths;
}

/**
 * Performs comprehensive fail-fast structural validation on a raw intake schema.
 * @param {IntakeSchema} schema
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateSchema(schema) {
  const errors = [];

  if (!schema || typeof schema !== "object") {
    return { ok: false, errors: ["Schema must be a valid non-null object"] };
  }

  if (!schema.id || typeof schema.id !== "string") {
    errors.push("Schema must specify a non-empty string 'id'");
  }

  if (typeof schema.version !== "number" || schema.version <= 0) {
    errors.push("Schema must specify a positive numeric 'version'");
  }

  if (!Array.isArray(schema.sections) || schema.sections.length === 0) {
    errors.push("Schema must contain at least one section in 'sections' array");
  }

  const seenQuestionIds = new Set();
  const seenSectionIds = new Set();
  const seenBranchIds = new Set();
  const seenRepeaterIds = new Set();

  // Validate Sections & Questions
  if (Array.isArray(schema.sections)) {
    for (let sIdx = 0; sIdx < schema.sections.length; sIdx++) {
      const section = schema.sections[sIdx];
      const sCtx = `Section[${sIdx}] ('${section?.id || "unnamed"}')`;

      if (!section || typeof section !== "object") {
        errors.push(`${sCtx}: Section must be an object`);
        continue;
      }

      if (!section.id || typeof section.id !== "string") {
        errors.push(`${sCtx}: Section must have a valid string id`);
      } else if (seenSectionIds.has(section.id)) {
        errors.push(`Duplicate section id '${section.id}' detected`);
      } else {
        seenSectionIds.add(section.id);
      }

      if (!section.title || typeof section.title !== "string") {
        errors.push(`${sCtx}: Section must have a non-empty title`);
      }

      if (!Array.isArray(section.questions)) {
        errors.push(`${sCtx}: Section must contain a 'questions' array`);
        continue;
      }

      for (let qIdx = 0; qIdx < section.questions.length; qIdx++) {
        const q = section.questions[qIdx];
        const qCtx = `${sCtx}.Question[${qIdx}] ('${q?.id || "unnamed"}')`;

        if (!q || typeof q !== "object") {
          errors.push(`${qCtx}: Question must be an object`);
          continue;
        }

        if (!q.id || typeof q.id !== "string") {
          errors.push(`${qCtx}: Question must have a valid string id`);
        } else if (seenQuestionIds.has(q.id)) {
          errors.push(`Duplicate question id '${q.id}' detected`);
        } else {
          seenQuestionIds.add(q.id);
        }

        if (!q.path || typeof q.path !== "string") {
          errors.push(`${qCtx}: Question must specify a non-empty string path`);
        }

        if (!q.kind || !SUPPORTED_QUESTION_KINDS.has(q.kind)) {
          errors.push(
            `${qCtx}: Invalid question kind '${q.kind}'. Supported: ${Array.from(SUPPORTED_QUESTION_KINDS).join(", ")}`
          );
        }

        if (!q.label || typeof q.label !== "string") {
          errors.push(`${qCtx}: Question must specify a non-empty label`);
        }

        if (q.kind === "select" || q.kind === "multiselect" || q.kind === "card") {
          if (!Array.isArray(q.options) || q.options.length === 0) {
            errors.push(`${qCtx}: Question of kind '${q.kind}' must specify non-empty 'options' array`);
          }
        }

        if (q.visibleWhen) {
          validatePredicate(q.visibleWhen, `${qCtx}.visibleWhen`, errors);
        }

        if (q.requiredWhen) {
          validatePredicate(q.requiredWhen, `${qCtx}.requiredWhen`, errors);
        }

        if (q.prerequisites && !Array.isArray(q.prerequisites)) {
          errors.push(`${qCtx}: 'prerequisites' must be an array of strings`);
        }

        if (q.invalidates && !Array.isArray(q.invalidates)) {
          errors.push(`${qCtx}: 'invalidates' must be an array of strings`);
        }
      }
    }
  }

  // Validate Branches
  if (schema.branches) {
    if (!Array.isArray(schema.branches)) {
      errors.push("schema.branches must be an array");
    } else {
      for (let bIdx = 0; bIdx < schema.branches.length; bIdx++) {
        const b = schema.branches[bIdx];
        const bCtx = `Branch[${bIdx}] ('${b?.id || "unnamed"}')`;

        if (!b || typeof b !== "object") {
          errors.push(`${bCtx}: Branch must be an object`);
          continue;
        }

        if (!b.id || typeof b.id !== "string") {
          errors.push(`${bCtx}: Branch must have a valid string id`);
        } else if (seenBranchIds.has(b.id)) {
          errors.push(`Duplicate branch id '${b.id}' detected`);
        } else {
          seenBranchIds.add(b.id);
        }

        if (!Array.isArray(b.ownedPaths) || b.ownedPaths.length === 0) {
          errors.push(`${bCtx}: Branch must declare a non-empty 'ownedPaths' array`);
        }

        if (b.activation) {
          validatePredicate(b.activation, `${bCtx}.activation`, errors);
        }
      }
    }
  }

  // Validate Repeaters
  if (schema.repeaters) {
    if (!Array.isArray(schema.repeaters)) {
      errors.push("schema.repeaters must be an array");
    } else {
      for (let rIdx = 0; rIdx < schema.repeaters.length; rIdx++) {
        const rep = schema.repeaters[rIdx];
        const rCtx = `Repeater[${rIdx}] ('${rep?.id || "unnamed"}')`;

        if (!rep || typeof rep !== "object") {
          errors.push(`${rCtx}: Repeater must be an object`);
          continue;
        }

        if (!rep.id || typeof rep.id !== "string") {
          errors.push(`${rCtx}: Repeater must have a valid string id`);
        } else if (seenRepeaterIds.has(rep.id)) {
          errors.push(`Duplicate repeater id '${rep.id}' detected`);
        } else {
          seenRepeaterIds.add(rep.id);
        }

        if (!rep.collectionPath || typeof rep.collectionPath !== "string") {
          errors.push(`${rCtx}: Repeater must specify a string 'collectionPath'`);
        }

        if (!rep.scopeName || typeof rep.scopeName !== "string") {
          errors.push(`${rCtx}: Repeater must specify a string 'scopeName'`);
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

/**
 * @typedef {Object} CompiledSchema
 * @property {string} id
 * @property {number} version
 * @property {SectionDefinition[]} sections
 * @property {BranchDefinition[]} branches
 * @property {RepeaterDefinition[]} repeaters
 * @property {Map<string, QuestionDefinition>} questionsById
 * @property {Map<string, SectionDefinition>} sectionsById
 * @property {Map<string, BranchDefinition>} branchesById
 * @property {Map<string, RepeaterDefinition>} repeatersById
 * @property {Map<string, string>} pathToQuestionId
 * @property {Map<string, string[]>} branchDependencies
 * @property {DependencyDAG} dag
 * @property {IntakeSchema} raw
 */

/**
 * Compiles and indexes a validated schema into an immutable lookup structure with dependency DAG.
 * @param {IntakeSchema} rawSchema
 * @returns {CompiledSchema}
 */
export function compileSchema(rawSchema) {
  const validation = validateSchema(rawSchema);
  if (!validation.ok) {
    throw new Error(`Schema Compilation Error:\n  - ${validation.errors.join("\n  - ")}`);
  }

  const questionsById = new Map();
  const sectionsById = new Map();
  const branchesById = new Map();
  const repeatersById = new Map();
  const pathToQuestionId = new Map();
  const branchDependencies = new Map();

  // Index sections and questions
  for (const section of rawSchema.sections) {
    sectionsById.set(section.id, Object.freeze({ ...section }));

    for (const question of section.questions) {
      questionsById.set(question.id, Object.freeze({ ...question }));
      if (question.path) {
        pathToQuestionId.set(question.path, question.id);
      }
    }
  }

  // Index branches and compute dependency paths
  if (Array.isArray(rawSchema.branches)) {
    for (const branch of rawSchema.branches) {
      branchesById.set(branch.id, Object.freeze({ ...branch }));
      const deps = extractPredicatePaths(branch.activation);
      branchDependencies.set(branch.id, deps);
    }
  }

  // Index repeaters
  if (Array.isArray(rawSchema.repeaters)) {
    for (const repeater of rawSchema.repeaters) {
      repeatersById.set(repeater.id, Object.freeze({ ...repeater }));
    }
  }

  // Compile static Dependency DAG
  const dag = buildDependencyDAG(rawSchema);

  return Object.freeze({
    id: rawSchema.id,
    version: rawSchema.version,
    sections: rawSchema.sections,
    branches: rawSchema.branches || [],
    repeaters: rawSchema.repeaters || [],
    questionsById,
    sectionsById,
    branchesById,
    repeatersById,
    pathToQuestionId,
    branchDependencies,
    dag,
    raw: rawSchema,
  });
}


// ==========================================
// Module: projections.js
// ==========================================
/**
 * @file projections.js
 * @description Pure derived views and question resolvers for Theta Engine.
 */




/**
 * @typedef {import('./contracts.js').IntakeSchema} IntakeSchema
 * @typedef {import('./contracts.js').QuestionDefinition} QuestionDefinition
 * @typedef {import('./contracts.js').QuestionProjection} QuestionProjection
 * @typedef {import('./contracts.js').QuestionInstance} QuestionInstance
 * @typedef {import('./contracts.js').ReviewTree} ReviewTree
 * @typedef {import('./contracts.js').ReviewNode} ReviewNode
 */

/**
 * Detects if a question path requires a repeater scope frame.
 * @param {string} path
 * @returns {string | null} Returns scope variable name or null
 */
function extractScopeToken(path) {
  if (!path || typeof path !== "string") return null;
  const tokens = tokenizePath(path);
  const scopeToken = tokens.find((t) => t.type === "scope");
  return scopeToken ? String(scopeToken.value) : null;
}

/**
 * Formats a stable, hierarchical composite instance ID for a scoped question.
 * Encodes full ScopeStack lineage (e.g. 'director_din@company:comp_1/director:dir_2').
 * @param {string} questionId
 * @param {ScopeStack} [scopeStack]
 * @returns {string}
 */
export function formatScopeInstanceId(questionId, scopeStack) {
  if (!scopeStack || scopeStack.isEmpty()) return questionId;
  const frames = scopeStack.toArray();
  const scopeKey = frames.map((f) => `${f.name}:${f.id}`).join("/");
  return `${questionId}@${scopeKey}`;
}

/**
 * Checks if a question has been validly answered, with type-aware semantics.
 * @param {QuestionDefinition} question
 * @param {Record<string, unknown>} facts
 * @param {ScopeStack} [scopeStack]
 * @returns {boolean}
 */
export function isQuestionAnswered(question, facts, scopeStack) {
  const value = getAt(facts, question.path, scopeStack);

  switch (question.kind) {
    case "boolean":
      return typeof value === "boolean";

    case "checkbox":
      return Array.isArray(value) && value.length > 0;

    case "repeater":
      return Array.isArray(value) && value.length > 0;

    case "number":
    case "currency":
      return typeof value === "number" && Number.isFinite(value);

    default:
      if (typeof value === "string") return value.trim().length > 0;
      return value !== undefined && value !== null;
  }
}

/**
 * Checks if a question is currently eligible to be asked based on visibility and prerequisites.
 * @param {QuestionDefinition} question
 * @param {Record<string, unknown>} facts
 * @param {ScopeStack} [scopeStack]
 * @returns {boolean}
 */
export function isQuestionEligible(question, facts, scopeStack) {
  // Check visibility rules
  if (question.visibleWhen) {
    const isVisible = evaluatePredicate(question.visibleWhen, { facts, scope: scopeStack });
    if (!isVisible) return false;
  }

  // Check prerequisites
  if (question.prerequisites && Array.isArray(question.prerequisites)) {
    const prereqsMet = question.prerequisites.every((prereqPath) => {
      const val = getAt(facts, prereqPath, scopeStack);
      return isPresent(val);
    });
    if (!prereqsMet) return false;
  }

  return true;
}

/**
 * Materializes all eligible question instances in natural document order (item-by-item for repeaters).
 * @param {IntakeSchema} schema
 * @param {Record<string, unknown>} facts
 * @param {ScopeStack} [rootScopeStack]
 * @returns {Array<{ instanceId: string, question: QuestionDefinition, sectionId: string, sectionTitle: string, scopeStack: ScopeStack, path: string }>}
 */
export function getEligibleQuestions(schema, facts, rootScopeStack = new ScopeStack()) {
  const result = [];

  for (const section of schema.sections || []) {
    const questions = section.questions || [];
    let qIdx = 0;

    while (qIdx < questions.length) {
      const q = questions[qIdx];
      const scopeToken = q.scope || extractScopeToken(q.path);
      const repeater = scopeToken
        ? schema.repeaters?.find(
            (r) => r.scopeName === scopeToken || r.id === scopeToken || scopeToken === "current"
          )
        : null;

      if (repeater && (!rootScopeStack || !rootScopeStack.get(repeater.scopeName))) {
        // Collect all consecutive questions belonging to this same repeater
        const repeaterGroup = [q];
        let nextIdx = qIdx + 1;
        while (nextIdx < questions.length) {
          const nextQ = questions[nextIdx];
          const nextScope = nextQ.scope || extractScopeToken(nextQ.path);
          if (nextScope === scopeToken) {
            repeaterGroup.push(nextQ);
            nextIdx++;
          } else {
            break;
          }
        }

        const items = getAt(facts, repeater.collectionPath, rootScopeStack);
        if (Array.isArray(items) && items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const itemId =
              item?.id != null && item?.id !== ""
                ? String(item.id)
                : item?._id != null && item?._id !== ""
                ? String(item._id)
                : `${repeater.scopeName}_${i}`;

            const itemScope = rootScopeStack.push({
              name: repeater.scopeName,
              index: i,
              id: itemId,
            });

            for (const rq of repeaterGroup) {
              if (isQuestionEligible(rq, facts, itemScope)) {
                const resolved = resolvePath(rq.path, itemScope);
                result.push({
                  instanceId: formatScopeInstanceId(rq.id, itemScope),
                  question: rq,
                  sectionId: section.id,
                  sectionTitle: section.title,
                  scopeStack: itemScope,
                  path: resolved,
                });
              }
            }
          }
        }

        qIdx = nextIdx;
      } else {
        // Standard non-repeater or already scoped question
        if (isQuestionEligible(q, facts, rootScopeStack)) {
          const resolved = resolvePath(q.path, rootScopeStack);
          result.push({
            instanceId: formatScopeInstanceId(q.id, rootScopeStack),
            question: q,
            sectionId: section.id,
            sectionTitle: section.title,
            scopeStack: rootScopeStack,
            path: resolved,
          });
        }
        qIdx++;
      }
    }
  }

  return result;
}

/**
 * Finds the next unanswered question in the schema.
 * @param {IntakeSchema} schema
 * @param {Record<string, unknown>} facts
 * @param {ScopeStack} [scopeStack]
 * @returns {QuestionProjection | null}
 */
export function resolveActiveQuestion(schema, facts, scopeStack = new ScopeStack()) {
  const eligible = getEligibleQuestions(schema, facts, scopeStack);

  const unanswered = eligible.filter(
    (item) => !isQuestionAnswered(item.question, facts, item.scopeStack)
  );

  if (!unanswered.length) return null;

  const currentItem = unanswered[0];
  const q = currentItem.question;
  const currentScope = currentItem.scopeStack;

  const total = eligible.length;
  const currentIdx = eligible.findIndex((item) => item.instanceId === currentItem.instanceId) + 1;

  const value = getAt(facts, currentItem.path);

  // Check if required
  let isRequired = true;
  if (q.requiredWhen) {
    isRequired = evaluatePredicate(q.requiredWhen, { facts, scope: currentScope });
  }

  return {
    id: currentItem.instanceId,
    questionId: q.id,
    sectionId: currentItem.sectionId,
    sectionTitle: currentItem.sectionTitle,
    path: currentItem.path,
    kind: q.kind,
    label: q.label,
    description: q.description,
    value: value ?? null,
    currentValue: value ?? null,
    options: q.options ? [...q.options] : undefined,
    required: isRequired,
    isAnswered: false,
    progress: {
      current: currentIdx > 0 ? currentIdx : 1,
      total: total || 1,
    },
    scope: currentScope.toArray(),
    question: q,
  };
}

/**
 * Builds a specific question projection by ID or composite instance ID. Useful for one-click edit jumps.
 * @param {IntakeSchema} schema
 * @param {Record<string, unknown>} facts
 * @param {string} targetId - Either base question ID (e.g. 'prop_category') or composite ID (e.g. 'seller_name@party:seller_123')
 * @param {ScopeStack} [scopeStack]
 * @returns {QuestionProjection | null}
 */
export function buildQuestionProjectionById(schema, facts, targetId, scopeStack = new ScopeStack()) {
  const atIdx = targetId.indexOf("@");
  const baseQId = atIdx !== -1 ? targetId.slice(0, atIdx) : targetId;
  const scopeKey = atIdx !== -1 ? targetId.slice(atIdx + 1) : null;

  for (const section of schema.sections || []) {
    const q = section.questions?.find((item) => item.id === baseQId);
    if (!q) continue;

    let targetScope = scopeStack;
    if (scopeKey) {
      const segments = scopeKey.split("/");
      for (const seg of segments) {
        const [scopeName, frameId] = seg.includes(":")
          ? seg.split(":")
          : [q.scope || extractScopeToken(q.path) || "item", seg];

        const repeater = schema.repeaters?.find(
          (r) => r.scopeName === scopeName || r.id === scopeName || scopeName === "current"
        );
        if (repeater) {
          const items = getAt(facts, repeater.collectionPath, targetScope);
          if (Array.isArray(items)) {
            const idx = items.findIndex(
              (i) => i && (String(i.id) === frameId || String(i._id) === frameId)
            );
            if (idx !== -1) {
              targetScope = targetScope.push({
                name: repeater.scopeName,
                index: idx,
                id: frameId,
              });
            }
          }
        }
      }
    }

    const resolvedPath = resolvePath(q.path, targetScope);
    const value = getAt(facts, resolvedPath);
    const eligible = getEligibleQuestions(schema, facts, targetScope);
    const currentIdx = eligible.findIndex(
      (item) => item.question.id === q.id || item.instanceId === targetId
    ) + 1;

    let isRequired = true;
    if (q.requiredWhen) {
      isRequired = evaluatePredicate(q.requiredWhen, { facts, scope: targetScope });
    }

    return {
      id: targetId,
      questionId: q.id,
      sectionId: section.id,
      sectionTitle: section.title,
      path: resolvedPath,
      kind: q.kind,
      label: q.label,
      description: q.description,
      value: value ?? null,
      currentValue: value ?? null,
      options: q.options ? [...q.options] : undefined,
      required: isRequired,
      isAnswered: isQuestionAnswered(q, facts, targetScope),
      progress: {
        current: currentIdx > 0 ? currentIdx : 1,
        total: eligible.length || 1,
      },
      scope: targetScope.toArray(),
      question: q,
    };
  }
  return null;
}

/**
 * Builds the Master Review Tree from schema and canonical facts, supporting nested repeater items.
 * @param {IntakeSchema} schema
 * @param {Record<string, unknown>} facts
 * @param {ScopeStack} [rootScopeStack]
 * @returns {ReviewTree}
 */
export function buildReviewTree(schema, facts, rootScopeStack = new ScopeStack()) {
  let totalCount = 0;
  let completeCount = 0;
  let blockerCount = 0;

  const sectionNodes = [];

  for (const section of schema.sections || []) {
    const questionNodes = [];
    const questions = section.questions || [];
    let qIdx = 0;

    while (qIdx < questions.length) {
      const q = questions[qIdx];
      const scopeToken = q.scope || extractScopeToken(q.path);
      const repeater = scopeToken
        ? schema.repeaters?.find(
            (r) => r.scopeName === scopeToken || r.id === scopeToken || scopeToken === "current"
          )
        : null;

      if (repeater && (!rootScopeStack || !rootScopeStack.get(repeater.scopeName))) {
        const repeaterGroup = [q];
        let nextIdx = qIdx + 1;
        while (nextIdx < questions.length) {
          const nextQ = questions[nextIdx];
          const nextScope = nextQ.scope || extractScopeToken(nextQ.path);
          if (nextScope === scopeToken) {
            repeaterGroup.push(nextQ);
            nextIdx++;
          } else {
            break;
          }
        }

        const items = getAt(facts, repeater.collectionPath, rootScopeStack);
        if (Array.isArray(items) && items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const itemId =
              item?.id != null && item?.id !== ""
                ? String(item.id)
                : item?._id != null && item?._id !== ""
                ? String(item._id)
                : `${repeater.scopeName}_${i}`;

            const itemScope = rootScopeStack.push({
              name: repeater.scopeName,
              index: i,
              id: itemId,
            });

            for (const rq of repeaterGroup) {
              const isEligible = isQuestionEligible(rq, facts, itemScope);
              const nodeInstanceId = formatScopeInstanceId(rq.id, itemScope);

              if (!isEligible) {
                questionNodes.push({
                  id: nodeInstanceId,
                  questionId: rq.id,
                  kind: "question",
                  label: `${rq.label} (#${i + 1})`,
                  path: rq.path,
                  status: "not-applicable",
                  answered: false,
                  eligible: false,
                  scope: itemScope.toArray(),
                });
                continue;
              }

              const resolvedPath = resolvePath(rq.path, itemScope);
              const value = getAt(facts, resolvedPath);
              const answered = isQuestionAnswered(rq, facts, itemScope);

              let isRequired = true;
              if (rq.requiredWhen) {
                isRequired = evaluatePredicate(rq.requiredWhen, { facts, scope: itemScope });
              }

              totalCount++;
              if (answered) {
                completeCount++;
              } else if (isRequired) {
                blockerCount++;
              }

              questionNodes.push({
                id: nodeInstanceId,
                questionId: rq.id,
                kind: "question",
                label: `${rq.label} (#${i + 1})`,
                path: resolvedPath,
                value,
                scope: itemScope.toArray(),
                status: answered ? "complete" : "incomplete",
                answered,
                eligible: true,
              });
            }
          }
        }

        qIdx = nextIdx;
      } else {
        // Non-repeater question
        const isEligible = isQuestionEligible(q, facts, rootScopeStack);
        const nodeInstanceId = formatScopeInstanceId(q.id, rootScopeStack);

        if (!isEligible) {
          questionNodes.push({
            id: nodeInstanceId,
            questionId: q.id,
            kind: "question",
            label: q.label,
            path: q.path,
            status: "not-applicable",
            answered: false,
            eligible: false,
          });
          qIdx++;
          continue;
        }

        const resolvedPath = resolvePath(q.path, rootScopeStack);
        const value = getAt(facts, resolvedPath);
        const answered = isQuestionAnswered(q, facts, rootScopeStack);

        let isRequired = true;
        if (q.requiredWhen) {
          isRequired = evaluatePredicate(q.requiredWhen, { facts, scope: rootScopeStack });
        }

        totalCount++;

        if (answered) {
          completeCount++;
        } else if (isRequired) {
          blockerCount++;
        }

        questionNodes.push({
          id: nodeInstanceId,
          questionId: q.id,
          kind: "question",
          label: q.label,
          path: resolvedPath,
          value,
          scope: rootScopeStack.toArray(),
          status: answered ? "complete" : "incomplete",
          answered,
          eligible: true,
        });
        qIdx++;
      }
    }

    sectionNodes.push({
      id: section.id,
      kind: "section",
      label: section.title,
      title: section.title,
      status: questionNodes.some((n) => n.status === "incomplete") ? "incomplete" : "complete",
      children: questionNodes,
      questions: questionNodes,
      completedCount: questionNodes.filter((n) => n.status === "complete").length,
      eligibleCount: questionNodes.filter((n) => n.status !== "not-applicable").length,
    });
  }

  return {
    sections: sectionNodes,
    stats: {
      total: totalCount,
      complete: completeCount,
      completed: completeCount,
      totalEligible: totalCount,
      blockers: blockerCount,
    },
  };
}


// ==========================================
// Module: storage.js
// ==========================================
/**
 * @file storage.js
 * @description Pluggable persistence adapters (Memory and LocalStorage) for Theta.
 */

/**
 * @typedef {import('./contracts.js').IntakeState} IntakeState
 */

/**
 * @interface StorageAdapter
 */

/**
 * In-memory storage adapter for headless testing and non-browser environments.
 */
export class MemoryStorageAdapter {
  constructor(initialData = null) {
    this._data = initialData ? structuredClone(initialData) : null;
  }

  async load() {
    return this._data ? structuredClone(this._data) : null;
  }

  async save(state) {
    this._data = structuredClone(state);
  }

  async clear() {
    this._data = null;
  }
}

/**
 * LocalStorage persistence adapter for browser sessions.
 */
export class LocalStorageAdapter {
  /**
   * @param {string} key - LocalStorage key
   */
  constructor(key = "theta_intake_draft") {
    this.key = key;
  }

  async load() {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`[Theta LocalStorageAdapter] Error loading key '${this.key}':`, err);
      return null;
    }
  }

  async save(state) {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(this.key, JSON.stringify(state));
    } catch (err) {
      console.warn(`[Theta LocalStorageAdapter] Error saving key '${this.key}':`, err);
    }
  }

  async clear() {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.removeItem(this.key);
    } catch (err) {
      console.warn(`[Theta LocalStorageAdapter] Error clearing key '${this.key}':`, err);
    }
  }
}


// ==========================================
// Module: engine.js
// ==========================================
/**
 * @file engine.js
 * @description Core deterministic intake runtime engine for Theta.
 */







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


