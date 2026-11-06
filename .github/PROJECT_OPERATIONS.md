# Royal Egypt Group — Project Operations & Launch Control

Last verified: 2026-11-06
Owner: Royal Egypt Group
Repository: https://github.com/yasserabdelaziz83-maker/Royal-Egypt-Group
Production Pages hostname currently known: https://royalegyptgroup.pages.dev
Preferred custom domain: https://royalegyptgroup.com (attachment/verification not confirmed)

## 1. Operating principles

- Preserve the existing website and production deployment; do not rebuild from scratch.
- GitHub is the source of truth for code and review history.
- Cloudflare Pages/Workers host the site and server-side functions.
- Cloudflare D1 is the business data store.
- Make orchestrates workflows; it is not the website host or source-code repository.
- Use free tiers where practical, but never promise unlimited free usage. Check current quotas before enabling metered features.
- Keep customer data private. Audit schemas and APIs without exporting or browsing real customer records.
- Never place secrets, webhook URLs, API tokens, admin tokens, or passwords in Git, frontend code, logs, documentation, or chat.
- Test with synthetic data in Preview before any Production changes.
- No listing is public until an owner/admin explicitly approves it.
- Do not merge PRs, change production settings/data, activate production automations, publish content, send marketing messages, buy services, or change DNS without explicit owner approval.

## 2. Verified repository and branch state

Default branch: `main`
Repository is public.

Branches observed on 2026-11-06:
- `main`
- `feature/multilingual-hero-assistant-2026-11-05`
- `feat/secure-contact-intake-2026-11-06`
- `audit/harden-listing-api-2026-11-05`
- SEO / analytics feature branches.

The multilingual branch compared with main:
- 17 commits ahead and 6 behind at the time of inspection.
- It contains the newer group homepage/hero, multilingual enhancements, and `functions/api/assistant.js`.
- It must not be merged blindly or replaced by an older main-branch `index.html`.

Open draft pull requests:
- PR #2 — Harden property listing API validation and error handling. Draft, open, not merged.
- PR #7 — Add secure multilingual website contact intake. Draft, open, not merged.
- PR #8 — Project operations and launch-control documentation. Draft, open, not merged.
- PR #9 — Integrated release candidate combining multilingual site, main SEO/security updates, hardened listing APIs, and secure intake. Draft, open, mergeable, not merged.

GitHub Actions:
- Recent Jekyll site CI runs on main and the contact-intake branch completed successfully.
- This CI result does not verify Cloudflare Pages runtime bindings, D1 connectivity, Workers AI, Make delivery, rate limiting, or production behavior.

## 3. Website feature inventory

### Main branch (default branch)
- Group homepage and navigation.
- Property catalogue and enquiry flows.
- Developer directory.
- Coffee and Transportation informational pages.
- Existing D1-backed listing submission and admin moderation functions are present in the repository history/tree.
- Current README describes the property assistant on main as a lightweight browser-side guided matcher, not a connected LLM.
- Current README says enquiries open WhatsApp with a prefilled draft; they are not stored as leads by the website.

### Multilingual development branch
- Redesigned group homepage with photographic hero.
- Arabic / English / Russian UI support.
- Group divisions: Properties, Coffee, Transportation.
- Developer directory and disclaimers.
- Shared multilingual assistant UI.
- `POST /api/assistant` endpoint using Cloudflare Workers AI binding `AI`.
- AI endpoint uses model `@cf/google/gemma-4-26b-a4b-it` and must not invent prices, availability, legal status, or guarantees.
- The `AI` binding is a required Cloudflare Pages Functions binding; live availability has not been verified.
- The in-memory rate-limiting helper in assistant.js requires review: verify that it is actually invoked and do not treat isolate memory as durable/global edge rate limiting.
- Homepage hero references an externally hosted Unsplash image.

### Contact intake branch / PR #7
- Multilingual Arabic/English/Russian contact form.
- Pages Function `POST /api/intake`.
- Requires Preview secret `MAKE_INTAKE_WEBHOOK_URL`.
- Forwards customer/opportunity/listing requests to Make; it does not write to D1.
- Listing submissions are tagged `pending_review`; no automatic publication.
- Validation and honeypot exist, but Cloudflare edge rate limiting and stronger bot protection are not yet verified.
- The form's error handling has an Arabic-only hard-coded message for `intake_not_configured` even in English/Russian; fix before launch.
- Client sends `elapsed_ms`, but current endpoint does not validate it; do not treat it as an effective bot check.
- The webhook payload has not yet been learned/inspected in Make.
- PR #7 must remain Draft until branch integration, Preview, secret, rate-limit, and synthetic payload tests are complete.

