/**
 * @file dag.js
 * @description Static dependency graph compiler, topological analyzer, and instance-isolated path matcher for Theta Engine.
 */

import { extractPredicatePaths } from "./schema.js";
import { tokenizePath } from "./path.js";

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
