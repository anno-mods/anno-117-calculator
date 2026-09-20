# Residual Code Review Findings

- **Branch:** feat/live-statistics-page
- **Head SHA at acceptance:** 91aba63d188582b7f28da78d3b3a7768920668f5
- **Source review:** ce-code-review (low-effort roster: correctness, project-standards, testing) against plan `docs/plans/2026-08-11-001-feat-live-statistics-island-collections-plan.md`, scoped to this session's 6 commits (bfb4bd3..91aba63) on top of the branch's prior tip (8483412).
- **Disposition:** Accepted and shipped without further changes (user decision).

Both P0/P1-equivalent findings from this review (row-object identity churn in `filteredRows`, and DOM checkbox desync on zero-guard no-op clicks) were fixed and covered by regression tests in commit 91aba63. The two items below were accepted as residuals.

## 1. `createCollection` whitespace-trim/duplicate-name behavior is undertested

- **Severity:** P2
- **File:** `src/statistics.ts` (`createCollection`, ~line 481)
- **Finding:** The code comment states that a name only cosmetically different from an existing collection's trimmed name (e.g. trailing spaces) is still allowed to duplicate, and that the *trimmed* form is what gets stored. The only duplicate-name test (`tests/computed/statistics-collections.spec.ts`, "creating a collection with a duplicate name succeeds under a distinct id") uses the byte-identical string `'Same Name'` twice — it never exercises `name.trim()` producing a match against an already-trimmed stored name, and no test asserts the stored name is actually trimmed.
- **Suggested fix:** Add a test creating `'Foo'`, then creating `'  Foo  '` against a different checked island, asserting both succeed under distinct ids and that `collections()[1].name === 'Foo'` (trimmed).

## 2. `deleteCollection(ALL_ISLANDS_COLLECTION_ID)` no-op guard is untested

- **Severity:** P3
- **File:** `src/statistics.ts` (`deleteCollection`, ~line 497)
- **Finding:** `deleteCollection` has an explicit early-return guard for the `ALL_ISLANDS_COLLECTION_ID` sentinel, described in the adjacent comment as "belt-and-suspenders" since the UI never renders a delete affordance for it. No test calls `deleteCollection` with that sentinel to verify the guard.
- **Suggested fix:** Add a test that activates "All Islands", calls `deleteCollection(ALL_ISLANDS_COLLECTION_ID)`, and asserts `activeCollectionId()` is unchanged and `collections()` is unaffected.
