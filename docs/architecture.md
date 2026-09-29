# Architecture

SplitSync is a React + TypeScript single-page app built with Vite. TanStack Router handles navigation; TanStack Query loads and invalidates remote data. React Hook Form and Zod validate forms. Tailwind CSS and Radix primitives provide the interface.

Supabase provides authentication, PostgreSQL and receipt storage. The browser uses a public key and the signed-in user's session. No service-role key is required by the app.

## Data model

| Table | Purpose |
| --- | --- |
| `trips` | Owner, currency, dates, sharing and display settings |
| `trip_admins` | Additional signed-in trip managers |
| `trip_members` | People taking part, including inactive members |
| `trip_member_groups` | Saved member selections |
| `expenses` | Amount, date, status, payer source and receipt reference |
| `expense_splits` | Each member's share of an expense |
| `expense_payers` | Contributions from one or more paying members |
| `fund_transactions` | Money added to or refunded from the trip wallet |
| `expense_categories` | Category labels, colors and estimated budgets |
| `audit_logs` | Recorded mutations |

## Money and dates

The app supports INR. All stored amounts use integer paise; formatting divides by 100 only at the display boundary. Equal splitting distributes remainder paise deterministically. Custom shares stay unchanged during editing and rounding resync.

`calculateMemberBalances` uses paid, active expenses. A member's balance is their direct payments plus net wallet contributions minus their expense shares. Positive means money to receive; negative means money owed. This is a balance summary, not a peer-to-peer settlement ledger.

Wallet balance is additions minus refunds minus paid wallet expenses. Estimates appear in planning summaries and do not change actual balances. Display rounding does not change stored financial records.

Expense dates are calendar dates. `toDateOnly` and `fromDateOnly` avoid conversion through UTC, which would shift local midnight in some time zones.

## Writes and concurrency

Expense creation/update uses SQL RPCs so the expense, payer records, splits and audit entry change in one transaction. SQL validates authorization, member/category membership, duplicate members and exact totals. Updates can include the version observed when editing began; a mismatch raises an error.

Query invalidation refreshes the relevant trip after mutations. Shared-link clients have session persistence and automatic refresh disabled so they do not reuse an admin's authentication state. See [Security](../SECURITY.md) for the receipt and sharing model.

## Receipt storage

New uploads save a bucket-relative `trip-id/filename` path in the existing `receipt_url` column. `receiptPath` also accepts legacy public URLs from the configured Supabase origin. `ReceiptViewer` requests a 300-second signed URL only when opened and refreshes it while open. URLs stay in the query cache, never in the database or backups. Failed signing and image loading show a retry action. Storage RLS restricts reads to owners/admins; shared pages omit receipt actions.

## PDF reports

`src/lib/pdf.ts` uses jsPDF and AutoTable and loads only when exporting. Embedded Noto Sans fonts support INR symbols. Expense reports use the selected rows; balance and member reports share the app's calculation helpers. Reports are generated locally in the browser. Browser tests cover failed downloads, retry, filtered exports, multiple pages and expenses paid by a member who has no share in their cost.

## Tests and screenshots

- `src/tests`: money, date, form-validation, balance and export regressions.
- `scripts/test-database.mjs`: all SQL migrations plus authorization and integrity checks in embedded PostgreSQL. Auth and Storage platform schemas are simulated.
- `e2e`: Chromium, Firefox and WebKit tests against the real frontend with intercepted Supabase responses and fictional data. Axe checks cover routes and dialogs; keyboard, narrow layouts, error recovery, exports and private receipt links have regression coverage.
- `pnpm screenshots`: repeatable desktop and mobile captures used in the README.

Browser fixtures do not exercise Supabase's live HTTP services. Use staging to verify provider configuration, OAuth, Storage and PostgREST before deployment.
