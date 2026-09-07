/**
 * @file index.js
 * @description Public exports for the Theta Intake Engine.
 */

export { createThetaEngine } from "./engine.js";
export { ScopeStack, addRepeaterItem, removeRepeaterItem } from "./scope.js";
export { tokenizePath, resolvePath, getAt, setAt, deleteAt } from "./path.js";
export { evaluatePredicate, deepEqual, isPresent } from "./predicates.js";
export { planInvalidations, applyInvalidations } from "./branches.js";
export { commitFactTransaction, deleteFactTransaction } from "./transaction.js";
export {
  isQuestionAnswered,
  isQuestionEligible,
  getEligibleQuestions,
  resolveActiveQuestion,
  buildQuestionProjectionById,
  buildReviewTree,
} from "./projections.js";
export { MemoryStorageAdapter, LocalStorageAdapter } from "./storage.js";
