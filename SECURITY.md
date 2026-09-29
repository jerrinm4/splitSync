# Security

## Before publishing this repository

This release starts with a fresh, single-commit Git history. Local environment configuration, OAuth client credentials, database dumps, and Supabase runtime metadata are excluded from the tracked files; ignored local copies remain available.

Older development history contained credentials and local data. Rewriting the branch does not invalidate those credentials or erase existing clones, forks, pull-request references, or GitHub cached views. Rotate affected credentials with their providers and handle retained copies before publishing. See [GitHub's sensitive-data removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository). Do not paste credentials into GitHub issues.

## Access and data

- Browser configuration uses a Supabase publishable/anonymous key. Authorization is enforced by database row-level security and RPC validation.
- Expense writes require a trip owner or admin. Shared links provide read access, optionally protected by a PIN.
- Share tokens and PINs are access credentials. Disable sharing to revoke link access. PIN protection does not include rate limiting; do not use short PINs as the sole protection for sensitive information.
- Receipt storage is **private after applying `20260928000001_private_receipts.sql`**. Storage SELECT policies allow only trip owners/admins. The UI requests a signed link on opening a receipt; it expires after 300 seconds. Shared-trip visitors cannot request receipt links, including visitors with a valid sharing PIN. A signed link is a temporary bearer credential: anyone holding it can use it until it expires. Removing an admin does not revoke an already-issued link immediately.
- Existing same-project public receipt URLs are converted to bucket paths by the viewer, so admins can open older receipts after the migration without rewriting expense rows. Previously downloaded copies cannot be revoked.
- CSV and JSON downloads contain trip information. JSON backups omit sharing credentials and account IDs, but include receipt references (bucket paths or legacy URLs). They do not contain signed links or image files. Keep downloads private.
- Members with financial records cannot be deleted individually. Disabling a member preserves their history. Deleting a whole trip still deletes its records.

## Reporting an issue

Report suspected security problems privately to the repository maintainer. Include reproduction steps with fictional data, affected versions, and the expected access boundary. Avoid opening public issues containing secrets or personal financial information.
