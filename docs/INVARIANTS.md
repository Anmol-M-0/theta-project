# Mathematical & Architectural Invariants of Theta Engine

This document formalizes the non-negotiable invariants of the **Theta Engine** runtime. Every future modification, feature addition, and optimization must rigorously maintain these guarantees.

---

## Invariant 1: Canonical Fact Purity
> **"There is no hidden mutable form state separate from the canonical document state."**

- The engine state consists solely of:
  - `facts`: The canonical, minimal, serializable tree of domain facts.
  - `revision`: A strictly monotonic integer counter.
- UI concerns (such as focused input, validation errors, active question projection, and progress metrics) are **pure projections** $P(S, \text{Schema})$ computed on demand, never persisted in canonical state.

---

## Invariant 2: Inactive Branch Fact Non-Existence
> **"$\forall \text{ branch } B \in \text{Schema}: \neg \text{isActive}(B, \text{facts}) \implies \forall p \in B.\text{ownedPaths}, \text{getAt}(\text{facts}, p) = \text{undefined}$"**

- When a branch transitions to or is inactive, all paths declared under its ownership are permanently purged from facts.
- **Cascading Invalidation**: Invalidation is evaluated to a mathematical fixed point. If purging branch $A$'s facts causes branch $B$ to become inactive, $B$'s owned facts are purged in the same atomic transaction.

---

## Invariant 3: Repeater Identity Stability
> **"$\text{id} = \text{identity}, \quad \text{index} = \text{position}$"**

- Every repeater collection item possesses an immutable identifier (`id`).
- Deleting item $i$ shifts subsequent indices for layout, but preserves the persistent identities of all surviving items. Questions scoped to surviving items retain their identity without data crossover.

---

## Invariant 4: Single-Transaction Atomicity & Determinism
> **"$S' = T(S, C)$ is atomic, synchronous, and pure."**

- Fact mutations, explicit invalidations, and cascading branch invalidations execute together inside an isolated transaction.
- Intermediate inconsistent states are never observable by engine subscribers.
- Given state $S$ and command $C$, the transition $T(S, C)$ is purely deterministic and referentially transparent.

---

## Invariant 5: Fail-Fast Schema Compilation
> **"The runtime executes only against verified, pre-indexed compiled schemas."**

- Raw schemas are validated and compiled upfront into indexed lookup tables (`questionsById`, `sectionsById`, `branchesById`, `repeatersById`, `branchDependencies`).
- Duplicate identifiers, dangling prerequisites, malformed predicates, or invalid question kinds throw immediately during schema initialization, never at runtime during user intake.

---

## Invariant 6: Semantic Command Validation vs Raw Mutation
> **"`COMMIT_ANSWER` enforces semantic validation; `SET_FACT` provides raw mutation."**

- User-facing intake commands (`COMMIT_ANSWER`) evaluate question-level validation contracts prior to state commit. If validation fails, state remains unchanged and the revision does not increment.
- Programmatic data-loading commands (`SET_FACT`) operate directly at the transaction layer.

---

## Invariant 7: Linear Revision Monotonicity
> **"$\forall \text{ successful mutations } S_t \to S_{t+1}: S_{t+1}.\text{revision} = S_t.\text{revision} + 1$"**

- Every committed state mutation increments the revision number by exactly 1.
- No mutation can occur without an increment, and no revision jump occurs without a committed mutation.

---

## Invariant 8: Durability Isolation & Write Ordering
> **"In-memory state transitions are synchronously atomic; persistence is serialized in strict monotonic order."**

- Storage adapter persistence writes are queued and executed in exact chronological order of state revisions.
- Storage failures or delays never corrupt the in-memory canonical state machine.


---

## Invariant 9: Directed Acyclic Dependency & Topological Invalidation
> **"$\forall (A, B) \in \text{BranchGraph}, A \to B \implies \text{index}(A) < \text{index}(B)$ in $\text{topologicalOrder}$."**

- Branches may only depend on facts owned upstream in the static schema graph.
- Circular branch dependencies ($\text{hasCycle} = \text{true}$) are rejected fail-fast during schema compilation.
- Branch invalidation transitively cascades strictly downstream in topological order: deactivating branch $A$ evaluates and reconciles downstream branches $B, C, \dots$ to their fixed-point inactive state in a single deterministic pass.

---

## Invariant 10: Reactive Transaction Delta & Repeater Instance Isolation
> **"$\forall \text{ concrete items } i \neq j, \quad \text{mutation}(\text{collection}[i].x) \cap \text{dependency}(\text{collection}[j].x) = \emptyset$."**

- Reactive engine subscribers receive structured event payloads representing the committed transaction boundary: `{ type, state, revision, changedPaths, invalidatedPaths, dirtyQuestions }`.
- Concrete repeater instance paths (e.g. `parties[0].pan` vs `parties[1].pan`) maintain strict isolation during incremental dirty-checking; only explicit wildcard patterns (`parties[*].pan`) or parent collection mutations span multiple instances.
- Incremental state transitions with DAG invalidation are formally equivalent to full cold evaluation: $\text{Incremental}(S_0, \vec{C}) \equiv \text{ColdRebuild}(S_0, \vec{C})$.
