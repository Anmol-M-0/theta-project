/**
 * @file projections.js
 * @description Pure derived views and question resolvers for Theta Engine.
 */

import { getAt, resolvePath, tokenizePath } from "./path.js";
import { evaluatePredicate, isPresent } from "./predicates.js";
import { ScopeStack } from "./scope.js";

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
