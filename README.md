# Theta Engine

> **Declarative schema-driven intake runtime and progressive question engine.**
> Built with zero external dependencies. Universal (Node.js & Modern Browsers).

---

## 1. Architectural Philosophy

Theta is designed from first principles for complex, multi-party legal and transactional drafting workflows (such as Indian Conveyance Deeds, Agreements to Sell, and Legal Notices):

1. **The Draft is Truth**: There is only one canonical state: the `facts` JSON object. UI inputs are projections over canonical paths, never separate divergent state.
2. **Questions are Views**: Questions are declarative schema records defining target `path`, input `kind`, `label`, and `visibleWhen` eligibility predicates.
3. **The Queue is Derived**: There are no hardcoded step numbers or mutable wizard arrays. The active question is dynamically resolved by finding the first eligible, unanswered question in schema order.
4. **The Scope Stack**: Repeaters (e.g. multiple Sellers, Purchasers, Partners, Directors) are managed cleanly using an immutable `ScopeStack`. Paths can reference contextual tokens such as `$current` or `$party`.
5. **Atomic Branch Invalidation**: When a discriminator changes (e.g., party type switches from `Company` to `Individual`), all stale conditional facts (`cin`, `incorporationDate`, `directors[]`) are calculated and purged atomically in the same transaction.
6. **Zero Dependencies**: Pure ES modules with native JavaScript data structures. Tested with Node.js native test runner (`node:test`).

---

## 2. Architecture Overview

```
                     Declarative Schema (Data)
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                          THETA ENGINE                         │
│                                                               │
│   Schema ──▶ Predicate Evaluator ──▶ Question Resolver        │
│                     │                       │                 │
│                     ▼                       ▼                 │
│                Scope Manager          Branch Manager          │
│                     │                       │                 │
│                     └───────────┬───────────┘                 │
│                                 ▼                             │
│                          Canonical State                      │
│                                 │                             │
│                         Transaction Layer                     │
│                                 │                             │
│                    ┌────────────┴────────────┐                │
│                    ▼                         ▼                │
│            Active Question              Review Tree           │
│               Projection                 Projection           │
└───────────────────────────────────────────────────────────────┘
                     │                         │
                     ▼                         ▼
            Single-Question UI          Master Review UI
```

---

## 3. Directory Layout

```
theta/
├── package.json          # ESM package config & exports
├── .gitignore
├── README.md             # Documentation & API specs
├── src/
│   ├── index.js          # Public API barrel export
│   ├── contracts.js      # Type definitions & JSDoc contracts
│   ├── engine.js         # ThetaEngine core orchestrator & factory
│   ├── path.js           # Path tokenizer, scope resolver, immutable getAt/setAt/deleteAt
│   ├── predicates.js     # Pure predicate evaluator (equals, in, exists, all, any, not)
│   ├── scope.js          # Immutable ScopeStack & repeater collection helpers
│   ├── branches.js       # Discriminator tracking & atomic branch invalidation planner
│   ├── transaction.js    # Read-Validate-Plan-Apply-Commit atomic transaction pipeline
│   ├── projections.js    # Active question resolution & Master Review Tree compiler
│   └── storage.js        # Pluggable storage adapters (MemoryStorageAdapter, LocalStorageAdapter)
└── tests/
    ├── path.test.js        # Path tokenization & immutable structural copying tests
    ├── predicates.test.js  # Predicate evaluations across primitives & objects
    ├── scope.test.js       # Scope stack pushing, popping & repeater tests
    ├── branches.test.js    # Discriminator branch invalidation tests
    └── engine.test.js      # End-to-end question flow, jump edits & review projections
```

---

## 4. Quick Start

### Installation

Import directly via ESM in Node or modern bundlers:

```javascript
import { createThetaEngine, MemoryStorageAdapter, LocalStorageAdapter } from "theta-engine";
```

### Basic Example

```javascript
import { createThetaEngine } from "theta-engine";

const schema = {
  id: "conveyance_deed",
  version: 1,
  sections: [
    {
      id: "property_meta",
      title: "Property Details",
      questions: [
        {
          id: "prop_type",
          sectionId: "property_meta",
          path: "property.type",
          kind: "card",
          label: "Select the property classification:",
          options: [
            { value: "apartment", label: "Residential Apartment" },
            { value: "plot", label: "Vacant Plot" },
            { value: "commercial", label: "Commercial Unit" }
          ],
          validation: { required: true }
        },
        {
          id: "floor_number",
          sectionId: "property_meta",
          path: "property.apartmentDetails.floor",
          kind: "number",
          label: "Floor number:",
          visibleWhen: {
            field: "property.type",
            operator: "equals",
            value: "apartment"
          }
        }
      ]
    }
  ],
  branches: [
    {
      id: "prop_type_branch",
      discriminatorPath: "property.type",
      ownedPaths: {
        apartment: ["property.apartmentDetails"],
        plot: ["property.plotDetails"],
        commercial: ["property.commercialDetails"]
      }
    }
  ]
};

// Initialize engine
const engine = createThetaEngine({ schema });

// 1. Get the current active question
console.log(engine.getActiveQuestion());
// => { id: 'prop_type', label: 'Select the property classification:', ... }

// 2. Commit an answer
engine.dispatch({
  type: "COMMIT_ANSWER",
  questionId: "prop_type",
  value: "apartment"
});

// 3. Engine dynamically resolves the next eligible question
console.log(engine.getActiveQuestion());
// => { id: 'floor_number', label: 'Floor number:', ... }

// 4. Inspect the Master Review Tree anytime
const reviewTree = engine.getReviewTree();
console.log(reviewTree.stats);
// => { totalEligible: 2, completed: 1, remaining: 1, percentComplete: 50 }
```

---

## 5. Public API Reference

### `createThetaEngine({ schema, initialState, storage })`
Creates a stateful Theta engine instance.
- `schema`: Declarative intake schema object.
- `initialState`: Optional initial canonical state `{ facts, cursor, scope, revision }`.
- `storage`: Optional `StorageAdapter` (`MemoryStorageAdapter` or `LocalStorageAdapter`).

### Engine Methods
- **`getState()`**: Returns the immutable canonical state `{ facts, cursor, scope, revision }`.
- **`dispatch(command)`**: Dispatches an atomic command.
  - `COMMIT_ANSWER`: `{ type: 'COMMIT_ANSWER', questionId, value, path? }`
  - `DELETE_ANSWER`: `{ type: 'DELETE_ANSWER', questionId, path? }`
  - `ADD_REPEATER_ITEM`: `{ type: 'ADD_REPEATER_ITEM', collectionPath, defaultItem? }`
  - `REMOVE_REPEATER_ITEM`: `{ type: 'REMOVE_REPEATER_ITEM', collectionPath, index }`
  - `JUMP_TO_QUESTION`: `{ type: 'JUMP_TO_QUESTION', questionId, scopeIndex? }`
  - `SET_SCOPE`: `{ type: 'SET_SCOPE', scopeFrames }`
- **`getActiveQuestion()`**: Returns the projection of the current active question or `null` if completed.
- **`getReviewTree()`**: Returns the hierarchical review projection `{ sections, stats }` with completion status for every item.
- **`setScope(scopeFrames)`**: Updates the active scope stack for repeaters.
- **`subscribe(listener)`**: Subscribes to state updates. Returns an `unsubscribe` function.

---

## 6. Testing

Theta includes a comprehensive headless test suite executed with Node.js built-in test runner:

```bash
npm test
```

For file-watching during development:

```bash
npm run test:watch
```

---

## 7. License

MIT
