---
id: INTENT-98yh
title: Fix npm entry resolution in PR packaging test
status: done
story_points: 1
retry_count: 0
branch: intent/98yh-fix-npm-entry-resolution-in-pr-packaging-test
---

# Description

Address PR #3 review finding https://github.com/GustavoAntunes07/AIDLC-repo/pull/3#discussion_r4662004595. The packaging test assumes npm's Windows layout on every platform, so Linux nvm installations fail before packaged-consumer checks run.

The user's request to continue work on the PR review authorizes this scoped correction under standard governance. Preserve the terminal delivery intents and use this follow-up branch based on the PR head.

# Acceptance Criteria

- [x] Unix npm launchers resolve to their actual CLI entry point, including nvm symlinks.
- [x] Windows npm.cmd handling continues to use Node with the adjacent npm CLI.
- [x] The packaged-consumer regression and full suite pass on the available platform; doctor and branch checks pass, and platform limits are recorded.

# Related Files

- `tests/bootstrap.test.ts`
- `package.json`
- `.aidlc/config.yaml`

## Plan

Resolve the Unix executable using realpathSync; keep Windows launcher handling. Retain the existing pack/install/exec/update/rollback integration as the regression. Verify the npm entry and run project validation. No runtime product behavior or documentation changes are needed.

# Implementation Notes

- Root cause confirmed by the reviewed source: joining node_modules onto the launcher directory assumes the Windows npm layout. On nvm Unix installs the executable is a symlink into lib/node_modules instead.
- Unix resolves the actual npm launcher with realpathSync and invokes it with Node; Windows retains the npm.cmd-adjacent CLI path. Existing packaged-consumer coverage exercises pack, offline install, npm exec, upgrade and rollback.
- No temporary instrumentation was needed: the review's Linux reproduction and the unconditional path construction provide direct evidence. Local verification runs on Windows.

# Test Notes

- 2026-11-23, Windows, Bun 1.4.0, Node 26.13.1: focused packaged-consumer test passed (17 assertions).
- Full `bun test`: 55 passed, 0 failed, 501 assertions. Initial sandbox run had two EPERM failures creating directory junctions; the approved rerun outside the sandbox passed both and the entire suite.
- `bun aidlc:check`, `bun aidlc:doctor`, `bun aidlc:branch INTENT-98yh` and `git diff --check` passed. Doctor retains the existing legacy-project warning for this framework checkout.
- Unix/nvm behavior was inspected against the review's concrete Linux reproduction; no local Linux execution was performed. The existing packaging integration remains the cross-platform regression.

# Review Notes

- Separate reviewer agent `review_npm_fix`: APPROVED for the scoped correction, no actionable findings. Unix realpath resolution addresses the reported nvm symlink; Windows CLI path and Node invocation remain intact. The reviewer inspected rather than executed Unix behavior. Full suite subsequently passed as recorded above.
- No product documentation change is needed for this test-only correction.
- Final manual acceptance: on 2026-11-23 the developer replied "Approved! You can commit and push the changes", approving completion and authorizing commit and push of this correction to PR #3.

# Commits
