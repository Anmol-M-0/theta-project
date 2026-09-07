/**
 * @file schema.js
 * @description Fail-fast schema validator, indexer, and compilation pipeline for Theta.
 */

import { buildDependencyDAG } from "./dag.js";

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