### Listing moderation PR #2
- Adds stronger server-side validation and safer error handling to listing submission/admin APIs.
- Draft only, not merged.
- Its changes must be reviewed and reconciled with the multilingual branch before integration.
- Verify the production D1 schema and binding before any deployment.

## 4. Cloudflare and D1 state

Known production D1 database:
- Name: `royal-eg-listings`
- Binding expected by code: `DB`
- Database ID: `23185e4e-d299-41b2-abd7-bc533466e94a`

Known test D1 database:
- Name: `royal-ai-business-center-test`
- Database ID: `6e57492c-717d-4fb6-b122-75e5c14cf161`

The repository `wrangler.toml` on the multilingual branch declares binding `DB` to `royal-eg-listings`. This file alone does not prove that the live Pages project has the same binding.

The listing migration `migrations/0001_listings.sql` creates a `listings` table with pending/approved/rejected states and a status/created_at index. Do not apply migrations or change live tables without comparing the actual database schema and receiving approval.

Cloudflare Pages bindings/secrets verified on 2026-11-06:
- D1 binding `DB` points to production database `23185e4e-d299-41b2-abd7-bc533466e94a` in both Preview and Production.
- `ADMIN_TOKEN` exists as an encrypted secret in both Preview and Production; its value is masked and was not read.
- Workers AI binding `AI` is verified in the Preview Pages Worker settings as an `ai` binding. Production binding is declared in the release candidate but is not deployed until a future approved Production release.
- `MAKE_INTAKE_WEBHOOK_URL` was added as an encrypted secret in Preview only and verified by key name. It was not added to Production.
- Edge rate limiting / bot protection is still not configured or verified for public intake.
- Only the `pages.dev` hostname is attached; `royalegyptgroup.com` is not currently listed as a custom domain.

A separate healthy Cloudflare connection was found and used through Make. The read-only audit scenario successfully queried account identity, Pages projects, D1 database inventory, and production D1 table names. It also performed one Preview-only Pages secret update. No Production settings or data were changed.

## 5. Make inventory observed on 2026-11-06

Organization: My Organization (9505709)
Teams:
- My Team (3460199)
- royalegyptgroup's space (3460200)

Scenarios observed in My Team:
- 8413158 — Royal Egypt — Create Management Folder. Inactive, on-demand, Google Drive connection healthy.
- 8413745 — Royal Egypt — Save Project Audit Report. Inactive, on-demand, Google Drive connection healthy.
- 8413630 — Royal Egypt — Save Project Audit Handover to Drive. Inactive, on-demand, Google Drive connection healthy.
- 8413166 — Royal Egypt — Cloudflare Read-Only Audit. Active on-demand only; uses the healthy existing Cloudflare connection. Used for read-only account/Pages/D1 inspection and a Preview-only secret update. It has no schedule and runs only when explicitly invoked.
- 8408747 — Royal Egypt – Secure Website Intake. Inactive; Custom Webhook trigger only. Payload structure has not yet been learned. Do not activate before inspecting a real synthetic payload.
- 8333266 — Daily CEO Notes | Royal Egypt. Error state and inactive; separate content workflow. Do not modify as part of website intake work without separate review.
- 8412856 — Integration OpenAI (ChatGPT, Whisper). Active scheduled scenario; inspect purpose and usage before changing or disabling it.

The Make management API returned intermittent `Too Many Requests` responses during later inspection attempts, but several on-demand Cloudflare API runs succeeded. The website intake webhook scenario remains inactive; its webhook was put into one-request learning mode and has not yet received a sample.

## 6. Required target architecture

1. Public website: Cloudflare Pages.
2. Source control: GitHub.
3. Server-side APIs: Pages Functions / Workers with authenticated access.
4. Data store: existing D1 tables, only through approved API contracts.
5. Automation: Make scenarios split by business responsibility.
6. Owner dashboard: secure owner-only interface for leads, opportunities, listings, approvals, workflow health, and reports.
7. AI: Workers AI or another provider only after quotas, privacy, and secrets are checked.

Preferred data routing:
- Customer enquiry -> customers (only if a verified table/API exists).
- Property/service search request -> opportunities (only if a verified table/API exists).
- Listing offer -> listings with pending status.
These are business categories, not authorization to create or modify tables.

## 7. Make scenario plan

Create or complete independently testable scenarios:
1. Website Intake — receive and validate synthetic/real approved payloads.
2. Customer Management — create/update customer through approved API.
3. Opportunity Management — record and track property/service requirements.
4. Listing Review — queue listing offers as pending; owner approval required.
5. Owner Notifications — dashboard notification and approved fallback.
6. AI Assistant Knowledge — expose approved facts/listings only; no invented prices or availability.
7. Follow-up Tasks — owner-approved follow-up reminders and status changes.
8. Management Reports — periodic summary without exposing unnecessary personal data.
9. System Health — detect failed runs, expired connections, and configuration gaps.

