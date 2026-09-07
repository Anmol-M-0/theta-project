# Theta Engine

<p align="center">
  <strong>Deterministic schema-driven intake runtime and progressive question engine.</strong><br>
  Zero runtime dependencies. Pure ESM. Universal across Node.js, Deno, and Bun.
</p>

<p align="center">
  <a href="https://github.com/Anmol-M-0/theta-project/actions/workflows/ci.yml"><img src="https://github.com/Anmol-M-0/theta-project/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <a href="https://www.npmjs.com/package/theta-engine"><img src="https://img.shields.io/npm/v/theta-engine.svg" alt="npm version"></a>
  <a href="https://bundlephobia.com/package/theta-engine"><img src="https://img.shields.io/badge/dependencies-0-success.svg" alt="Zero Dependencies"></a>
  <a href="https://github.com/Anmol-M-0/theta-project/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/runtimes-Node%20%7C%20Bun%20%7C%20Deno%20%7C%20Browser-blueviolet.svg" alt="Runtimes: Node, Bun, Deno, Browser">
</p>

---

## 30-Second Quickstart

```javascript
import { createThetaEngine } from "theta-engine";

const schema = {
  id: "property_intake",
  version: 1,
  sections: [
    {
      id: "meta",
      title: "Property Identification",
      questions: [
        {
          id: "prop_type",
          sectionId: "meta",
          path: "property.type",
          kind: "card",
          label: "What type of property is being conveyed?",
          options: [
            { value: "apartment", label: "Residential Apartment" },
            { value: "plot", label: "Vacant Plot" }
          ]
        },
        {
          id: "floor_num",
          sectionId: "meta",
          path: "property.apartment.floor",
          kind: "number",
          label: "On which floor is the unit located?",
          visibleWhen: { field: "property.type", operator: "equals", value: "apartment" }
        }
      ]
    }
  ],
  branches: [
    {
      id: "prop_type_branch",
      discriminatorPath: "property.type",
      ownedPaths: {
        apartment: ["property.apartment"],
        plot: ["property.plot"]
      }
    }
  ]
};

// 1. Initialize synchronous engine
const engine = createThetaEngine({ schema });

// 2. Active question is dynamically derived
console.log(engine.getActiveQuestion().label);
// => "What type of property is being conveyed?"

// 3. Commit an answer atomically
engine.dispatch({ type: "COMMIT_ANSWER", questionId: "prop_type", value: "apartment" });

// 4. Conditional question activates automatically
console.log(engine.getActiveQuestion().label);
// => "On which floor is the unit located?"

// 5. Inspect Master Review Tree anytime
console.log(engine.getReviewTree().stats);
// => { totalEligible: 2, completed: 1, remaining: 1, percentComplete: 50 }
```

---

## Why Theta?

Traditional form builders model intake as a **sequence of screens or form steps**:
- ❌ Hardcoded step numbers (`step === 4`) that break when legal rules change.
- ❌ Fragmented form state divergent from final document models.
- ❌ Stale zombie data lingering when discriminators change (e.g. changing Company $\rightarrow$ Individual leaves orphan CIN data).
- ❌ Modal dialog traps for nested repeaters (e.g. Sellers $\rightarrow$ Authorized Directors $\rightarrow$ Signatories).

**Theta models intake as a pure projection over canonical facts:**

```text
       Declarative Schema
              │
              ▼
   [ Predicate Evaluator ]
              │
              ▼
    Canonical Facts JSON  ◄── The Draft is Truth (single source of truth)
              │
              ▼
   Derived Question Queue ◄── Resolved dynamically; no mutable arrays
              │
              ▼
   [ Atomic Transaction ] ◄── Branch invalidation cleans dead facts in same tick
              │
     ┌────────┴────────┐
     ▼                 ▼
Intake View       Review Tree
```

---

## What Theta Is Not

To preserve its architectural integrity, Theta maintains strict boundaries:
- **Not a UI component library**: Theta has no DOM, HTML, CSS, or framework bindings. Render with React, Vue, Svelte, Lit, Terminal TUI, or Vanilla JS.
- **Not a database or ORM**: Theta manages in-memory canonical facts during drafting. Persistence is decoupled via pluggable storage adapters.
- **Not a document renderer**: Theta outputs pristine, validated JSON facts to downstream legal templating engines (e.g. docx, PDF, LaTeX).

