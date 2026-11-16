# CLAUDE.md

Rules for automated agents in this throwaway sandbox. The code is a snapshot of `unjs/ufo` (URL utilities, TypeScript). The repo exists to test a multi-agent merge workflow; nothing here is published.

## Rules

1. **No secrets.** Never print, echo, log or commit a token or credential. Never run `gh auth token` or read files under `~/.config/gh`.
2. **Branch and PR only.** Never push to `main`. Never force-push, rebase or rewrite history. Update a branch by merging `main` (`git merge origin/main`), only when the orchestrator asks or GitHub reports a conflict.
3. **No attribution.** Commit messages, PR titles and bodies carry no tool or vendor name and no `Co-Authored-By` trailer. Commits use the configured git author.
4. **Conventional commits:** `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.
5. **Stay in this repository.** Touch no other repository and no file outside your checkout.
6. **Gates.** In a fresh worktree run `pnpm install --frozen-lockfile` once. The gates are `pnpm lint` and `pnpm vitest run --typecheck`. Both must pass on a clean tree before a `DONE:`.
7. **Every change gets a test** in `test/` where practical.

## The merge workflow

- `main` is protected. The required check is `ci-ok` on the PR's head. The branch need not be up to date with `main`.
- The lead opens a **draft** PR and never marks it ready, arms or merges.
- The orchestrator reviews the lead's `DONE:` head once (with a `reviewer` agent or itself), sends one round of fixes if needed, notes the reviewed head, marks the PR ready, and arms auto-merge pinned to that head: `gh pr merge <n> --auto --squash --match-head-commit <full sha>`.
- Nobody pushes to an armed PR. Before any push after its first `DONE:`, the lead reads `gh pr view <n> --json autoMergeRequest`; if it is not null, the lead asks the orchestrator to disarm first.
- If arming fails with "Pull request is in clean status", run the same command again once.
- If `main`'s push CI is red, the orchestrator disarms every armed PR; the PR that fixes `main` goes first.

## Orchestrator and workers

- The **orchestrator** is the owner's agent in the primary checkout. It never writes code. It picks the order of tasks, starts one **lead** per task, reviews, marks ready and arms.
- A lead is started as a separate Paseo agent on the `claude-lead` provider in a workspace with its own git worktree on the task's branch (`task/<slug>`), made from `origin/main`. The brief names the task, the branch, the orchestrator's agent id, what is out of scope and the paths it expects to touch. The lead follows `.claude/agents/lead.md`.
- The lead is the only writer of its branch. It starts **builders** and **reviewers** with `fleet_launch_worker`, squashes accepted work into its branch, runs the gates, pushes and opens the draft PR.
- Leads report to the orchestrator with `send_agent_prompt` and a message starting `DONE:` or `CONSULT:`.

## Fleet

Fleet is a Paseo plugin. It sends facts as messages that start with `[fleet] <tag>`, once per recipient and event.

- Before you start a lead, call `fleet_forecast {paths}` with the paths in the brief. It lists the leads whose branches already change them: a warning, not a refusal.
- After the review, note the reviewed head and the findings with `fleet_board_note {leadId, reviewedHead, findings}`.
- Before you arm auto-merge, call `fleet_merge_preflight {pr}`. Arm only on `clear`, with the full sha it names. A `blocked` or `unknown` answer lists each reason. Running CI, a draft and a branch behind `main` do not block. A red `main` blocks; arm the PR that fixes `main` anyway, by your own judgment.
- When the head is a merge of `main` after the review, the preflight says whether the review holds. After a conflict, call `fleet_review_delta {from: <reviewed head>, to: <new head>}` to compare the PR's own change, then note the new head as reviewed.
- After a compaction, call `fleet_state`.
- Now and then, call `fleet_gc`. It lists worktree workspaces whose work is in `main`. It never archives; tell the owner the count.

When a `[fleet]` message reaches the orchestrator:

- `pushed`: it shows what changed since the reviewed head and warns when the last read showed auto-merge armed. On that warning, disarm (`gh pr merge <n> --disable-auto`) and check the push.
- `ci-passed`, `ci-failed`: on a pass, go on with the review or the preflight. On a failure, send the lead the failing check.
- `conflicting`: GitHub reports a conflict with `main`. Ask the lead to merge `main`.
- `behind`: GitHub requires an up-to-date branch. This repo does not, so check branch protection before asking the lead to merge `main`.
- `main-red`: `main`'s push CI failed. Disarm each armed PR it lists; the fix goes first.
- `main-green`: `main` is green again. Run the preflight on each open PR before you arm it.
- `merged`: archive the lead's workers, then tell the owner the workspace can be cleaned up.
- `idle-ready`: the PR is ready, CI passed and nothing ran for a while. Run the preflight.
- `overlap`: two leads change the same files. Tell them who owns which part, or put one after the other.
- `silent`: an agent stopped without `DONE:` or `CONSULT:`. Read its last words and answer it.
