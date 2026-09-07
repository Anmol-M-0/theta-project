/**
 * @file projections.js
 * @description View model projections (Active Question & Master Review Tree) for Theta.
 */

import { getAt, resolvePath } from "./path.js";
import { evaluatePredicate, isPresent } from "./predicates.js";
import { ScopeStack } from "./scope.js";

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
    questionId: q.id,
    sectionId: currentItem.sectionId,
    sectionTitle: currentItem.sectionTitle,
    path: resolvedPath,
    kind: q.kind,
    label: q.label,
    description: q.description,
    value: value ?? null,
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
        questionId: q.id,
        sectionId: section.id,
        sectionTitle: section.title,
        path: resolvedPath,
        kind: q.kind,
        label: q.label,
        description: q.description,
        value: value ?? null,
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
          kind: "question",
          label: q.label,
          path: q.path,
          status: "not-applicable",
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
        kind: "question",
        label: q.label,
        path: resolvedPath,
        value,
        questionId: q.id,
        scope: rootScopeStack.toArray(),
        status: answered ? "complete" : "incomplete",
      });
    }

    sectionNodes.push({
      id: section.id,
      kind: "section",
      label: section.title,
      status: questionNodes.some((n) => n.status === "incomplete") ? "incomplete" : "complete",
      children: questionNodes,
    });
  }

  return {
    sections: sectionNodes,
    stats: {
      total: totalCount,
      complete: completeCount,
      blockers: blockerCount,
    },
  };
}
