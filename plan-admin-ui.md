# Branch plan — `feat/admin-ui-changes`

> **Status: implemented** (uncommitted), with a fourth change added after review — rating
> questions had no way to hold the media being rated (§4) — and two revisions after a UX review — the creation
> page is a one-click picker rather than a form (see §2), and ranking is done by dragging
> rather than by up/down buttons (see §1). Two additions found while working: attention checks
> are now rejected server-side on rating and ordering questions (their grading key cannot be
> expressed by those answers), and a trap duplicate whose type differs from its source is
> skipped with a warning instead of flagging the evaluator.

Three changes, planned against the code as it stands on this branch.

1. **Ordering questions** — a new question type where evaluators rank/order the given options.
2. **Test creation as a page** — `/tests/new` replaces the create dialog on `/tests`.
3. **Fewer attention checks** — auto-insertion becomes length-gated instead of one per test.

Decisions taken up front:

- Attention checks: length-gated, roughly 1 per 10 scored questions, never below 8 questions, capped at 2.
- Trap duplicates: **no change**. They are admin-authored only today (nothing auto-inserts them), so there is no frequency to reduce.
- Creation page: basics + blank-vs-template on one page, then route into the existing editor. Not a multi-step wizard.

---

## 1. Ordering question type

### Data model

`QuestionType` gains `ORDERING` (Prisma enum → migration). Everything else reuses what selection questions already have:

