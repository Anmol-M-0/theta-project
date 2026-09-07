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
 * @description Core types and schema contracts for the Theta Engine.
 * Theta is a zero-dependency, standalone schema-driven intake runtime.
 */

/**
 * @typedef {string | number | boolean | null | FactValue[] | { [key: string]: FactValue }} FactValue
 */

/**
 * @typedef {Record<string, FactValue>} FactState
 */

/**
 * @typedef {Object} IntakeState
 * @property {FactState} facts - Canonical document fact model
 * @property {number} revision - Monotonically increasing state version
 */

/**
 * @typedef {'text' | 'number' | 'currency' | 'date' | 'select' | 'radio' | 'checkbox' | 'card' | 'repeater'} QuestionKind
 */

/**
 * @typedef {Object} OptionDefinition
 * @property {string | number} value
 * @property {string} label
 * @property {string} [description]
 * @property {string} [hint]
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
 * @property {(value: unknown, state: IntakeState) => true | string} [validate] - Custom validator function
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
 * @property {() => Record<string, unknown>} createItem - Factory for empty item
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
 * @property {string} [id] - Optional entity id
 */

/**
 * @typedef {Object} FlowCursor
 * @property {string} questionId
 * @property {ScopeFrame[]} scopeStack
 * @property {string} [returnTo]
 */

/**
 * @typedef {Object} QuestionProjection
 * @property {string} questionId
 * @property {string} sectionId
 * @property {string} sectionTitle
 * @property {string} path
 * @property {QuestionKind} kind
 * @property {string} label
 * @property {string} [description]
 * @property {unknown} value
 * @property {OptionDefinition[]} [options]
 * @property {boolean} required
 * @property {boolean} isAnswered
 * @property {{ current: number, total: number }} progress
 * @property {ScopeFrame[]} scope
 */

/**
 * @typedef {Object} ReviewNode
 * @property {string} id
 * @property {'section' | 'question' | 'repeater' | 'repeater-item'} kind
 * @property {string} label
 * @property {string} [path]
 * @property {unknown} [value]
 * @property {'complete' | 'incomplete' | 'not-applicable'} status
 * @property {string} [questionId]
 * @property {ScopeFrame[]} [scope]
 * @property {ReviewNode[]} [children]
 */

/**
 * @typedef {Object} ReviewTree
 * @property {ReviewNode[]} sections
 * @property {{ total: number, complete: number, blockers: number }} stats
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
 * @param {PathToken[]} tokens
 * @param {import('./scope.js').ScopeStack} [scopeStack]
 * @returns {PathToken[]}
 */
