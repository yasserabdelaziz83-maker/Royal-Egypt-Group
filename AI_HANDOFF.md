# Royal Egypt Group — AI Project Handoff

Last updated: 2026-11-05

## Mission
Build and operate the Royal Egypt Group web platform and, later, a persistent assistant/agent hosted on Cloudflare. The owner wants the platform to remain as free as reasonably possible. Never promise that every component or AI usage will remain free; verify current plan limits before enabling paid usage.

## Organization structure
- Royal Egypt Group (parent)
- Royal Egypt Properties
- Royal Egypt Coffee
- Royal Egypt Transportation

Company context: شركة رويال ايجبت للتسويق العقاري.

Preferred public domain: https://royalegyptgroup.com/
Current Cloudflare Pages hostname seen by the owner: https://royalegyptgroup.pages.dev

## Repository
- GitHub: https://github.com/yasserabdelaziz83-maker/Royal-Egypt-Group
- Default branch: main

Known files:
- index.html
- properties.html
- developers.html
- coffee.html
- transportation.html
- admin-listings.html
- functions/
- migrations/
- wrangler.toml
- CLOUDFLARE_LISTINGS_SETUP.md
- README.md
- assets/
- royal-logo.jpg
- _headers
- robots.txt
- sitemap.xml

## Product requirements
1. Arabic-first, right-to-left responsive website, with English/Russian support considered for marketing.
2. Real-estate listings submission with moderation: submitted listings must not become public until an administrator approves them.
3. Property search / intelligent real-estate assistant.
4. Developer directory with official sources and clear non-endorsement disclaimer.
5. Royal Egypt Coffee and Royal Egypt Transportation sections.
6. Admin dashboard for reviewing and managing listings.
7. Future persistent Royal Egypt agent that can retain project context, maintain a task queue, inspect the repository, propose code changes, and report results.

## Existing implementation notes (not yet independently re-verified against live deployment)
- Feature branch redesigns `index.html` with a photographic property cover hero and Arabic/English/Russian controls; the hero currently references an Unsplash-hosted image URL.
- properties.html has a listing submission flow using POST /api/listings and reads listings via GET /api/listings.
- A shared multilingual assistant UI and `/api/assistant` endpoint have been added on feature branch `feature/multilingual-hero-assistant-2026-11-05`. The endpoint expects a Cloudflare Pages Workers AI binding named `AI`; it is not live until the binding is added in Cloudflare Pages Settings > Functions > Bindings > Add > Workers AI, variable name `AI`, followed by a redeploy. The prior properties-page keyword assistant is intercepted by the shared UI script and routed to this endpoint.
- developers.html contains a static developer directory and filtering; it states directory presence is not Royal Egypt endorsement or guarantee.
- coffee.html and transportation.html were previously noted as informational / coming-soon pages, not complete booking systems.
- Listing images were previously described as being sent via WhatsApp because direct image storage was not fully configured.
- admin-listings.html exists but its authentication and authorization must be audited before use.

## Cloudflare deployment state — needs verification
- Workers AI pricing checked 2026-11-05: Cloudflare documents 10,000 Neurons/day at no charge on Workers Free; usage beyond this requires Workers Paid and is billed at $0.011 per 1,000 Neurons. On Free, further operations fail after the daily free allocation. Monitor usage before public launch.
- A Cloudflare Pages project named/associated with royalegyptgroup was visible to the owner.
- At least one deployment was reported successful.
- A separate deployment attempt reported: "Failed to publish your function", apparently related to database configuration.
- wrangler.toml previously showed a D1 binding named DB for database royal-eg-listings.
- The owner previously saw "You have no D1 database"; it is not confirmed whether the D1 database was subsequently created and correctly bound to the Pages project.
- Next diagnostic: in the correct Cloudflare account, open the royalegyptgroup Pages project → Settings → Functions → D1 database bindings. Confirm binding variable DB points to database royal-eg-listings. Do not create duplicate databases or change production settings until the current configuration is inspected.
- Never assume R2 binding PROPERTY_IMAGES exists; it was referenced in code but not confirmed in the deployment configuration.

## Agent architecture target
Build incrementally, with security first:
- Cloudflare Worker / Pages Functions as the authenticated agent API.
- D1 for durable project memory, task records, audit events, and (if needed) approved content metadata.
- GitHub as the source of truth for code and version history.
- An AI model provider only after its pricing, free limits, data handling, and secrets configuration are checked. Do not hardcode API keys.
- A simple private admin interface for submitting tasks and reviewing proposed changes.
- Scheduled/background execution only after explicit setup and clear limits.

## Safety and operating rules
- Do not expose admin tokens, API keys, passwords, or personal data in chat, source code, logs, or public repository files.
- Store secrets only in Cloudflare encrypted secrets / environment settings.
- Do not automatically publish listings, send marketing messages, contact developers, spend money, buy services, change DNS, or deploy production changes without explicit owner approval.
- Agent may research public developer information and prepare drafts; outreach requires explicit approval and must respect website terms, privacy, and anti-spam rules.
- Prefer free services, but clearly disclose quotas, limits, and possible charges before enabling any metered feature.
- Make changes on a separate branch or via pull request where practical; preserve working production deployments.
- Verify code and deployment behavior; distinguish repository inspection from live-site testing.
- Keep this handoff document updated when verified decisions or project status materially change.

## Immediate next steps
1. Verify D1 database and Pages binding DB in the correct Cloudflare account.
2. Inspect current functions/, migrations/, wrangler.toml, and admin-listings.html together; reconcile schema and runtime bindings.
3. Fix and test listing API and moderation flow without breaking the last successful deployment.
4. Audit admin authentication.
5. Design the persistent agent API and memory schema only after the current D1 setup is verified.
6. Add an explicit approval gate for all production deployments and external actions.
7. For feature branch `feature/multilingual-hero-assistant-2026-11-05`, add the Pages Workers AI binding `AI` in Cloudflare Dashboard before expecting `/api/assistant` to return model responses. The endpoint uses `@cf/google/gemma-4-26b-a4b-it`, validates request size and message roles, and instructs the model not to invent prices, availability, legal status or guarantees.

## Conversation continuity
This file is a curated project handoff, not a full export of ChatGPT conversations. New important decisions, requirements, and verified progress should be summarized here. Do not claim Cloudflare can automatically import the user's ChatGPT chat history.
