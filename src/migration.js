/**
 * @file migration.js
 * @description Pure versioned schema and state migration pipeline for Theta Engine.
 */

import { getAt, setAt, deleteAt } from "./path.js";

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
