# Royal Egypt Group

A multilingual group website and business platform for Royal Egypt Group.

## Website divisions
- Group homepage: Arabic-first, with Arabic / English / Russian interface support.
- Royal Egypt Properties: property catalogue, search, enquiry assistant, and moderated listing submissions.
- Developer directory: informational directory with official-source links and a non-endorsement disclaimer.
- Royal Egypt Coffee: introductory division page; online ordering is not yet active.
- Royal Egypt Transportation: introductory division page; booking is not yet active.
- Shared multilingual assistant: Cloudflare Workers AI endpoint, requiring the Pages binding `AI`.

## Architecture
- Frontend and server-side functions: Cloudflare Pages.
- Source control and review: GitHub.
- Database: Cloudflare D1 (binding `DB`).
- Automation: Make, through server-side endpoints and encrypted environment secrets.
- Listing moderation: submissions default to pending; only approved listings appear publicly.

## Current operational constraints
- Public contact intake is a release-candidate integration and is not live until the Make webhook secret, edge rate limiting, webhook payload learning, and synthetic Preview test are complete.
- Workers AI requires the Cloudflare Pages binding `AI` and is subject to current account quotas.
- Coffee ordering, transportation booking, and full CRM workflows are future phases, not active transactional systems.
- Property details, prices, availability, ownership, permits, and payment terms must be confirmed before any transaction.
- Do not publish a listing automatically; owner approval is mandatory.
- Never commit secrets or personal customer records.

## Deployment
- Current known Pages hostname: https://royalegyptgroup.pages.dev
- Preferred custom domain: https://royalegyptgroup.com (must be verified before switching canonical URLs).
- Use a Preview deployment and synthetic data for all integration tests before Production.
- See `.github/PROJECT_OPERATIONS.md` for the verified operations map, launch gates, security checklist, and handover requirements.
