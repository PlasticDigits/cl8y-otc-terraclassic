# ADR 0001: Remove catch-all CODEOWNERS

## Status

Accepted ([#3](https://git.cl8y.com/code/cl8y-otc-terraclassic/issues/3)).
Root `CODEOWNERS` was removed on `main` via merged PR
[#3](https://git.cl8y.com/code/cl8y-otc-terraclassic/pulls/3). Standing
docs (this ADR, architecture **H3**, README pointers) land on branch
`issue/3`. Post-merge plant-check (**S3**) is tracked on
[#4](https://git.cl8y.com/code/cl8y-otc-terraclassic/issues/4), not on `#3`.

Overview (product tree, merge gate, pipeline path/layout):
[`architecture.md`](../architecture.md). Do not copy that table here. Local
invariant IDs are **H3-*** (this ticket). `code/hello` architecture **H15**
and `code/BASE_Buster` architecture **H3** are other trees’ copies of the
same flags, not this repo’s issue number.

Design branch `cac-design-issue-3` is transport only; it is not the product
PR. Do not open a design-only PR.

## Outcome

Delete the catch-all `CODEOWNERS` so Forgejo does not plant **official**
review requests on every change. Merge to `main` stays: pull request,
Woodpecker context `ci/woodpecker/pr/woodpecker`, SHA-pinned `Do: merge`, no
direct push, no `force_merge`.

**Land** is S1+S2 on PR [#3](https://git.cl8y.com/code/cl8y-otc-terraclassic/pulls/3)
(or a successor with a real combined diff). Merging that PR **closes `#3`**.
**Leftover-complete** (S3: dedicated post-merge plant-check PR with a
**non-empty**, **non-WIP** diff) is tracked on a follow-up issue / leftover
checklist that survives that merge. S3 is not a close gate for `#3`.

This is a product-tree copy of the pattern named by
[cl8y-forgejo#48](https://git.cl8y.com/PlasticDigits/cl8y-forgejo/issues/48).
The canary is `code/hello` [#15](https://git.cl8y.com/code/hello/issues/15)
(still open; `CODEOWNERS` still on hello `main`). The **landed product
pattern** is
[code/cl8y-dex-terraclassic#1309](https://git.cl8y.com/code/cl8y-dex-terraclassic/issues/1309)
(CODEOWNERS-only delete, pre-existing green WP). This repo already posts
`ci/woodpecker/pr/woodpecker` ([#1](https://git.cl8y.com/code/cl8y-otc-terraclassic/pulls/1));
it does **not** need a new pipeline on the deletion PR. Protection on
`code/cl8y-otc-terraclassic` `main` already matches the intended flags
(GET `updated_at` 2026-09-21T07:28:46Z; **H3-8** / **H3-9** / **H3-2** /
**H3-3** / **H3-5**). #3 does not re-roll protection, does not implement
CAC autoland, and does not deploy the OTC contract.

## Context

`8a42dda` (2026-09-02) added root `CODEOWNERS`:

```
.* @code/maintainers
```

Forgejo uses Go regular expressions, not GitHub globs, and searches **root**,
`docs/CODEOWNERS`, `.gitea/CODEOWNERS`, and `.forgejo/CODEOWNERS`. Combined
with historical `block_on_official_review_requests`, every non-WIP PR that
touches a matching path requests team **maintainers** (CODEOWNERS line
`@code/maintainers`; PR JSON `requested_reviewers_teams[].name` is
`maintainers`, org `code`, team id 4). That team’s usual member is the PR
author, so self-approve is 422 and merge is 405. CAC `RECOMMEND: ACCEPT` is
not a Forgejo `APPROVED` review.
[cl8y-agent-control#388](https://git.cl8y.com/PlasticDigits/cl8y-agent-control/issues/388)
skipped the deadlock; it did not remove this file or this repo’s protection.

[#1](https://git.cl8y.com/code/cl8y-otc-terraclassic/pulls/1) landed
[`.woodpecker.yml`](../../.woodpecker.yml) (`NO_CI_MISSING_WOODPECKER`:
gitleaks + Alpine `tree`) so the required context can go green.
[cl8y-forgejo ADR 0003](https://git.cl8y.com/PlasticDigits/cl8y-forgejo/src/branch/main/docs/adr/0003-community-forge-and-woodpecker.md)
item 8 (“CODEOWNERS plus protected `main`”) is amended on the forge repo for
the **official-review** half only. This tree’s root README is still product
deploy docs and does not currently claim CODEOWNERS is the trusted-PR gate;
S2 still adds an explicit **H3** pointer so later agents do not re-add
`.* @code/maintainers`.

The issue body links cl8y-forgejo
[`docs/INVARIANTS.md`](https://git.cl8y.com/PlasticDigits/cl8y-forgejo/src/branch/main/docs/INVARIANTS.md);
that file is not in this tree. Do not invent a local copy.

Live proof that the file still plants requests (this pass):

| PR | Role | Plant |
| --- | --- | --- |
| [#3](https://git.cl8y.com/code/cl8y-otc-terraclassic/pulls/3) | This delete (open, `draft: false`) | `requested_reviewers_teams` = `maintainers`; `official: true` `REQUEST_REVIEW` id 201 at 2026-09-21T07:40:17Z |
| [#2](https://git.cl8y.com/code/cl8y-otc-terraclassic/pulls/2) | Renovate onboarding (open) | same team; `official: true` `REQUEST_REVIEW` id 131 at 2026-09-20T23:49:19Z |
| [#1](https://git.cl8y.com/code/cl8y-otc-terraclassic/pulls/1) | Woodpecker stub (merged) | leftover same team; `official: true` `REQUEST_REVIEW` id 66 at 2026-09-07T09:12:06Z |

Those leftovers are **disqualified** as “no new plant” evidence. Protection
GET on `main` has official-review **block** off (**H3-8**), so leftover
requests must not be treated as merge blockers.

Draft implementation (not this design commit):
`bb37af1dcbc2e8d43ac03f241a6ad8656593969b` on
`chore/remove-catchall-codeowners` deletes the six-line file and nothing
else (`changed_files=1`). Combined commit status on that SHA is `success`
with `ci/woodpecker/pr/woodpecker` “Pipeline was successful”. Live `draft`
is currently `false` and `mergeable` is `true`. That head is **not**
mergeable under this ADR until standing docs and the root README pointer
are on the **same** branch. Convert #3 to **draft** before any merge so
delete-only cannot close the tracker.

Drain comments on #3 (`no occupying job…`; `default autoland requires tip
ACCEPT (#77)`) are
[cl8y-agent-control#429](https://git.cl8y.com/PlasticDigits/cl8y-agent-control/issues/429)
/ CAC, not a #3 failure. They are why delete-only has not landed yet; they
are not permission to merge it.

## Non-goals

- Forgejo protection JSON / `apply_repo_policy.py` / migrate
  `_ensure_codeowners` / templates
  ([cl8y-forgejo#48](https://git.cl8y.com/PlasticDigits/cl8y-forgejo/issues/48)).
- CAC autoland predicates, occupying jobs, or `DrainSkip::OfficialReview`
  cleanup ([cl8y-agent-control#429](https://git.cl8y.com/PlasticDigits/cl8y-agent-control/issues/429),
  leftover of #388).
- Dismissing reviewers from the controller (forbidden substitute in #388).
- Path-specific CODEOWNERS, a second maintainer, or `required_approvals: 1`.
- Weakening or expanding Woodpecker (no scanner upgrade, no fake commit
  statuses, no rename of `.woodpecker.yml`), adding `force_merge`, or
  enabling direct `main`.
- CosmWasm contract behavior, frontend UX, mainnet instantiate, deploy
  scripts, Coolify, UUID/token changes
  ([agent-control #297](https://git.cl8y.com/PlasticDigits/cl8y-agent-control/issues/297)).
- Renovate onboarding ([#2](https://git.cl8y.com/code/cl8y-otc-terraclassic/pulls/2)).
- A local `docs/INVARIANTS.md` (issue body cites the forge copy).
- Editing `autonomy.rs` / HMAC, self-approval, or a founder card for this
  ordinary design.

## Decision

1. **Delete** root `CODEOWNERS`. Do not leave an empty or comments-only file
   (Forgejo still parses it).
2. **Do not add** `docs/CODEOWNERS`, `.gitea/CODEOWNERS`, or
   `.forgejo/CODEOWNERS`. After land, `test -f` fails on all four paths.
   None of those paths may contain a reviewer rule for any pattern (not
   only `.*`).
3. **Keep** the merge gate in [`architecture.md`](../architecture.md) **H3**.
   On the product PR, keep existing README deploy tables and add one or two
   sentences plus links to this ADR and architecture **H3**. Do not claim
   maintainers review every change. Do not expand the deploy snippet.
   Architecture-only is **not** sufficient.
4. **One product PR** whose diff is: delete `CODEOWNERS` + ADR 0001 +
   architecture + `docs/README.md` index pointer + root README pointer.
   `cac-design-issue-3` is transport; do not merge it to `main` and do not
   open it as the product PR.
5. **Leave** already-planted official requests on open PRs (including #3
   and #2). They are non-blocking under **H3-8** / **H3-9**. Do not dismiss
   them from CAC. Human dismiss is optional leftover, not AC. They do not
   count as “no new plant.”
6. **Do not** PATCH branch protection from this repository.
7. **Split land from leftover-complete.** PR `#3` (or successor) is S1+S2
   only. S3 lives on a follow-up issue opened before that merge (plus the
   leftover checklist below). Require a **dedicated** post-merge plant-check
   PR that **changes at least one file**, is **non-WIP**, and is opened
   **after** the delete is on `main`. Do not accept `#3`’s plant, `#2`’s
   plant, `#1`’s leftover plant, or “the next natural PR.” A no-op dedicated
   PR is not evidence: `.*` matches every path, and Forgejo does not plant
   on a no-op even if `CODEOWNERS` is still on `main` (dex#1309 no-op
   warning). A draft/WIP follow-up is not evidence (Forgejo skips
   CODEOWNERS on WIP).

## Component / state / interface changes

| Surface | Change |
| --- | --- |
| `CODEOWNERS` (root) | Remove file. |
| `docs/CODEOWNERS`, `.gitea/CODEOWNERS`, `.forgejo/CODEOWNERS` | Must remain absent (no empty file). |
| Forgejo PR review interface | After land, a **dedicated** non-WIP plant-check PR against `main` that **changes at least one file** must not get an official CODEOWNERS team request. `requested_reviewers_teams` from this file becomes empty for those new PRs. |
| Branch protection API | No write from this ticket. Operator GET must still match architecture **GET-required** (**H3-2**, **H3-3**, **H3-5**, **H3-8**, **H3-9**). Observed rows are do-not-touch. |
| `.woodpecker.yml` | Unchanged. Already posts `ci/woodpecker/pr/woodpecker`. |
| `.gitignore` | Unchanged. `docs/` is already tracked. |
| `docs/architecture.md`, `docs/adr/0001-remove-catchall-codeowners.md` | Added on the design branch; land with S1+S2. |
| `docs/README.md` | Index pointer at architecture + ADR 0001 (product diagram moves to architecture; do not keep a second mermaid). |
| Root README | Mandatory on the deletion PR: one pointer that merge is **H3** (PR + Woodpecker + no direct `main`); CODEOWNERS is not the trusted-merge story. Link ADR 0001 / architecture. Keep the deploy table (`columbus-5` / code id `11448`). |
| `contracts/`, `frontend/`, `code/maintainers` team | Unchanged. The team may keep existing; it simply is not planted as official review. |

No runtime contract, schema, LCD, or HTTP API change.

## Affected invariants

| ID | Kind | Rule |
| --- | --- | --- |
| **H3-1** | Non-GET | `test -f` fails on `CODEOWNERS`, `docs/CODEOWNERS`, `.gitea/CODEOWNERS`, and `.forgejo/CODEOWNERS`. Absence, not “file exists but is not requesting reviewers.” File `@code/maintainers` / JSON team `maintainers` are the same leftover plant. |
| **H3-2** | GET-required | `enable_push=false` on `main`. |
| **H3-3** | GET-required | `enable_status_check=true` and required context `ci/woodpecker/pr/woodpecker`. |
| **H3-4** | Non-GET | Merge is SHA-pinned `Do: merge`. Never document or use `force_merge`. Not a protection field; omit from GET matching. |
| **H3-5** | GET-required | `block_on_rejected_reviews` stays true. An explicit REJECT still blocks. |
| **H3-6** | Non-GET | No Coolify/Woodpecker secrets on `pull_request`. This tree does not grow a deploy step from #3. On-chain OTC deploy stays #297. |
| **H3-7** | Non-GET | This tree does not expand CAC merge/deploy/spend/custody policy. |
| **H3-8** | GET-required | `block_on_official_review_requests=false`. Leftover official requests on #3/#2 are non-blocking. |
| **H3-9** | GET-required | `required_approvals=0`. |

GET-observed flags (`block_on_outdated_branch`, `dismiss_stale_approvals`,
`apply_to_admins`) are listed in architecture only. They have no
close-criterion IDs. #3 must not PATCH them.

## Alternatives

| Option | Why not |
| --- | --- |
| Keep file, rely on `block_on_official_review_requests=false` | Requests still plant on every non-WIP PR (see #3/#2); drain noise; Renovate/agent PRs look like they need a human stamp; templates can re-teach the old gate. |
| Replace `.*` with path owners | No second reviewer exists; same 405/422 if official-review is ever turned on; out of scope. |
| Add a second maintainer | Founder ops, not this implement. |
| Dismiss official requests from CAC | Forbidden by #388 as a substitute for policy reversal. |
| Direct-push the delete to `main` | Violates **H3-2**. File deletes go through a PR (already [#3](https://git.cl8y.com/code/cl8y-otc-terraclassic/pulls/3)). |
| Empty or comments-only CODEOWNERS | Forgejo still parses it. Absence is the contract. |
| Wait for `code/hello` canary merge before this delete | Sister pattern, not a local iid. This repo’s protection is already rolled; the file still plants. hello#15 is still open. |
| Cite hello#15 as a landed product delete | The landed pattern is dex#1309. |
| Leave ADR only on `cac-design-issue-3` | Standing docs never reach `main`; later agents re-add `.* @code/maintainers`. |
| Merge live #3 as delete-only (S1 without S2) | **H3-1** true, standing docs / README pointer false; later agents have no “do not re-add” contract. Live head is green and `draft: false` — that is the trap. |
| Close #3 only after a later PR proves no new plant | Merge of #3 closes the tracker; waiting for the follow-up before merge never produces it. |
| Add a new Woodpecker file / rename `.yml` → `.yaml` | Context already posts. A second file under `.woodpecker/<other>.yaml` would post the wrong context. |
| Treat `#3`/`#2`/`#1` plants or an empty-diff follow-up as S3 | Merge closes `#3` before leftover-complete. A dedicated **non-empty non-WIP** post-merge PR is the evidence. |

## Complexity added / removed

**Removed:** catch-all official-review robot on every diff; operator dismiss
step; false “CODEOWNERS is the trusted-PR gate” story if later docs grow one.

**Added:** a small standing doc (this ADR + architecture **H3**) plus a
README pointer so later agents do not re-add `.* @code/maintainers` as a
merge requirement; a leftover checklist that survives merge of `#3`. No new
services, jobs, flags, scanners, or contract surfaces. No `.gitignore`
exceptions (unlike Foundry trees).

## Migration

1. Protection is already migrated (forge #48 execute on this repo,
   `updated_at` 2026-09-21T07:28:46Z). Re-GET at merge; do not PATCH.
2. Before merging the deletion PR, open a follow-up **leftover** issue that
   owns S3 (dedicated **non-empty non-WIP** plant-check PR). Merging
   [#3](https://git.cl8y.com/code/cl8y-otc-terraclassic/pulls/3) closes that
   number; S3 must not live only there.
3. Combine onto the existing product head, then merge **one** PR (see
   slices). Design branch `cac-design-issue-3` is **not** that PR. Today
   `chore/remove-catchall-codeowners` is delete-only; a delete-only merge
   is not land.
4. Open PRs created while the file existed (#3, #2) may still show an
   official team `maintainers` request. Non-blocking under **H3-8**. No bulk
   dismiss required to close #3. Disqualified as leftover-complete evidence.
5. Do not restore the file from `docs/templates/CODEOWNERS` in cl8y-forgejo;
   that template is owned by #48.

## Observability

Relative reads. Do not log tokens, hosts, RPC keys, or protection-script
inventories.

**Protection (close criterion 4 / test 3).**
`GET /api/v1/repos/code/cl8y-otc-terraclassic/branch_protections` — pass iff
the `main` rule equals architecture **GET-required** for `enable_push`,
`enable_status_check`, `status_check_contexts`, `required_approvals`,
`block_on_official_review_requests`, and `block_on_rejected_reviews`. Fail
if any of those five IDs differ. Do **not** treat observed flags or **H3-4**
as GET-match fields. This design pass already saw a matching 2xx GET
(`updated_at` 2026-09-21T07:28:46Z); merge still re-reads for drift. A green
`tree` step does not satisfy this read.

**Plant-check (dedicated post-merge PR, leftover-complete).**

- The PR must be opened **after** the delete is on `main`, must be
  **non-WIP**, and must **change at least one file** (non-empty
  `changed_files` / diff vs `main`).
- `GET /api/v1/repos/code/cl8y-otc-terraclassic/pulls/{n}` — pass iff
  `requested_reviewers_teams` is empty.
- `GET /api/v1/repos/code/cl8y-otc-terraclassic/pulls/{n}/reviews` — pass iff
  there is no new `official: true` `REQUEST_REVIEW` from team `maintainers`.

`{n}` is that dedicated plant-check PR. PR `#3`’s existing official request
does not pass. PR `#2`’s plant does not pass. PR `#1`’s leftover plant does
not pass. “The next natural PR” does not pass. An empty-diff or WIP
dedicated PR does not pass.

**CI (land).** Woodpecker context `ci/woodpecker/pr/woodpecker` must be
present and successful on the **combined** product-PR head (already true on
delete-only `bb37af1`; must still be true after S2 lands). Drain comments
such as `drain skip: no occupying job…` and `default autoland requires tip
ACCEPT (#77)` are **#429** / CAC, not a #3 failure. If autoland waits on
#429, an operator still SHA-pins `Do: merge` (**H3-4**).

## Failure modes

| Mode | Handling |
| --- | --- |
| File deleted on a branch but still on `main` | New non-WIP PRs keep planting official review until the product PR merges. Expected until land. |
| Live #3 stays `draft: false` on delete-only `bb37af1` | Combined status is already green; ACCEPT would close `#3` without standing docs. Convert to draft before combining. |
| Copy left in `docs/`, `.gitea/`, or `.forgejo/` (including empty/comments-only) | Forgejo still loads the first existing path and may plant. Land fails **H3-1**; delete those paths too (none exist on current `main`). Standing `docs/adr/` and `docs/architecture.md` are not CODEOWNERS. |
| S1 (delete-only) merges without S2 | **H3-1** true, README/ADR/architecture absent from `main`. Forbidden. |
| cl8y-forgejo migrate/apply re-copies a template | Sister-repo race ([cl8y-forgejo#48](https://git.cl8y.com/PlasticDigits/cl8y-forgejo/issues/48) `_ensure_codeowners`). Out of this slice. If a later apply re-adds the file, delete again via PR; never direct-push `main`. |
| Official request leftover on #3 or #2 | Non-blocking (**H3-8**). Optional human dismiss. Not a rollback signal. Not leftover-complete evidence. |
| Treating merge of `#3` as leftover-complete | Merge closes `#3` before S3. Use the leftover issue / checklist. |
| Plant-check PR has empty diff | False-pass: Forgejo does not plant on a no-op even if `CODEOWNERS` remains. Fail S3; open a new dedicated PR that changes at least one file. |
| WIP/draft follow-up used as “no new plant” | Forgejo skips CODEOWNERS on WIP. Invalid. Use a non-WIP PR into `main`. |
| Protection silently reverted to official-review true | Merge 405 returns. Out of this repo; re-apply via forge policy, do not `force_merge`. Not proven by gitleaks green. |
| `enable_push` flipped true | **H3-2** regression. Refuse. |
| Re-adding CODEOWNERS “for safety” in a follow-up | Violates **H3-1**. Reviewers must reject unless a new ADR allowlists path owners. |
| `.woodpecker/<other>.yaml` added or `.woodpecker.yml` deleted | Wrong or missing context; **H3-3** fails. Do not touch the pipeline in this slice. |
| CAC autoland waits on #429 | Operator `Do: merge` still closes #3. Do not implement occupying-job cleanup here. |

## Ordered implementation slices

| Slice | Work | Mergeable? | Depends on |
| --- | --- | --- | --- |
| **S0** | This design on `cac-design-issue-3` (ADR 0001 + architecture **H3** + `docs/README.md` index). Transport only. | No. Do not open or merge as a product PR. | None in `code/cl8y-otc-terraclassic`. |
| **S1** | Delete root `CODEOWNERS`. Confirm the other three paths are absent. Live head `bb37af1` on `chore/remove-catchall-codeowners`. | **Draft-only** until S2 is on the same branch. Not a landable slice. Convert live #3 to `draft` (it is currently `draft: false`) before any merge. | S0 accepted. |
| **S2** | Same branch as S1: standing docs + `docs/README.md` index + root README pointer (deploy table kept; do not expand). No Woodpecker / contract / frontend / deploy edits. Open the leftover issue that will own S3. | Only as the **combined** product PR with S1. | S1 on the same head. |
| **Product PR** | **One** PR: [#3](https://git.cl8y.com/code/cl8y-otc-terraclassic/pulls/3) (`chore/remove-catchall-codeowners`) whose `git diff origin/main...HEAD` is delete + ADR 0001 + architecture + `docs/README.md` index + root README pointer. Merging this PR **closes #3**. | Yes, once S1+S2 are on the head, rebased, Woodpecker green. | S0 accepted; S1+S2 combined. |
| **S3** | Leftover-complete “no new plant” (tests item 4). New iid **or** operator attestation **after** #3 is closed. Not a close gate for #3. | N/A | Product PR merged to `main`. |

PR `#3` (or successor) ships **S1+S2** only.

Sister repos (not slices of #3, not local `DEPS`): forge #48
protection+templates; CAC #429 autoland occupying job; hello#15 open canary;
dex#1309 landed pattern.

### Combine step (S1+S2 onto the product vehicle)

Do this on `chore/remove-catchall-codeowners`, not on `cac-design-issue-3`:

1. Mark [#3](https://git.cl8y.com/code/cl8y-otc-terraclassic/pulls/3) **draft**
   so delete-only `bb37af1` cannot land.
2. Fetch published design: `origin/cac-design-issue-3` (this ADR,
   `docs/architecture.md`, `docs/README.md` index).
3. Copy or cherry-pick those S0 paths onto `chore/remove-catchall-codeowners`
   (keep the CODEOWNERS delete from `bb37af1`).
4. Edit root README only as specified in decision 3 (one/two sentences +
   links; Structure table and Deployed contracts table stay).
5. Open the leftover issue that owns S3.
6. Rebase onto current `origin/main` (`block_on_outdated_branch` is
   observed-true; do not PATCH it off). Push the product branch.
7. Ready the PR only when `git diff origin/main...HEAD` is exactly the
   five-part product diff. Then merge with SHA-pinned `Do: merge`.

## Tests

In-repo CI cannot GET branch protection. Existing Cargo / Vitest /
Playwright tests are unrelated and must not be rewritten for this ticket.
Scanners that already run must still pass on the product PR. Do not add a
contract test solely for file absence.

1. **Absence** (on the product tip / after land). Scope to the four Forgejo
   CODEOWNERS paths; do not `git grep` the whole tree (this ADR quotes
   `.* @code/maintainers` and would false-fail).

   ```
   test ! -e CODEOWNERS
   test ! -e docs/CODEOWNERS
   test ! -e .gitea/CODEOWNERS
   test ! -e .forgejo/CODEOWNERS
   git grep -n '^\.\* @' -- CODEOWNERS docs/CODEOWNERS .gitea/CODEOWNERS .forgejo/CODEOWNERS
   # pass: grep exit 1 (no matches / no files)
   ```

2. **PR pipeline.** Existing Woodpecker gitleaks + `tree` succeed on the
   **combined** product PR under context `ci/woodpecker/pr/woodpecker`. No
   secrets on the PR event. Delete-only green on `bb37af1` is not sufficient
   once S2 is added; the combined head must re-post success.

3. **Protection (operator read).** Same list as close criterion 4: GET
   `main` still equals **H3-2**, **H3-3**, **H3-5**, **H3-8**, **H3-9**. Fail
   if `enable_push` is true, official-review block is true,
   `required_approvals` is not 0, reject-block is false, or the Woodpecker
   context is missing. Do **not** treat observed flags or **H3-4** as
   GET-match fields.

4. **No new plant** (leftover-complete; **not** a #3 close gate). After
   S1+S2 are on `main`:

   - Open a **non-WIP** PR **into `main`** from a tip that does **not**
     contain `CODEOWNERS` and that **changes at least one file**.
   - `GET /api/v1/repos/code/cl8y-otc-terraclassic/pulls/{n}`
     (`requested_reviewers_teams`) and `GET .../pulls/{n}/reviews`.
   - Pass = no new `official: true` CODEOWNERS `REQUEST_REVIEW` and no new
     CODEOWNERS plant of team `maintainers`.
   - **Disqualify** `pulls/3`, leftover `pulls/2`, leftover `pulls/1`. A
     draft/WIP or empty-diff follow-up is not proof.

5. **Reject still blocks (doc-level).** Do not turn off
   `block_on_rejected_reviews` to “make autoland easier.”

## Rollout

- Merge vehicle: **one** PR, existing
  [#3](https://git.cl8y.com/code/cl8y-otc-terraclassic/pulls/3), after the
  combine step. Diff must be delete + ADR 0001 + architecture +
  `docs/README.md` index + root README pointer. Design-only
  `cac-design-issue-3` must not be opened or merged as the product PR.
- Order: protection already live → convert #3 to draft → combine S1+S2 on
  `chore/remove-catchall-codeowners` → leftover issue remains open → rebase
  → Woodpecker green on the combined head → `Do: merge` → **#3 closes**.
  Then leftover-complete test 4 on a new iid or operator attestation.
- Other `code/*` catch-all deletions may copy this pattern; this ADR does
  not merge those repos. This tree already posts the Woodpecker context
  (like dex#1309 / hello#15) and does not need a new YAML on the delete PR.
- [#297](https://git.cl8y.com/PlasticDigits/cl8y-agent-control/issues/297):
  no deploy, spend, custody, or CAC policy expansion. Landing #3 does not
  authorize CosmWasm broadcast, Coolify, or autonomy changes.

## Rollback

Restore the previous `CODEOWNERS` **via PR**, not direct `main`. That
re-plants official requests. It does **not** by itself re-enable
merge-block (`block_on_official_review_requests`); restoring the 405 gate
is a forge-policy revert, founder-scoped, and is not an
`cl8y-otc-terraclassic` rollback step.

File-only rollback that leaves this ADR and architecture on `main` (still
saying CODEOWNERS must be absent) is **intended**: standing docs keep
telling later agents not to treat the restored file as a merge gate. Do not
delete the docs as part of restoring the file unless a new ADR reverses
this decision.

Do **not** delete `.woodpecker.yml` as part of a CODEOWNERS rollback (that
re-boxes **H3-3**). WP rollback is a separate PR and is not required to
undo the catch-all. Contract / frontend / deploy files stay untouched.

## Integration completion criteria

### Land (S1+S2) — merge of PR `#3` or successor

All must be true on the merged tip. This is what merging `#3` completes. It
does **not** wait for S3.

1. `main` has no CODEOWNERS file at the four Forgejo paths: `test -f` fails
   on `CODEOWNERS`, `docs/CODEOWNERS`, `.gitea/CODEOWNERS`,
   `.forgejo/CODEOWNERS` (**H3-1**).
2. Standing docs on `main`: ADR 0001 + architecture **H3** + `docs/README.md`
   index, **and** root README pointer (deploy table kept; one/two sentences
   + ADR/architecture links). Architecture-only is not sufficient.
3. Woodpecker `ci/woodpecker/pr/woodpecker` succeeded on that **combined**
   product PR; no deploy secrets ran on that PR event; mergeable under
   **H3-4** (SHA-pinned `Do: merge`).
4. Protection GET still matches **H3-2**, **H3-3**, **H3-5**, **H3-8**,
   **H3-9** (same list as test 3; operator re-read at merge; not inferred
   from a green `tree` step; not **H3-4**; not observed flags).
5. No `force_merge`, no direct `main`, no CAC dismiss-as-merge, no
   Coolify/HMAC/`autonomy.rs`/contract/frontend/deploy edits in the #3
   diff.
6. A leftover issue exists that owns S3 (because merging `#3` closes that
   number).

A delete-only `#3` is not land. Green Woodpecker on `bb37af1` before S2 is
necessary for the current head and not sufficient for land.

### Leftover-complete (S3) — follow-up issue; survives merge of `#3`

1. A **dedicated** PR opened **after** the delete landed, **non-WIP**, with
   a **non-empty diff** (at least one file changed vs `main`):
   `requested_reviewers_teams` is empty **and** there is no new
   `official: true` `REQUEST_REVIEW` from team `maintainers`. `#3`’s plant
   does not count. `#2`’s plant does not count. `#1`’s leftover plant does
   not count. “The next natural PR” does not count. An empty-diff or WIP
   dedicated PR does not count.

Forgejo#48 leftovers, CAC#429, and OTC #2 (Renovate) may stay open; they
are not land or leftover gates for this tree.

## Authority

[cl8y-agent-control#297](https://git.cl8y.com/PlasticDigits/cl8y-agent-control/issues/297):
this design does not grant deploy, spend, custody, or agent-permission
expansion. Relaxing official-review as a **forge merge gate** is already
executed on this repo by #48; this ADR only removes the in-tree file that
plants requests. Independent review of this proposal is a later gate.
Design author must not write `DESIGN: APPROVE`.
