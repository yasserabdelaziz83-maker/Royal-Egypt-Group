# Royal Egypt Group — Verified Project Handoff

Last verified: 2026-11-06
Owner: Royal Egypt Group
Company: شركة رويال ايجبت للتسويق العقاري

## Mission
Build a secure, multilingual Royal Egypt Group platform and a maintainable automation/agent layer while keeping costs as close to zero as reasonably possible. Never promise unlimited free usage. Preserve production and document every change so the owner can operate the system without depending on an external developer.

## Organization
- Royal Egypt Group
- Royal Egypt Properties
- Royal Egypt Coffee
- Royal Egypt Transportation

## Repository and release candidate
- GitHub: https://github.com/yasserabdelaziz83-maker/Royal-Egypt-Group
- Default branch: `main`
- Release candidate branch: `release/royal-eg-release-candidate-2026-11-06`
- Draft PR #9: https://github.com/yasserabdelaziz83-maker/Royal-Egypt-Group/pull/9
- Operations manual: `.github/PROJECT_OPERATIONS.md` (blocked from public Pages paths by middleware)
- Current Pages production hostname: https://royalegyptgroup.pages.dev
- Preferred custom domain: https://royalegyptgroup.com (not currently attached to Pages)

The release candidate combines:
- Multilingual Arabic / English / Russian homepage, hero, division pages, developer directory, and shared assistant UI.
- Main branch SEO metadata, sitemap, robots rules, Google verification, Cloudflare Web Analytics beacon, and security middleware.
- Hardened property listing APIs from Draft PR #2.
- Secure multilingual website intake endpoint and form from Draft PR #7, with additional webhook-host validation.
- Owner operations documentation and automated syntax/intake tests.

Do not merge PR #9 or deploy Production until all Preview gates pass and the owner confirms go-live.

## Verified deployment status
- Cloudflare Pages project: `royalegyptgroup`.
- Production branch remains `main`.
- Release candidate Preview deployment succeeded for commit `0aa07cbb6223b5b801a1ee7405359833ccc235aa`; the latest deployment may advance as new commits are pushed.
- Preview branch alias: https://release-royal-eg-release-can.royalegyptgroup.pages.dev
- Only `royalegyptgroup.pages.dev` is attached as a domain; the custom `.com` domain is not attached.
- GitHub Jekyll CI succeeded on the release-candidate commits inspected.
- Added GitHub workflow `.github/workflows/functions-check.yml`: Node 22 syntax checks all Functions/assets JavaScript and runs synthetic intake tests. The first run completed successfully.
- Production has not been changed by this work. Project policy requires all tests to use the separate test database and prohibits Production writes during testing.

## Cloudflare Pages bindings and secrets
Verified through the authenticated Cloudflare API:
- Production D1 binding `DB` points to `royal-eg-listings` (`23185e4e-d299-41b2-abd7-bc533466e94a`). The release-candidate Wrangler config explicitly maps Preview to test DB `royal-ai-business-center-test` (`6e57492c-717d-4fb6-b122-75e5c14cf161`) and Production to `royal-eg-listings`; the latest Preview deployment succeeded and Cloudflare confirmed Preview DB points to the test database.
- Encrypted secret `ADMIN_TOKEN` exists in Preview and Production. Its value was not read.
- Encrypted secret `MAKE_INTAKE_WEBHOOK_URL` was added to Preview only and verified by key name. It was not added to Production.
- `wrangler.toml` in the release candidate declares `[ai] binding = "AI"` for local/default, Preview, and Production environments. The Preview Worker settings now confirm the `AI` binding. Synthetic English, Arabic, and Russian assistant requests returned HTTP 200 in Preview.
- R2 binding `PROPERTY_IMAGES` is not verified; image upload is not enabled by the current listing form.
- No Cloudflare edge rate-limiting rule or Turnstile verification has been configured yet.