Do not build one oversized scenario. Give each scenario clear names, notes, input/output documentation, and a safe test procedure. Keep the CEO Notes content automation separate.

## 8. Security and launch blockers

- Verify owner authentication and authorization for `admin-listings.html`; a password field in a static page is not a full staff identity/session system.
- Review admin token handling and prevent token exposure through browser storage, logs, or accidental sharing.
- Add edge rate limiting and suitable bot protection to public forms.
- Restrict the Make webhook destination to the expected trusted HTTPS Make host; never expose its value.
- Confirm CORS/Origin behavior for actual Pages Preview hostnames.
- Add clear localized error messages for Arabic, English, and Russian.
- Test payload size, invalid fields, missing consent, invalid email/phone, honeypot, duplicate submission, upstream failure, and timeout behavior.
- Ensure no listing is public before explicit moderation.
- Verify D1 binding and schema against live settings without reading customer records.
- Verify Workers AI binding and usage limits before enabling the assistant.
- Verify custom domain status; retain pages.dev as fallback until confirmed.
- Verify privacy notice, consent wording, retention policy, and access controls before public lead collection.

## 9. Phased delivery gates

### Gate 0 — Audit
Deliver a verified map of code, branches, PRs, APIs, D1 schemas, Cloudflare bindings, Make scenarios, and unresolved risks. No writes.

### Gate 1 — Reconcile code
Choose a canonical development branch, reconcile main's six later commits with the 17-commit multilingual branch, then port listing hardening and contact intake carefully. Run CI and code review. No production merge.

### Gate 2 — Preview integrations
Restore Cloudflare authorization through Make or owner-managed Cloudflare access. Configure Preview-only secrets and bindings. Learn the Make webhook schema with synthetic data. Configure rate limiting.

### Gate 3 — Synthetic end-to-end tests
Verify contact intake, listing submission, moderation, assistant behavior, dashboard notifications, and failure handling. No real customer data.

### Gate 4 — Owner approval
Present exact changes, risks, quotas, and rollback plan. Obtain explicit approval for production merge, activation, and deployment.

### Gate 5 — Controlled launch
Deploy in small increments, verify the live site and APIs, monitor errors/usage, and keep rollback available.

### Gate 6 — Handover
Deliver a plain-language owner manual, scenario map, API/data dictionary, connection inventory, test checklist, rollback instructions, and change log.

## 10. Definition of official launch

Do not describe the platform as fully launched until all of the following are verified:
- The intended canonical code is deployed to the intended Pages project.
- Arabic, English, and Russian pages work on desktop and mobile.
- Contact form delivers a synthetic test request end-to-end.
- Listing submission and moderation work; only approved listings are public.
- Owner dashboard authentication is verified.
- AI assistant works within the approved free quota and does not invent facts, or is clearly labelled unavailable.
- Notifications and reports work.
- Rate limiting and privacy controls are active.
- Custom domain status and fallback are documented.
- No secrets appear in public code or logs.
- Owner has the complete handover and rollback guide.

Last status: implementation is in progress; official launch is NOT verified.


## 11. Verified release-candidate status (2026-11-06)

- Release branch: `release/royal-eg-release-candidate-2026-11-06`.
- Draft PR #9: `https://github.com/yasserabdelaziz83-maker/Royal-Egypt-Group/pull/9`.
- Release candidate commit: `f8ff7e6cd9c46a6459882ebb44a4008970e6fb4a`.
- GitHub Jekyll site CI completed successfully for this commit.
- Cloudflare Pages Preview deployment completed successfully; alias: `https://release-royal-eg-release-can.royalegyptgroup.pages.dev`.
- Production branch remains `main`; no Production deployment was made by this release-candidate work.
- Before the isolation fix, Preview was bound to the production D1 database. The release-candidate config now maps Preview to the test database; do not test D1-backed features until Cloudflare confirms the new binding.

### Production D1 schema inventory (names only; no customer rows read)

A read-only query against `sqlite_master` returned:
`_cf_KV`, `_debug`, `agent_approvals`, `agent_audit_log`, `agent_memory`, `agent_tasks`, `agents`, `costs`, `customers`, `daily_summary`, `deals`, `listings`, `opportunities`, `revenue`, `sqlite_sequence`.

The query did not read any customer, lead, listing, deal, revenue, or agent records. Schema definitions and test-database parity still need review. Do not write to Production D1.