> **Theta is a deterministic state-transition runtime, not a UI framework.**

---

## Core Architectural Invariants

### 1. The Draft is Truth
There is only one canonical state: the `facts` JSON dictionary. Input components do not maintain independent state; they project directly over canonical paths.

### 2. The Queue is Derived
There are no step arrays or wizard counters. The active question is dynamically resolved by finding the first eligible, unanswered question in schema order.

### 3. Atomic Branch Invalidation
When a discriminator changes (e.g. entity type switches from `Company` to `Individual`), all dependent paths (`cin`, `registrationDate`, `directors[]`) are calculated and purged **atomically in the same transaction**.

### 4. The Scope Stack
Repeaters (multiple Sellers, Purchasers, Partners) are handled via an immutable `ScopeStack`. Target paths use contextual tokens (such as `parties.$current.name`) rather than hardcoded array indices.

### 5. Deterministic Synchronous Execution
The engine transition pipeline is **strictly synchronous** (`engine.dispatch(command)`). Given the same initial state and command sequence, Theta produces identical state across all platforms.

---

## TypeScript Contracts

Theta is authored in pure, standards-compliant ESM JavaScript, with full TypeScript definitions generated directly from JSDoc contracts:

```typescript
export interface ThetaEngine {
  /** Returns an immutable snapshot of canonical facts, cursor, and scope */
  getState(): EngineState;

  /** Dispatches an atomic state mutation or navigation command */
  dispatch(command: Command): DispatchResult;

  /** Returns the dynamic projection of the active question, or null if complete */
  getActiveQuestion(): QuestionProjection | null;

  /** Returns the full document review tree with section statistics */
  getReviewTree(): ReviewTree;

  /** Updates the active ScopeStack frame */
  setScope(scopeFrames: ScopeFrame[]): void;

  /** Subscribes to synchronous state updates. Returns unsubscribe function */
  subscribe(listener: (state: EngineState) => void): () => void;
}

export type Command =
  | { type: "COMMIT_ANSWER"; questionId: string; value: any; path?: string }
  | { type: "DELETE_ANSWER"; questionId: string; path?: string }
  | { type: "ADD_REPEATER_ITEM"; collectionPath: string; defaultItem?: any }
  | { type: "REMOVE_REPEATER_ITEM"; collectionPath: string; index: number }
  | { type: "JUMP_TO_QUESTION"; questionId: string; scopeIndex?: number }
  | { type: "SET_SCOPE"; scopeFrames: ScopeFrame[] };
```

---

## Cross-Runtime Compatibility

Theta is verified continuously across the modern JavaScript ecosystem with zero polyfills:

| Runtime | Versions Verified | Test Runner |
| :--- | :--- | :--- |
| **Node.js** | `18.x`, `20.x`, `22.x` (LTS & Current) | Native `node:test` |
| **Bun** | `1.x` (Latest) | Native `bun test` |
| **Deno** | `2.x` & `canary` | Native `deno test` |
| **Modern Browsers** | Chrome, Firefox, Safari, Edge | Native ES Modules |

---

## Frequently Asked Questions

#### Does Theta require React or a specific framework?
No. Theta has zero UI dependencies. It runs seamlessly in React, Vue, Svelte, solid, web components, vanilla JS, or server-side CLI tools.

#### Does Theta have runtime dependencies?
No. Theta has exactly **0 runtime dependencies**.

#### Can Theta run in the browser?
Yes. Theta is authored as modern standard ES modules. Because it does not use Node-specific internals, it runs natively in browser contexts, web workers, and edge functions.

#### How does Theta prevent zombie facts?
Through **Atomic Branch Invalidation**. When you register a branch in the schema with `ownedPaths`, changing the discriminator automatically schedules and deletes stale facts within the same transaction tick.

---

## Verification & Testing

Theta maintains a comprehensive headless test suite verifying immutability, path tokenization, predicate evaluation, repeaters, branch invalidation, and end-to-end engine workflows:

```bash
# Run unit tests natively
npm test

# Run tests in watch mode
npm run test:watch
```

---

## License

[MIT](LICENSE) © [Anmol Maniyar](https://github.com/Anmol-M-0)