export function resolveTokens(tokens, scopeStack) {
  return tokens.map((token) => {
    if (token.type !== "scope") return token;

    if (!scopeStack) {
      throw new Error(`Cannot resolve scope token '$${token.value}' without an active ScopeStack`);
    }

    const scopeName = String(token.value);
    const frame = scopeName === "current" ? scopeStack.current() : scopeStack.get(scopeName);

    if (!frame) {
      throw new Error(`Scope token '$${scopeName}' not found in active ScopeStack`);
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
 * @param {unknown} root
 * @param {string | PathToken[]} pathOrTokens
 * @param {import('./scope.js').ScopeStack} [scopeStack]
 * @returns {unknown}
 */
export function getAt(root, pathOrTokens, scopeStack) {
  if (root == null) return undefined;
  const rawTokens = Array.isArray(pathOrTokens) ? pathOrTokens : tokenizePath(pathOrTokens);
  const tokens = resolveTokens(rawTokens, scopeStack);

  let current = root;
  for (const token of tokens) {
    if (current == null) return undefined;

    if (token.type === "key") {
      if (typeof current !== "object") return undefined;
      current = current[token.value];
    } else if (token.type === "index") {
      if (!Array.isArray(current)) return undefined;
      current = current[token.value];
    }
  }

  return current;
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

    const token = tokens[tokenIdx];
    const isLast = tokenIdx === tokens.length - 1;

    if (token.type === "index") {
      if (!Array.isArray(node)) return node;
      const idx = Number(token.value);
      if (idx < 0 || idx >= node.length) return node;

      if (isLast) {
        // Delete item at index
        const copy = [...node];
        copy.splice(idx, 1);
        return copy;
      }

      const copy = [...node];
      copy[idx] = remove(copy[idx], tokenIdx + 1);
      return copy;
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


// ==========================================
// Module: branches.js
// ==========================================
/**
 * @file branches.js
 * @description Branch ownership tracking and atomic invalidation planner for Theta.
 */



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
 * Sets fact -> Calculates & applies branch invalidations -> Increments revision.
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

  return {
    state: {
      facts: finalFacts,
      revision: (currentState.revision || 0) + 1,
    },
    changedPaths: [path],
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
  const finalFacts = deleteAt(oldFacts, path, scopeStack);

  return {
    state: {
      facts: finalFacts,
      revision: (currentState.revision || 0) + 1,
    },
    changedPaths: [path],
    invalidatedPaths: [],
  };
}


// ==========================================
// Module: projections.js
// ==========================================
/**
 * @file projections.js
 * @description View model projections (Active Question & Master Review Tree) for Theta.
 */




/**
 * @typedef {import('./contracts.js').IntakeSchema} IntakeSchema
 * @typedef {import('./contracts.js').QuestionDefinition} QuestionDefinition
 * @typedef {import('./contracts.js').QuestionProjection} QuestionProjection
 * @typedef {import('./contracts.js').ReviewTree} ReviewTree
 * @typedef {import('./contracts.js').ReviewNode} ReviewNode
 * @typedef {import('./contracts.js').FlowCursor} FlowCursor
 */

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
 * Flattens all eligible questions from the schema, resolving repeaters if applicable.
 * @param {IntakeSchema} schema
 * @param {Record<string, unknown>} facts
 * @param {ScopeStack} [rootScopeStack]
 * @returns {Array<{ question: QuestionDefinition, sectionId: string, sectionTitle: string, scopeStack: ScopeStack }>}
 */
export function getEligibleQuestions(schema, facts, rootScopeStack = new ScopeStack()) {
  const result = [];

  for (const section of schema.sections) {
    for (const question of section.questions) {
      if (isQuestionEligible(question, facts, rootScopeStack)) {
        result.push({
          question,
          sectionId: section.id,
          sectionTitle: section.title,
          scopeStack: rootScopeStack,
        });
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
  const currentIdx = eligible.findIndex((item) => item.question.id === q.id) + 1;

  const resolvedPath = resolvePath(q.path, currentScope);
  const value = getAt(facts, resolvedPath);

  // Check if required
  let isRequired = true;
  if (q.requiredWhen) {
    isRequired = evaluatePredicate(q.requiredWhen, { facts, scope: currentScope });
  }

  return {
    id: q.id,
    questionId: q.id,
    sectionId: currentItem.sectionId,
    sectionTitle: currentItem.sectionTitle,
    path: resolvedPath,
    kind: q.kind,
    label: q.label,
    description: q.description,
    value: value ?? null,
    currentValue: value ?? null,
    options: q.options ? [...q.options] : undefined,
    required: isRequired,
    isAnswered: false,
    progress: {
      current: currentIdx,
      total,
    },
    scope: currentScope.toArray(),
  };
}

/**
 * Builds a specific question projection by ID. Useful for one-click edit jumps.
 * @param {IntakeSchema} schema
 * @param {Record<string, unknown>} facts
 * @param {string} questionId
 * @param {ScopeStack} [scopeStack]
 * @returns {QuestionProjection | null}
 */
export function buildQuestionProjectionById(schema, facts, questionId, scopeStack = new ScopeStack()) {
  for (const section of schema.sections) {
    const q = section.questions.find((item) => item.id === questionId);
    if (q) {
      const resolvedPath = resolvePath(q.path, scopeStack);
      const value = getAt(facts, resolvedPath);
      const eligible = getEligibleQuestions(schema, facts, scopeStack);
      const currentIdx = eligible.findIndex((item) => item.question.id === q.id) + 1;

      let isRequired = true;
      if (q.requiredWhen) {
        isRequired = evaluatePredicate(q.requiredWhen, { facts, scope: scopeStack });
      }

      return {
        id: q.id,
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
        isAnswered: isQuestionAnswered(q, facts, scopeStack),
        progress: {
          current: currentIdx > 0 ? currentIdx : 1,
          total: eligible.length || 1,
        },
        scope: scopeStack.toArray(),
      };
    }
  }
  return null;
}

/**
 * Builds the Master Review Tree from schema and canonical facts.
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

  for (const section of schema.sections) {
    const questionNodes = [];

    for (const q of section.questions) {
      const isEligible = isQuestionEligible(q, facts, rootScopeStack);

      if (!isEligible) {
        questionNodes.push({
          id: q.id,
          questionId: q.id,
          kind: "question",
          label: q.label,
          path: q.path,
          status: "not-applicable",
          answered: false,
          eligible: false,
        });
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
        id: q.id,
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
 * @description Main Theta Intake Engine factory and state orchestrator.
 */





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
      case "COMMIT_ANSWER": {
        const { questionId, value } = command;
        let targetPath = command.path;

        if (!targetPath && questionId) {
          const allQuestions = schema.sections.flatMap((s) => s.questions);
          const qDef = allQuestions.find((q) => q.id === questionId);
          if (qDef) {
            targetPath = qDef.path;
          }
        }

        if (!targetPath) {
          throw new Error(`Cannot commit answer: questionId "${questionId}" or path must be specified`);
        }

        const res = commitFactTransaction(
          schema,
          state,
          targetPath,
          value,
          command.explicitInvalidates || [],
          scopeStack
        );
        state = res.state;

        if (activeCursorId === questionId) {
          activeCursorId = null;
          returnTo = null;
        }

        persistAsync();
        notify("commit_answer");
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
        let targetPath = command.path;
        if (!targetPath && questionId) {
          const allQuestions = schema.sections.flatMap((s) => s.questions);
          const qDef = allQuestions.find((q) => q.id === questionId);
          if (qDef) targetPath = qDef.path;
        }
        if (!targetPath) {
          throw new Error(`Cannot delete answer: questionId "${questionId}" or path must be specified`);
        }
        const res = deleteFactTransaction(schema, state, targetPath, scopeStack);
        state = res.state;
        persistAsync();
        notify("delete_answer");
        return { ok: true, state: getState(), changedPaths: res.changedPaths };
      }
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


