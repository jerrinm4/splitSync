# UI and accessibility audit

This audit combines automated browser checks, keyboard interaction checks, and review of screenshots captured from the running app. Test data is fictional.

## Verification status — September 29, 2026

- Unit regressions: 33 passed. Database suite: all 25 migrations and authorization/integrity checks passed.
- Chromium and WebKit: **96 checks passed** (48 in each engine). The two screenshot-capture entries are intentionally skipped in the normal suite and run separately with `pnpm screenshots`. All configured axe scans passed without reported violations.
- Firefox: local execution is blocked before page loading by Windows `browserType.launch: spawn UNKNOWN`. A forced reinstall and direct launch retry produced the same result. Firefox remains enabled in CI; its run must pass before a release is approved.
- Live Supabase integration, actual mobile hardware and screen-reader checks remain in the release checklist.

## Coverage

`e2e/accessibility.spec.ts` scans all 14 routes: trip list, create trip, dashboard, expenses, add/edit expense, members, member profile, wallet, activity, settings, shared trip, login and not-found page.

Each route is checked in these configurations:

| View | Palette | Viewport |
| --- | --- | --- |
| Dark desktop | Purple | 1440 × 1000 |
| Light desktop | Purple | 1440 × 1000 |
| Dark mobile | Purple | 320 × 740 |
| Light mobile | Yellow | 320 × 740 |
| Dark desktop | Yellow | 1440 × 1000 |

The suite is configured for Chromium, Firefox and WebKit using Playwright. WebKit coverage exercises that browser engine; it does not replace testing Safari on actual Apple hardware. Narrow viewports test reflow, not mobile operating-system behavior.

Axe checks use WCAG 2 A/AA, 2.1 A/AA, 2.2 AA and best-practice tags, with no rule exclusions. The tests also detect page errors and horizontal overflow. Reduced-motion mode keeps measurements stable and verifies the app's motion preference support.

`e2e/ui-states.spec.ts` covers category/group/member/wallet/sharing/export dialogs, edit/delete confirmations, empty views, request failure and retry, login errors and email confirmation, PIN failure/retry, private receipt failure/retry, offline notices, and mobile navigation focus trapping and restoration. Additional checks cover member management, expanded shared summaries and activity entries, long names, mobile submit placement, and receipt preview removal/reselection.

`e2e/app.spec.ts` covers route protection, editing, search/CSV, JSON backup, all three PDF exports, PDF retry/pagination, shared read-only views and keyboard expansion of expense details.

## Fixes included

- Improved text and status contrast in light/dark themes and opaque enough dialog surfaces.
- Added names for icon buttons, filters, checkboxes and form fields; corrected heading order and page landmarks.
- Added visible keyboard focus and a skip link. Mobile navigation now uses a focus-trapped dialog and restores focus when closed.
- Made narrow headers and dialog content wrap/scroll; kept action buttons visible without hover.
- Added recoverable load errors, receipt errors and sharing-save notifications.
- Prevented checkbox clicks from toggling twice through a parent click handler.
- Removed the receipt viewer from shared pages; owner/admin viewing now uses short-lived signed URLs.

## Run the checks

```sh
pnpm exec playwright install chromium firefox webkit
pnpm check
pnpm test:e2e
```

Run just the UI audit with `pnpm exec playwright test accessibility ui-states`. Set `PLAYWRIGHT_PORT` if port 4173 is occupied. Failures save screenshots and traces under `test-results/`; route audit findings are written under `tmp/audit/`. These folders are ignored by Git. CI uploads failure screenshots/traces.

Refresh the documentation screenshots with `pnpm screenshots`. Review the images before committing them; the test fixture intercepts Supabase calls and does not access a live project.

## Manual checks before a public release

Automated results are evidence for the covered states, not a full accessibility certification. [Playwright's accessibility guide](https://playwright.dev/docs/accessibility-testing) explains the limits of automated scanning.

1. Navigate login, expense creation/editing, sharing and exports using only the keyboard. Check focus visibility, order, validation messages and return focus after closing dialogs.
2. Use NVDA with Firefox/Chrome and VoiceOver with Safari. Verify headings, amounts, member names, errors, status announcements and expanded sections make sense when read aloud.
3. Check browser zoom at 200% and 400%, high-contrast settings, and increased text size. Content and controls should remain reachable without overlapping.
4. On actual iOS/Android devices, check the on-screen keyboard, date picker, receipt upload, scrolling, safe areas, PDF download and PWA install/update.
5. Verify live authentication, storage permissions and failed-network behavior against staging using the [release checklist](release-checklist.md).

Keep an issue with reproduction steps and a screenshot for each remaining failure. Re-run the affected checks after a fix.