### Preview intake state

- The encrypted `MAKE_INTAKE_WEBHOOK_URL` secret is now present in Preview only.
- Make scenario 8408747 remains inactive.
- Its webhook is in one-request learning mode; no payload structure has been captured yet and no deliveries are queued.
- A synthetic Preview POST completed with HTTP 202 and Make captured the payload structure. Learned fields: `event`, `reference`, `request_type`, `status`, `name`, `phone`, `email`, `location`, `details`, `language`, `consent`, `source`, `received_at`. The request used placeholder data only; no customer records were created. Next step: inspect D1 schemas and existing backend APIs, then design the Make routing. Do not activate the intake scenario until mappings and tests are verified.

### Remaining release blockers

1. The Preview Worker settings confirm `AI` is a Workers AI binding. The release candidate also declares `[ai] binding = "AI"` for Preview and Production.
2. Configure a real edge-level abuse control for `/api/intake`; the in-memory assistant limiter is best-effort only.
3. Send one synthetic intake request and verify Make captures the expected schema.
4. Review D1 schema definitions and test-database parity without reading personal records.
5. Verify listing moderation and admin authorization on Preview.
6. Verify all pages and languages visually on the Preview URL.
7. Review privacy/consent wording and error messages.
8. Obtain explicit owner go-live confirmation before merging PR #9 or deploying Production.


### Synthetic intake test result

- One synthetic Preview request returned HTTP 202 (`accepted: true`).
- Make learned the 13 expected payload fields.
- The request used a placeholder name, placeholder phone, and `.invalid` email domain; no real customer details were used.
- The webhook scenario remains inactive and has no queued deliveries. No D1 rows were inserted.
- The one-shot HTTP test scenario is inactive after the test.


### D1 schema comparison — production vs test (2026-11-06)

A read-only `sqlite_master` schema query (no customer or business rows) confirmed that the 12 common business tables are not all structurally identical.

- Production has 12 business tables plus `_cf_KV` and `_debug`; test has the 12 business tables plus `_cf_KV`. SQLite's internal `sqlite_sequence` was excluded from the schema comparison.
- Four common tables differ: `listings`, `agent_approvals`, `agent_memory`, and `agent_tasks`.
- Production `listings` includes `contact_name`, `contact_phone`, `area_sqm`, `images`, and `reviewed_at`; test instead has a legacy `image_url` field and lacks several production fields.
- Production `agent_approvals` has required task/action fields and a foreign key; test has a looser definition.
- Production `agent_memory` has an id, timestamps, and unique(category,key); test uses category/key as its primary key.
- Production `agent_tasks` includes `started_at`; test does not.
- The `customers`, `opportunities`, `agents`, `agent_audit_log`, `costs`, `daily_summary`, `deals`, and `revenue` definitions match in the inspected output.

**Decision:** do not write to the test database or run migrations yet. First inspect the existing Worker code and all consumers, prepare a non-destructive forward migration for test, and verify backups/rollback. Never "fix" this by dropping/recreating either database.


### Test-isolation requirement (binding constraint)

Prior project instructions require that testing use the separate test environment and never write to Production or the real-estate production D1 database. A read-only configuration audit found that Pages Preview had been bound to the Production D1 database. The release candidate now declares explicit Wrangler environments:
- Preview → `royal-ai-business-center-test` (`6e57492c-717d-4fb6-b122-75e5c14cf161`)
- Production → `royal-eg-listings` (`23185e4e-d299-41b2-abd7-bc533466e94a`)

Do not run listing API, assistant, or CRM tests until the latest Preview deployment is confirmed to use the test database. No D1 writes have been made by this release-candidate work.


### Preview runtime binding verification

Cloudflare's Preview Pages Worker settings now show:
- `DB` → test D1 database `6e57492c-717d-4fb6-b122-75e5c14cf161`.
- `AI` → Workers AI binding.
- `ADMIN_TOKEN` and `MAKE_INTAKE_WEBHOOK_URL` → encrypted secrets.

Production remains bound to `royal-eg-listings`. No Production D1 writes or deployments were performed.


### Assistant Preview test result

- Cloudflare Preview Worker settings show the `AI` binding.
- The Pages Function successfully answered synthetic questions in English, Arabic, and Russian (HTTP 200).
- The assistant reads only approved public listing fields from the Preview test D1 database; no customer contact records are queried.
- Direct Workers AI test confirmed `@cf/google/gemma-4-26b-a4b-it` is available. The probe used under 1 Neuron.
- Cloudflare's current Workers AI free allocation is 10,000 Neurons/day; exceeding it stops further free-plan requests until the daily reset. No paid plan was enabled.
