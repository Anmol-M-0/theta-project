# Git Tagging, Semantic Versioning, and Release Policy

This document establishes the official specification for versioning, Git tagging, release immutability, and distribution lifecycle across the **Theta Engine** project.

---

## 1. Executive Principles

1. **Deterministic Versioning**: Theta Engine follows [Semantic Versioning 2.0.0](https://semver.org/) (`MAJOR.MINOR.PATCH`).
2. **Annotated & Verifiable Tags**: All production Git releases use annotated tags (`git tag -a`) or cryptographically signed tags (`git tag -s`). Lightweight tags are strictly forbidden for releases.
3. **Tag Immutability**: Once a release tag is pushed to the remote repository, it is **permanently immutable**. Tags must never be deleted, overwritten, or re-pointed (`git push --force` for tags is blocked). If a release contains defects, the project must **fix forward** with a subsequent patch.
4. **Isolated & Explicit Pushes**: Release tags must be pushed explicitly (`git push origin vX.Y.Z`). Blind tag pushes (`git push --tags`) are prohibited to prevent publishing unvetted scratch tags.
5. **Unified Registry Sync**: Git tags serve as the single authoritative trigger for CI/CD publication to [npm](https://www.npmjs.com/package/theta-engine), [JSR](https://jsr.io/@anmol/theta-engine), and GitHub Releases.

---

## 2. Tag Naming Specification

### 2.1 Release Tags: `vMAJOR.MINOR.PATCH`

All production release tags **MUST** start with a lowercase `v` prefix followed by the SemVer triad:

```text
v0.5.0
v0.5.1
v1.0.0
```

> [!NOTE]
> The `v` prefix is strictly used for **Git references** (tags, release branches). Package manifests (`package.json`, `jsr.json`) use the clean SemVer number without `v` (`"version": "0.5.0"`).

### 2.2 Pre-Release & Release Candidate Tags

Pre-release tags append a hyphen and a dot-separated identifier sequence:

| Channel | Format | Example | Purpose |
| :--- | :--- | :--- | :--- |
| **Alpha** | `vX.Y.Z-alpha.N` | `v0.6.0-alpha.1` | Experimental architectural iterations |
| **Beta** | `vX.Y.Z-beta.N` | `v0.6.0-beta.2` | Feature-complete, undergoing contract testing |
| **Release Candidate** | `vX.Y.Z-rc.N` | `v1.0.0-rc.1` | Final soak testing prior to general availability |

---

## 3. SemVer 2.0.0 Application to Theta Engine

Theta Engine is a deterministic schema-driven intake runtime. Its compatibility surface spans not just JavaScript function signatures, but schema specifications, DAG topologies, and state machine invariants (see [`docs/INVARIANTS.md`](./INVARIANTS.md)).

```
                       SEMANTIC VERSION TRIAD
                               vX.Y.Z
                                │ │ │
          ┌─────────────────────┘ │ └─────────────────────┐
          ▼                       ▼                       ▼
     MAJOR (X)               MINOR (Y)               PATCH (Z)
  • Incompatible Schema   • New Question Kinds    • Invariant Bugfixes
  • Invariant Semantics   • New Store Methods     • Performance Speedup
  • Transition Contract   • Opt-in Schema Flags   • Doc / Typing Fixes
  • Breaking AST/DAG      • Additive Adapters     • Test Fixture Updates
```

### 3.1 MAJOR (`X.0.0` or breaking changes in `0.X.0`)

A version increment is **MAJOR** if it introduces any incompatible change to:
- **Schema AST & Compilation Rules**: Modifying required schema keys, changing predicate operator semantics, or altering branch ownership syntax (Invariant 5).
- **State Machine & Transition Semantics**: Altering how `COMMIT_ANSWER`, `SET_FACT`, or repeater mutations transition state (Invariants 1, 4, 6, 7).
- **Cascading Invalidation Invariants**: Modifying topological pruning order or fixed-point pruning behaviors (Invariants 2, 9).
- **Public Engine Contracts**: Removing or renaming methods on `IntakeEngine` (`getActiveQuestion`, `dispatch`, `getReviewTree`, etc.).
- **Store Adapter Contracts**: Breaking changes to `createStoreAdapter`, `subscribe`, `observe`, or `toReactStore`.
- **Persistence & Serialization**: Incompatible changes to `IntakeState` serialization format or storage adapter write interfaces (Invariant 8).

### 3.2 MINOR (`0.X.0` or `X.Y.0`)

A version increment is **MINOR** if it introduces backward-compatible additions:
- **New Question Kinds**: Adding support for new question types (e.g. `signature`, `matrix`) without altering existing kinds.
- **Additive Engine Capabilities**: New query methods, inspectability hooks, or diagnostic rules.
- **New Framework Adapters**: Non-breaking adapter enhancements or reactive observation helpers.
- **Backward-Compatible Schema Extensions**: Adding optional properties to question or branch specifications with safe defaults.
- **Automated Migration Utilities**: Adding schema/state migration scripts where older data formats continue to parse cleanly without manual intervention.

### 3.3 PATCH (`X.Y.Z`)

A version increment is **PATCH** strictly for backward-compatible bug and stability fixes:
- **Invariant Restoration**: Fixing edge cases where an implementation bug departed from documented invariants in `docs/INVARIANTS.md`.
- **Engine Performance**: Internal DAG optimizations, faster path tokenization, or memoization improvements with zero observable semantic changes.
- **TypeScript Typings**: Correcting inaccurate declaration files (`.d.ts`) without altering runtime behavior.
- **Documentation & Playground**: Updates to guides, comments, or bundled playground assets.

> [!IMPORTANT]
> **Determinism Invariant for Patches**:
> In Theta Engine, deterministic behavior is part of the API contract. If for identical `(Schema, Facts, Command)` the engine previously produced state $S_A$ and now produces state $S_B$, this is **not** a patch unless $S_A$ was demonstrably violating documented invariants.

### 3.4 0.x Release Protocol

Under strict SemVer, `0.y.z` permits arbitrary breaking changes. **Theta Engine explicitly rejects this relaxation**:
- `0.X.0` (minor bump) may contain breaking changes, but **MUST** be accompanied by:
  1. A detailed Migration Guide in `docs/`.
  2. Compatibility matrices and upgrade notes.
  3. Migration tooling where practical (e.g. `src/migration.js`).
- `0.X.Y` (patch bump) is **strictly non-breaking** and safe for automatic downstream consumption.

---

## 4. Git Tagging Standards & Operations

### 4.1 Annotated Tags Requirement

Lightweight tags (`git tag <name>`) store only the commit SHA with no author, date, or message. **All Theta Engine release tags must be annotated tags**:

```bash
# Standard Annotated Tag
git tag -a v0.5.0 -m "release: v0.5.0 - Store adapter, codegen, diagnostics, and invariant fuzzer"

# Cryptographically Signed Tag (Recommended)
git tag -s v0.5.0 -m "release: v0.5.0 - Store adapter, codegen, diagnostics, and invariant fuzzer"
```

### 4.2 Standard Annotation Message Format

Tag messages should follow a structured format:

```text
release: v0.5.0 - [One-line summary]

### Highlights
- feat: universal reactive store adapter with React useSyncExternalStore
- feat: automated TypeScript contract codegen
- feat: bidirectional schema migration pipeline
- test: property-based invariant fuzzer across random mutations

### Invariants
- Invariants 1-10 verified with 100% test pass rate
```

### 4.3 Verifying Tags Locally

Before pushing, inspect the tag metadata and associated commit:

```bash
# Verify tag metadata, message, and target commit
git show v0.5.0

# Verify cryptographic signature
git tag -v v0.5.0
```

### 4.4 Explicit Pushing

Never use `git push --tags`. Always push the specific release tag:

```bash
# Push only the verified release tag
git push origin v0.5.0
```

---

## 5. Tag Immutability & Emergency Correction Protocol

### 5.1 The Immutability Guarantee

Once a tag `vX.Y.Z` is pushed to GitHub:
- The tag **MUST NEVER** be deleted from the remote repository.
- The tag **MUST NEVER** be moved to a different commit.
- Downstream packagers (npm, JSR, unpkg, cdnjs) mirror tags irrevocably; moving a tag desynchronizes source from binaries and breaks cryptographic provenance.

### 5.2 What to Do If a Release Contains Bugs

**Always Fix Forward:**
1. Author the fix on `main`.
2. Increment the patch version in `package.json` (`0.5.0` $\to$ `0.5.1`).
3. Commit, tag (`v0.5.1`), and push (`git push origin v0.5.1`).
4. If the bug in `0.5.0` is critical or causes data loss, deprecate the package version on npm without deleting the Git tag:
   ```bash
   npm deprecate theta-engine@0.5.0 "Critical defect in branch pruning; upgrade immediately to 0.5.1"
   ```

### 5.3 Accidental Mis-tagged Commits (Pre-Publication Window)

If a tag is created locally and has **not** yet been pushed:
```bash
# Safe to delete local unpushed tag
git tag -d v0.5.0
```

If a tag was mistakenly pushed but CI publication has **not** yet run, repository administrators may delete the remote tag only in extraordinary operational emergencies:
```bash
# Remote tag deletion (Emergency admin only - only before registry publish)
git push origin --delete v0.5.0
```
*(Once published to npm or JSR, registry immutability prevents re-publishing the same version number anyway.)*

---

## 6. CI/CD & Multi-Registry Publishing Workflow

```
                  Local Workspace
                        │
             1. npm test && npm run build
             2. Bump version in package.json & jsr.json
             3. Commit & tag: git tag -a vX.Y.Z
             4. git push origin vX.Y.Z
                        │
                        ▼
                 GitHub Actions
           (Workflow: on: push: tags: 'v*')
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
 1. Full Matrix   2. npm Publish   3. JSR Publish
    (Node, Bun,      (OIDC with       (OIDC Token
     Deno Tests)      Provenance)      Exchange)
        │               │               │
        └───────────────┼───────────────┘
                        ▼
              4. GitHub Release
          (Changelog & Tag Asset Notes)
```

1. **Tag Filter**: Release automation triggers strictly on Git tag pushes matching `refs/tags/v*`.
2. **Version Parity Check**: The CI workflow verifies that `tag.replace('v', '') === package.json.version === jsr.json.version`. If there is a mismatch, the workflow aborts with an error before publishing.
3. **npm Provenance**: Published packages include verifiable build provenance attested by GitHub OIDC.
4. **JSR Synchrony**: JSR package is published in the same workflow run from the exact same commit.

---

## 7. Retroactive Tagging for Existing Milestones

When formalizing the tagging policy for an existing repository, historic milestones can be retroactively tagged on their respective commit hashes:

```bash
# 1. Verify working directory is clean
git status

# 2. Identify the commit representing v0.5.0 release boundary
# Commit 0022f29: feat(v0.5): release Theta Engine v0.5 with store adapter...
git checkout 0022f29

# 3. Run full test suite on the target commit to certify stability
npm test

# 4. Create annotated tag on that commit
git checkout main
git tag -a v0.5.0 0022f29 -m "release: v0.5.0 - Theta Engine v0.5 release with store adapter, codegen, history, migrations, and diagnostics"

# 5. Push the tag explicitly
git push origin v0.5.0
```

---

## 8. Pre-Release Verification Checklist

Prior to creating and pushing any release tag, complete this checklist:

| Category | Verification Gate | Status |
| :--- | :--- | :---: |
| **Repo Hygiene** | Working tree is clean (`git status` reports 0 changes) | [ ] |
| **Version Alignment** | `package.json` version matches intended release | [ ] |
| **Version Alignment** | `jsr.json` version matches intended release | [ ] |
| **Tests** | All unit tests pass cleanly (`npm test`) | [ ] |
| **Build & Types** | Build succeeds with zero TypeScript errors (`npm run build`) | [ ] |
| **Invariants** | All 10 mathematical invariants pass verification | [ ] |
| **Documentation** | `README.md` and documentation reflects newly added APIs | [ ] |
| **Git Tag** | Annotated tag (`git tag -a`) created with descriptive message | [ ] |
| **Verification** | Tag inspected with `git show <tag>` | [ ] |
| **Push** | Pushed via explicit `git push origin <tag>` | [ ] |