## Website features and limits
- Arabic-first responsive group homepage with Arabic / English / Russian support.
- Royal Egypt Properties: listing catalogue and moderated listing submission.
- Developer directory: informational, official-source links, explicit non-endorsement disclaimer.
- Coffee and Transportation pages are informational / coming soon; online ordering and transport booking are not active transactional systems.
- Public property listings come from approved records only.
- The admin page `admin-listings.html` uses an in-memory password input and sends `Authorization: Bearer ADMIN_TOKEN`; the server checks the secret before listing moderation. Do not store the token in browser storage or share it.
- Listing image endpoint expects R2 `PROPERTY_IMAGES`, but current public form rejects uploaded files and directs image handoff through WhatsApp.
- Assistant endpoint uses `@cf/google/gemma-4-26b-a4b-it`, replies in the visitor's language, and now queries only approved public listing fields from D1. It does not read customer contact records.
- The assistant has a best-effort in-memory per-isolate request limiter; this is not a substitute for global edge protection.
- The assistant must never invent price, availability, ownership, legal status, permits, developer endorsement, coffee products, or transport schedules.

## Website contact intake — Preview test passed
- Public form posts to `POST /api/intake`.
- The Pages Function validates Origin, JSON size, field limits, request type, language, consent, and a honeypot.
- The outbound webhook host is restricted to `https://hook.eu1.make.com`; the secret value is never committed.
- Listing submissions are tagged `pending_review`; no automatic publication.
- Preview-only Make secret `MAKE_INTAKE_WEBHOOK_URL` is configured.
- One synthetic Preview request returned HTTP 202 (`accepted: true`).
- Make learned these 13 fields: `event`, `reference`, `request_type`, `status`, `name`, `phone`, `email`, `location`, `details`, `language`, `consent`, `source`, `received_at`.
- The synthetic request used placeholder data only. No real customer records were created and no D1 rows were inserted.
- Make scenario 8408747 remains inactive; payload schema learned, no queued deliveries. Do not activate until routing and downstream API permissions are verified.
- The one-shot HTTP test scenario 8414627 is inactive after use.

## D1 databases and schema parity
Production:
- Database: `royal-eg-listings`
- ID: `23185e4e-d299-41b2-abd7-bc533466e94a`

Test:
- Database: `royal-ai-business-center-test`
- ID: `6e57492c-717d-4fb6-b122-75e5c14cf161`

A read-only `sqlite_master` query inspected table definitions only; no customer, lead, deal, revenue, listing, or agent records were read.

Both databases have the same 12 business table names:
`agent_approvals`, `agent_audit_log`, `agent_memory`, `agent_tasks`, `agents`, `costs`, `customers`, `daily_summary`, `deals`, `listings`, `opportunities`, `revenue`.

Important: their schemas are NOT fully identical:
- Production also has `_debug`; test does not. Both have `_cf_KV`.
- Four common tables differ: `listings`, `agent_approvals`, `agent_memory`, and `agent_tasks`.
- Production `listings` includes `contact_name`, `contact_phone`, `area_sqm`, `images`, and `reviewed_at`; test has legacy `image_url` and lacks several production fields.
- Production `agent_approvals` has required task/action fields and a foreign key; test has a looser definition.
- Production `agent_memory` has id/timestamps and unique(category,key); test uses category/key as its primary key.
- Production `agent_tasks` includes `started_at`; test does not.
- The inspected definitions for `customers`, `opportunities`, `agents`, `agent_audit_log`, `costs`, `daily_summary`, `deals`, and `revenue` match.

A non-destructive migration has been applied to the test `listings` table only, adding `contact_name`, `contact_phone`, `area_sqm`, `images`, and `reviewed_at` plus the status/created_at index. The old `image_url` column was preserved and the new columns were verified. The `agent_approvals`, `agent_memory`, and `agent_tasks` schema differences remain untouched pending Worker source inspection. Do not drop/recreate either database.

## Existing Cloudflare Workers discovered
Cloudflare API listed these scripts:
- `d1-get-started`
- `reg-admin-audit`
- `royal-ai-business-center`
- `royal-ai-business-center-test`
- `royal-eg-owner-dashboard`
- `royal-egypt-agent`
- `royalegyptgroup`

The `royal-ai-business-center` Worker settings show:
- `ADMIN_TOKEN` encrypted secret (value not read)
- `DASHBOARD_ORIGIN` plain-text binding
- `DB` D1 binding to production database `royal-eg-listings`

Worker source and endpoint contracts still need inspection. Do not assume the Worker already provides customer/opportunity intake APIs. The Pages project and Worker named `royal-eg-owner-dashboard` are separate resources until proven otherwise.

