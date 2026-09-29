# Deployment and database setup

## Configure Supabase

1. Create a project for development or staging.
2. Apply every file in `supabase/migrations` in filename order. With the Supabase CLI, use `supabase link --project-ref <project-ref>` and review `supabase db push --dry-run` before `supabase db push`.
3. Enable email authentication. Optionally configure Google OAuth in Supabase; the OAuth secret belongs in Supabase, never in the frontend repository.
4. In Auth URL Configuration, set the site URL and allow `<origin>/trips` for each environment, including `http://localhost:5173/trips` during development.
5. Copy `.env.example` to `.env`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the project settings.
6. Start the app, sign in, create a trip, and verify an expense with two payers, wallet add/refund, sharing with a PIN, and a receipt upload.

The migrations create the `receipts` bucket and make it private. The frontend opens receipt images through short-lived signed links for owners/admins; see [Security](../SECURITY.md).

## Updating an existing installation

Back up the database first and validate the upgrade on staging. Apply these migrations in order **before** releasing this frontend:

1. `20260926000001_harden_expense_writes.sql`
2. `20260926000002_protect_financial_history.sql`
3. `20260928000001_private_receipts.sql`

These migrations replace old expense RPC overloads, restrict payer and receipt mutations, remove shared-link delete access, validate trip membership, add display settings, prevent deletion of members with financial history, and correct wallet refund checks. The new edit form sends `p_expected_version` to detect concurrent edits.

The receipt migration changes the existing bucket to private without moving or deleting files. Existing public receipt URLs stop working. The new viewer extracts paths from same-project legacy URLs and signs them for authorized admins. External URLs require re-uploading the image. Deploy the updated frontend immediately after the migration so older clients do not keep requesting public URLs.

Verify on staging: upload as the owner; open as a co-admin; deny access to an unrelated account and a shared-link visitor; confirm the old public URL fails and the signed URL expires after five minutes. Do not roll back to a public bucket to work around a frontend issue.

Historical rows are not automatically rewritten. Review existing trips for mismatched payer totals, members from other trips, or expenses created through older broken multi-payer flows. Do not run the historical database dump as a deployment script.

## Build and host

Use Node.js 22.20.0 or newer and pnpm 12.3.4, as pinned in `.nvmrc` and `package.json`. Keep `pnpm-workspace.yaml` in the checkout so local and hosted installs use the same dependency-script policy.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e
pnpm preview
```

`pnpm check` includes the production build. Publish `dist/` to a static host. Configure all application routes to fall back to `index.html`, and serve the site over HTTPS. `wrangler.jsonc` supplies the SPA fallback for Cloudflare Workers Static Assets; use that provider's deployment tooling after configuring the build environment.

Vite embeds `VITE_*` variables at build time. Rebuild when changing the Supabase project. The app caches its shell through a service worker and prompts before installing a new version. Saving and loading trip data requires a network connection; there is no offline mutation queue.

Avoid long-lived caching of `index.html`, `sw.js` and the web manifest. Fingerprinted JavaScript/CSS assets can use immutable caching. Confirm that a refresh on `/trips/<id>/expenses` works after deployment.

### Dependency installation errors

If Cloudflare stops with `ERR_PNPM_IGNORED_BUILDS`, check which dependency the log names. The committed `pnpm-workspace.yaml` explicitly skips the `core-js` post-install script: the locked version only prints a donation message, and its polyfills work without that script. Deploy a commit containing this configuration and use `pnpm install --frozen-lockfile` for installation.

New dependency scripts still require review because `strictDepBuilds` remains enabled. When updating dependencies, inspect any newly reported scripts and record an explicit allow/deny decision in `allowBuilds`. See [pnpm build settings](https://pnpm.io/settings/build#allowbuilds).

## Release verification

Use the complete [release checklist](release-checklist.md) and [UI audit](ui-audit.md).

- `pnpm check` and `pnpm test:e2e` pass.
- Staging Auth callbacks, Storage uploads and PostgREST RPCs work with the migrated schema.
- A second unrelated account cannot read or edit another trip. A shared-link visitor can read but cannot write.
- A stale expense edit fails without replacing a newer edit.
- Both mobile and desktop views work, exports download, and the PWA update prompt appears on a second deployment.
- Credentials and private data from earlier Git history have been handled as described in [Security](../SECURITY.md).

Storage reference: [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [access policies](https://supabase.com/docs/guides/storage/security/access-control), [signed downloads](https://supabase.com/docs/guides/storage/serving/downloads).

Reference: [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions), [PWA update prompts](https://vite-pwa-org.netlify.app/guide/prompt-for-update).
