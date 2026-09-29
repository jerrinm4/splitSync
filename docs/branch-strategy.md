# Branch and release workflow

Use a short-lived branch for each change and open a pull request against the repository's main branch. Codex-created branches use `codex/` by default.

Before merging:

1. Run `pnpm check` and `pnpm test:e2e`.
2. Review code, migration requirements, and updated screenshots.
3. Require the GitHub **Quality checks** workflow to pass.
4. Complete the [release checklist](release-checklist.md) before publishing or deployment.

The included GitHub workflow verifies code; it does not deploy the site. Configure hosting separately using the [deployment guide](deployment.md).