## Make scenarios
Organization ID: 9505709
Team: My Team (3460199)

- 8408747 — `Royal Egypt – Secure Website Intake`: inactive, webhook payload learned; no routing modules or D1 writes yet.
- 8413166 — `Royal Egypt — Cloudflare Read-Only Audit`: on-demand only and currently inactive after each inspection. Uses existing Cloudflare connection ID 12773194. Never put secrets in its mapper.
- 8414627 — `Royal Egypt — Preview Intake Synthetic Test`: inactive after its one successful test.
- 8413158 — `Royal Egypt — Create Management Folder`: inactive, Google Drive.
- 8413745 — `Royal Egypt — Save Project Audit Report`: inactive, Google Drive.
- 8413630 — `Royal Egypt — Save Project Audit Handover to Drive`: inactive, Google Drive.
- 8333266 — `Daily CEO Notes | Royal Egypt`: separate content workflow; previously error/inactive. Do not merge it into the website intake workflow.
- 8412856 — `Integration OpenAI (ChatGPT, Whisper)`: active scheduled scenario; inspect before any change.

Make management API has intermittent rate limits. Do not burn operations on repeated polling; batch work and keep scenarios inactive unless an explicit test/run is needed.

## Required next steps
1. Inspect source/settings/routes for `royal-ai-business-center`, `royal-ai-business-center-test`, `royal-eg-owner-dashboard`, and `royal-egypt-agent`.
2. Confirm whether existing Workers already expose authenticated customer/opportunity/listing APIs. Prefer existing authenticated APIs over new D1 write paths.
3. Inspect full D1 schema/indexes and compare the four mismatched tables; prepare a non-destructive test migration only after Worker dependencies are known.
4. Add and test Turnstile or equivalent edge-level anti-abuse protection for public intake; keep the endpoint closed to public use until then.
5. Verify the Pages Preview Worker actually has the `AI` binding and test the assistant against approved listings only.
6. Design Make routing for customer, opportunity, and listing submissions using the learned 13-field payload and verified API contracts.
7. Add owner notifications and dashboard status tracking without exposing customer data.
8. Test listing moderation and admin authentication on Preview.
9. Verify all pages/languages and accessibility on Preview.
10. Obtain explicit owner go-live approval before merging PR #9, activating production Make workflows, or deploying Production.

## Security rules
- Never expose secrets, webhook URLs, admin tokens, passwords, or customer data in chat, source code, logs, or public files.
- Store secrets only in encrypted Cloudflare settings or secure Make connections.
- Never read real customer records during audits.
- Never publish a listing automatically.
- No production D1 writes, production automation activation, marketing outreach, DNS changes, paid upgrades, or Production deployment without explicit approval.
- Keep a changelog and rollback path for every release.


Workers AI cost note: Cloudflare currently includes 10,000 Neurons per day at no charge on Workers Free. Requests beyond the daily free allocation fail until reset unless the account is on Workers Paid. The project has not been upgraded to a paid plan.


## CRM API audit — verified from the TEST Worker source (2026-11-06)

The owner dashboard is a static UI Worker and calls the separate `royal-ai-business-center-test` API using the `X-Admin-Token` header. The dashboard UI does not write directly to D1 and does not persist the admin token in localStorage/sessionStorage.

The test business-center Worker currently exposes these relevant routes:
- `GET /api/customers` — returns up to 100 customer rows.
- `POST /api/customers` — authenticated customer creation; validates name and selected fields, writes to `customers`, then audits the creation.
- `GET /api/opportunities` — read-only list; no `POST /api/opportunities` route exists yet.
- `GET /api/deals`, `GET /api/revenue`, `GET /api/costs`.
- Dashboard, daily report, agents, tasks, and approvals routes also exist.
- No `/api/listings` route exists in this business-center Worker. Property listings are handled by the Pages Functions described below.

Authentication uses `X-Admin-Token` compared to the Worker's encrypted `ADMIN_TOKEN` secret. The Worker has an in-memory per-isolate limit of 60 requests per token per minute; it is not a global edge rate limiter.

The separate owner-dashboard Worker serves the dashboard HTML and points its API constant at the TEST business-center Worker. It requires the owner to enter the admin token for each session; the token is held in JavaScript memory.

