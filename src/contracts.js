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
