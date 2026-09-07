/**
 * @file diagnostics.js
 * @description Static schema analyzer, proof-based linter, and diagnostic verification for Theta Engine.
 */

import { extractPredicatePaths } from "./schema.js";
import { pathsOverlap, buildDependencyDAG } from "./dag.js";

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