## Website Pages Functions — verified from release-candidate source

- `GET /api/listings` returns approved public listing fields only.
- `POST /api/listings` accepts multipart form data, validates property fields and consent, rejects uploaded files, and inserts into D1 with `status='pending'`.
- `GET /api/admin/listings` requires `Authorization: Bearer ADMIN_TOKEN` and returns pending listings.
- `PATCH /api/admin/listings` requires the same admin token and approves/rejects a pending listing, setting `reviewed_at`.
- `POST /api/intake` validates a public website intake request and forwards a normalized 13-field event to the Make webhook. It does not write D1 and does not notify the owner dashboard directly.

## Test D1 schema verified via PRAGMA (schema only; no business rows read)

Test `customers` fields include:
`id`, `name`, `email`, `phone`, `country`, `language`, `type`, `budget_min`, `budget_max`, `interests`, `source`, `assigned_agent`, `status`, `notes`, `created_at`, `updated_at`.

Test `opportunities` fields include:
`id`, `title`, `type`, `details`, `country`, `estimated_value`, `status`, `source`, `assigned_agent`, `url`, `created_at`.

Test `listings` fields include:
`id`, `contact_name`, `contact_phone`, `title`, `property_type`, `location`, `area_sqm`, `price`, `purpose`, `description`, `images`, `image_url` (legacy), `status`, `created_at`, `reviewed_at`.

## Integration design decision

Do not give Make direct D1 credentials or let it execute arbitrary SQL. Make should be the workflow/orchestration layer only. A trusted Cloudflare endpoint should own writes and validation:
1. Public form → Pages `/api/intake` → Make webhook (already implemented and synthetic-tested).
2. Make router classifies `customer`, `opportunity`, `listing`.
3. A narrow authenticated Cloudflare intake-commit endpoint (or existing Worker endpoint extended safely) performs one allowlisted D1 insert using prepared statements and an idempotency key/reference.
4. Listing submissions always create `pending` rows; never auto-approve.
5. Owner notification/dashboard event should be stored in a dedicated safe queue/table or exposed through an authenticated API. Do not assume the current dashboard has an inbox; it currently shows KPIs, agents, approvals, and daily report only.
6. Make error handling must retain the reference and avoid duplicate inserts on retries.

Current limitation: the existing business-center Worker has a customer POST but no opportunity POST. The website Pages Function already accepts direct listing submissions but the intake webhook flow does not currently call it. These contracts must be unified before enabling live intake.

## Current workflow safety
- Make intake scenario 8408747 remains inactive and has no routing or write modules.
- Audit/test scenarios are deactivated after each one-shot run.
- Do not activate public intake until edge rate limiting/Turnstile, authenticated commit route, idempotency, owner notifications, and end-to-end Preview tests are complete.


## Intake throttling hardening — 2026-11-06

- Added a best-effort per-IP request bucket to `functions/api/intake.js`: maximum 10 POST requests per minute per Cloudflare Pages isolate.
- OPTIONS preflight requests are not counted. Requests are keyed by `CF-Connecting-IP`; stale buckets are cleaned when the map grows beyond 500 entries.
- Added a synthetic Node test confirming the first 10 requests are accepted and the 11th receives HTTP 429 without being forwarded to Make.
- This is defense in depth only. Pages isolates are distributed and ephemeral, so this is NOT a global rate limiter and does not replace a Cloudflare edge rate-limiting rule or Turnstile. Public intake must remain disabled until edge-level protection and end-to-end Preview validation are complete.
- Changes were committed to the release-candidate branch in commits `aa7b5a2027334206f218e2a280f412a837a31ef4` and `aaac54f09362fd411c65bc84154d570201ae62ac`.

- Follow-up hardening: HTTP 429 responses now retain the allowlisted Origin CORS header; the synthetic throttle test asserts this behavior. Latest code/test commits: `e4dac37e7853d7ce163fc951820d845307e2cc3c` and `0f44dc86c23ea701904f104d79a980f2b7064e4d`.


## Owner inbox and direct D1 persistence — 2026-11-06