- Options live in `QuestionOption` exactly as for `SINGLE_SELECT` (label and/or media, `order` = the author's canonical order).
- The answer is stored in **`Answer.selectedOptions`**, reusing the existing `String[] @db.Uuid` column as an *ordered permutation* of the question's option IDs (Postgres arrays preserve order). No new column.

  *Why reuse:* every read path already loads `selectedOptions`, validation is nearly identical, and the migration stays to a single enum value. *Cost:* code that treats the column as a set must branch on question type — there are exactly three such places (quality service, results service, review screen), all listed below. A `orderedOptions` column is the alternative if that overloading is judged too subtle; it costs one nullable column and a second write path.

Add a schema comment on `Answer.selectedOptions` recording the dual meaning.

### Files to touch

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | `ORDERING` in `QuestionType`; comment on `Answer.selectedOptions` |
| `packages/database/prisma/migrations/…` | New migration (`ALTER TYPE "QuestionType" ADD VALUE 'ORDERING'`) via `pnpm db:migrate` |
| `packages/shared/src/constants.ts` | `QUESTION_TYPES` += `"ORDERING"`; `QUESTION_REWARD_WEIGHTS.ORDERING = 3` (more work than a single select) |
| `packages/shared/src/validation/question.ts` | No shape change needed (config is a free record); ordering config keys are `topLabel` / `bottomLabel` |
| `apps/api/src/routes/admin/tests.ts` | `validateQuestionShape`: `ORDERING` follows the selection branch — 2–10 options, each needs a label or media |
| `apps/api/src/routes/evaluator.ts` | `PUBLIC_CONFIG_KEYS.ORDERING = ["topLabel", "bottomLabel"]`; `validateAnswers` gets an `ORDERING` branch: the submitted array must be a full permutation of the question's options (every option exactly once) |
| `apps/evaluator/src/lib/test-types.ts` | Widen `Question["type"]`; `AnswerData` unchanged (ordering rides on `selectedOptionIds`) |
| `apps/evaluator/src/app/tests/[id]/question/[n]/page.tsx` | New `OrderingQuestion` renderer |
| `apps/evaluator/src/components/test-session-provider.tsx` | Hold the per-session presentation order so it survives back/forward navigation |
| `apps/evaluator/src/app/tests/[id]/review/page.tsx` | Render an ordering answer as a numbered list (currently only `RATING` gets a special case) |
| `apps/admin/src/app/tests/[id]/edit/page.tsx` | Question dialog: `ORDERING` in the type select; reuse the existing options editor; hide min/max-selections; show optional top/bottom anchor labels |
| `apps/admin/src/app/tests/[id]/preview/page.tsx` | Read-only ordering render |
| `apps/api/src/services/results.service.ts` | `OrderingAggregation` — average rank per option + per-position counts |
| `apps/admin/src/lib/admin-types.ts` + `src/components/results-view.tsx` | Mirror the aggregation type; render rank bars (shared by `/results` and `/report`) |
| `apps/api/src/services/quality.service.ts` | Order-sensitive comparison for ordering trap duplicates (see below) |
| `packages/database/prisma/seed.ts` | One sample ordering question so the type is exercised locally |

### Evaluator UX

- Options are presented **shuffled**, seeded once per session and stored in the session provider — otherwise the author's order is an anchor and "submit as-is" is a free pass.
- Reordering by dragging, built on pointer events so mouse and touch take the same path — no dnd library added. Rows swap live as the pointer crosses a neighbour's midpoint, and the dragged row follows the pointer via a transform.
- The drag starts from a full-height grip on the row rather than the row itself: a row can hold a video or audio player whose controls need those same presses, and on a phone a row-wide drag target would swallow the scroll gesture.
- The grip is also a focusable button that moves its row with the arrow keys, with an `aria-live` announcement — that is the keyboard path, so no visible up/down buttons are needed.
- `hasAnswer()` for `ORDERING` returns true only after the evaluator has actually moved something — a shuffled untouched list is a random answer, not an answer. Track a `touched` flag alongside the order in session state.

### Quality control interaction

`quality.service.ts` compares trap duplicates via `selectionKey`, which **sorts** option keys — correct for sets, wrong for orderings. Add an order-preserving key and use it when the question type is `ORDERING`; add `ORDERING` to `COMPARABLE_TRAP_TYPES`. The existing `sameOptionSet` guard still applies, so a mismatched trap is skipped with a warning rather than flagging the evaluator.

Attention-check auto-generation copies a source question's options into a `SINGLE_SELECT` check. Make the source picker prefer `SINGLE_SELECT`/`MULTI_SELECT` sources so an ordering question is not turned into a nonsense check.

---

## 2. Test creation as its own page

Today: `/tests` opens a `<Dialog>` holding title, description, a "Create Blank" button, and a template grid (`apps/admin/src/app/tests/page.tsx`).

### New route — `apps/admin/src/app/tests/new/page.tsx`

Choosing a starting point is all the page does. One click on a card creates the draft and opens
the editor — no title, description or cap collected first, because the editor asks for exactly
those fields on the very next screen and filling the same form twice is the friction this page
was supposed to remove.

- "← Back to tests" link + `PageHeader` ("Create test") with Cancel, matching the editor's header pattern.
- One card per starting point: "Blank test" plus each template, with its question count (derived from `structure.questions.length`). The clicked card reads "Opening editor…" while the request is in flight; errors show in an `Alert`.
- A blank test is created as `UNTITLED_TEST` ("Untitled test", shared from `@/lib/status`), and the editor selects the title field on arrival when a draft still carries that name — so naming it is the first thing waiting for the cursor.

### API adjustments

None. An earlier draft of this plan added `responseCap` to `createTestSchema` and title
overrides to `POST /admin/tests/from-template/:templateId`; the picker collects neither, so
both were reverted rather than left as unused surface.

### Cleanup on `/tests`

Delete the dialog and its state (`createDialogRef`, `title`, `description`, `templates`, `creating`, `openCreateDialog`, `createBlank`, `createFromTemplate`) and turn the header button into `<Link href="/tests/new">`. The close-test `ConfirmDialog` stays.

No nav change — creation stays reachable from the Tests page.

---

## 3. Fewer attention checks

### Today

`ensureAttentionCheck` (`apps/api/src/routes/admin/tests.ts:211`) runs on every DRAFT→ACTIVE transition and inserts exactly one attention check if the test has none — a 3-question test and a 40-question test get the same treatment.

### New policy

Constants in `packages/shared/src/constants.ts` so they are tunable in one place:

```ts
export const ATTENTION_CHECK_MIN_QUESTIONS = 8;   // below this, none at all
export const ATTENTION_CHECK_PER_QUESTIONS = 10;  // roughly one per this many
export const ATTENTION_CHECK_MAX = 2;             // hard ceiling
```

Desired count, over **scored** questions only (excluding existing attention checks and trap duplicates):

```
scored < 8            → 0
otherwise             → min(2, max(1, floor(scored / 10)))
```

So: 0–7 → none, 8–19 → 1, 20+ → 2.

### Implementation

Rename to `ensureAttentionChecks` and make it **idempotent by count**: count the checks already on the test (manual and auto alike), insert only `desired − existing`, never remove. This keeps repeated PAUSED→ACTIVE cycles from accumulating checks and lets an admin's manual checks satisfy the quota, matching today's "admin already handled it" behaviour.

When two are inserted, place them in different halves of the test and never adjacent, reusing the existing interior-position + order-shift logic (negative intermediates to dodge the `@@unique([testId, order])` collision).

### Admin visibility

Add a line to the editor's "Status & actions" card: *"N scored questions → M attention check(s) will be added on activation."* Admins currently have no way to know a question will appear that they did not write.

Reward maths needs no change — `calculateTestReward` already excludes checks and traps — but tests will get slightly shorter, which is the point.

Existing ACTIVE tests are untouched; the policy only applies at the next activation.

---

## 4. Media a question is *about* (added after review)

A rating question stores a `mediaType` but had nowhere to hold the media itself, and
`validateQuestionShape` bars rating questions from having options — so there was no way to
show an evaluator the thing they were rating. The seeded "Rate the emotional warmth of this
image" rendered a bare 1–5 scale.

`Question` gains a nullable `mediaId` → `Media` (migration `20260824000002_question_media`,
`ON DELETE SET NULL`, indexed). It is the question's subject, never selectable, and it applies
to every type: an image being rated, a clip being ranked, a picture a select question asks
about.

| Where | Behaviour |
|---|---|
| Editor dialog | Picker below the basics, labelled "Media to rate" (required) on a rating question and "Question media" (optional) elsewhere; appears once the media type is not TEXT. The type field itself is relabelled "Media type" for rating questions, where "Option media" was a lie. |
| `validateQuestionMedia` | Media must exist and match the declared type; a rating question on a file media type must have one, since it would otherwise show nothing. The Save button mirrors that rule so the round trip is not needed to learn it. |
| Evaluator | Rendered above the answer UI at a readable size — image capped at `max-h-96` and object-contain, video and audio with controls. |
| Preview / results / report | Same media shown, so a rating result is readable — a column of averages says nothing without the picture it refers to. |
| Seed | The four rating questions that declared `IMAGE` now carry their images. |

## Sequencing

1. **Creation page** — self-contained, no DB change, immediate UX win.
2. **Attention-check frequency** — API + constants + editor hint.
3. **Ordering questions** — migration first, then shared → API → evaluator → admin → results.

Each phase is independently shippable; 3 is the only one needing a migration.

## Verification

There is no automated test suite in the repo, so: `pnpm typecheck` and `pnpm lint` per phase, plus manual passes against a seeded DB —

- Create blank and from-template via `/tests/new`; confirm title/description survive the template path.
- Activate tests with 5 / 12 / 25 questions; confirm 0 / 1 / 2 checks, and that pausing and reactivating adds none.
- Build an ordering question, take it as an evaluator (shuffled, requires interaction), confirm the review screen, the report ranks, and an ordering trap duplicate flagging a changed order.
- Drag a row with a mouse, with a finger, and with the keyboard (tab to a grip, arrow keys); check that a row with video options still plays and that the page still scrolls on a phone.

## Open risks

- `ALTER TYPE … ADD VALUE` cannot run inside a transaction on older Postgres; verify the generated migration applies cleanly against a copy of production data.
- Reusing `selectedOptions` for ordering is invisible at the type level. The three type-branching sites must be right, or an ordering answer gets counted as a set — worth a focused review of that diff.
- Reducing attention checks slightly weakens flagging on short tests. The speed and idle checks in `quality.service.ts` still cover them; if flag rates drop noticeably, the floor is one constant away from changing.
