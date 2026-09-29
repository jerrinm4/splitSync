# Contributing

Use Node.js from `.nvmrc` and the pnpm version declared in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm check
pnpm test:e2e
```

## Development

- Copy `.env.example` to `.env` and configure a development Supabase project.
- Run `pnpm dev`. Keep sample data in a development project.
- Add database changes as new files in `supabase/migrations`. Preserve migration order and previously applied migrations.
- Keep amounts as integer paise. Keep calendar dates as `YYYY-MM-DD`; use `src/lib/dates.ts` at date input and API boundaries.
- Add regression coverage for changes to balances, authorization or data mutations.
- Keep comments that explain constraints or unusual behavior. Avoid comments that repeat the next line of code.
- Run `pnpm screenshots` after visible changes and review the PNGs before committing.

## Pull requests

Explain the user-visible change, any migration requirements, and the checks you ran. Include desktop/mobile screenshots when the interface changes. Avoid committing credentials, database dumps, receipt images or real trip information.

The browser tests intercept Supabase requests with fictional fixtures. The database suite applies all migrations to embedded PostgreSQL with small substitutes for Supabase's platform schemas. Before release, also verify the real Auth, Storage and PostgREST integrations in a staging Supabase project.

See [UI audit](docs/ui-audit.md) for accessibility checks and [Release checklist](docs/release-checklist.md) before publishing.