- `POST /api/intake` now requires the Pages D1 binding `DB` and persists the validated request before attempting the optional Make notification.
- Uses a client-generated UUID `request_id` as the target row's primary key, with `INSERT OR IGNORE`, so a retry with the same request id does not create a second customer/opportunity/listing record or send a second Make notification.
- The contact form keeps its request UUID while a submission is retried and clears it only after a successful accepted response.
- Customer submissions write to `customers`; property-search opportunities write to `opportunities`; property offers write to `listings` with `status='pending'`. Make is now an optional orchestration/notification layer; D1 is authoritative. A Make outage does not discard a stored request.
- Added authenticated `GET/PATCH /api/admin/inbox` at `functions/api/admin/inbox.js`, protected by `Authorization: Bearer ADMIN_TOKEN`. GET returns up to 100 records per table. PATCH only updates customer/opportunity statuses from the allowlist; listing moderation remains on `/api/admin/listings`.
- Added `admin-inbox.html`, a noindex owner UI. It keeps the admin token in page memory only, provides customer/opportunity status updates, and approves/rejects pending listings through the existing admin API. URL path: `/admin-inbox.html`.
- Middleware marks the owner inbox page noindex. Added synthetic tests for the inbox API and expanded CI to run all `tests/*.test.mjs`.
- CI reported success for the synthetic intake/inbox test workflow at commit `b9001529a785468b9844d209a779e6df877b0a0d`. Jekyll workflow for that commit was still in progress at the time of this note. Recheck the latest branch-head workflows before merge.
- This code is on the release-candidate branch only. It has NOT been deployed to Pages Preview or Production in this step. Validate the D1 column names against both bound databases before deployment. Production D1 must remain unchanged until Preview tests pass.
- The current Make intake scenario (8408747) is still inactive and still only has a Custom Webhook trigger. Do not activate it until its notification behavior is designed and tested. The database write now happens in Pages, not Make. Make must not be given direct D1 access.
- Known protection limit: the in-isolate rate limiter is best-effort only; it is not a global edge rate limiter. Configure Cloudflare edge protection / Turnstile before unrestricted public launch.


## Global intake rate limit and Production binding readiness — 2026-11-06

- Replaced the per-isolate-only intake limiter with a global D1-backed per-IP/minute counter. The endpoint SHA-256 hashes `CF-Connecting-IP` before storage; raw IP addresses are not written. Limit: 10 accepted POST attempts per IP per minute across Pages isolates. The counter is an atomic upsert using `RETURNING request_count`.
- Added `migrations/0002_intake_rate_limits.sql` for the Production database and `migrations/preview/0003_intake_rate_limits.sql` for Preview. The `intake_rate_limits` table was created successfully in BOTH D1 databases via Cloudflare API. This was a schema-only change; no customer/listing rows were read or changed.
- Added synthetic test coverage for the global D1 rate counter. GitHub Actions Functions/Intake tests and Jekyll CI both passed at commit `cfcd95c5d92265c30dfe81b1796ed537b44641ec`.
- Cloudflare Pages Production settings were updated to include the Workers AI binding `AI`, matching the Preview binding. Production D1 binding remains `royal-eg-listings`. Production currently has `ADMIN_TOKEN`; `MAKE_INTAKE_WEBHOOK_URL` is not configured in Production, but the current D1-first intake endpoint treats Make as optional and still stores accepted requests. No Production code deployment has occurred yet.
- Preview deployment for the global D1 rate limiter: `https://80ab066f.royalegyptgroup.pages.dev` (successful deploy of release branch commit `cfcd95c5d92265c30dfe81b1796ed537b44641ec`). Synthetic customer, opportunity and listing writes all returned HTTP 202; all three synthetic records were then deleted from TEST D1. The webhook test deliveries were drained with the original Make scenario containing only its webhook trigger, and that scenario was returned to inactive.
- Keep Make scenarios 8408747, 8413166, 8414627, 8415805 and 8415895 inactive unless explicitly being used for a bounded test. The on-demand test/audit/cleanup scenarios are not production automations.
- Remaining launch consideration: Make notification automation is not configured; owner inbox polling is available. The Pages-level D1 limiter is global and materially stronger than the earlier isolate-only map, but an additional edge challenge such as Turnstile can still be considered if/when a sitekey and secret are provisioned safely.
