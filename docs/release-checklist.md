# Release checklist

Use this before publishing the repository or deploying the app. Local verification does not change the hosted database or GitHub repository.

## Repository publication

- [ ] Rotate credentials that appeared in older commits, including OAuth and Supabase runtime credentials. Inspect historical database exports for private data.
- [x] Replace the development branch history with a single clean release commit.
- [ ] Address any older clones, forks, pull-request references and cached views containing sensitive data. See [Security](../SECURITY.md).
- [ ] Confirm `.env`, `client_secret_*.json`, `dump.sql`, and `supabase/.temp/` are absent from the committed tree. Keep `.env.example` with placeholders only.
- [ ] Review `git diff --cached` and `git diff` before committing. Screenshots must use fictional data.
- [ ] Enable the GitHub quality-check workflow and require it before merging release changes.

## Database and storage

- [ ] Back up the database and receipt objects. Rehearse restoring the backup in a separate project.
- [ ] Review the Supabase migration dry run, then apply all pending migrations to staging. Follow [Deployment](deployment.md).
- [ ] Verify owner/co-admin access and reject an unrelated account. A shared visitor, even with the correct PIN, must be unable to mutate data or request receipt links.
- [ ] Upload and open a new receipt; open a legacy receipt. Check that `receipts.public` is false, public URLs fail, and signed URLs expire after 300 seconds.
- [ ] Verify multi-payer creation/editing, custom splits, wallet deposits/refunds, stale-edit rejection, and protected member deletion through the live API.
- [ ] Check existing data for invalid historical payer totals before using it for final settlement.

## App and hosting

- [ ] Run `pnpm check` and `pnpm test:e2e` successfully. Review [UI audit](ui-audit.md).
- [ ] Complete a keyboard and screen-reader pass, browser zoom checks, and touch testing on actual iOS/Android devices.
- [ ] Verify email and optional Google authentication with production redirect URLs.
- [ ] Check CSV, JSON and all three PDF reports with representative data. Downloaded reports contain trip information.
- [ ] Deploy the migrated frontend over HTTPS; confirm deep-link refresh works.
- [ ] Verify install/update behavior of the PWA across two deployments and the offline connection notice. Offline edits are not supported.
- [ ] Confirm errors can be reported to the maintainer, and document the deployed version and rollback plan. Preserve private storage policies during rollback.

## Included in this change

Automated checks, fictional screenshots, private-receipt code/migration, UI fixes and repository cleanup are included. The development history is replaced by a clean release commit. Applying migrations to a hosted project, rotating provider credentials, cleaning retained external copies and deploying remain release actions for the project owner.
