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
