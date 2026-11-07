# Contact intake — preview-only setup

This change adds a multilingual contact form to the home page and a Pages Function at `POST /api/intake`. The function forwards validated submissions to Make. It does not write to D1 and does not publish listings.

## Required Cloudflare Pages Preview setting

In the `royalegyptgroup` Pages project, configure this **Preview environment secret only**:

- Name: `MAKE_INTAKE_WEBHOOK_URL`
- Value: the Make Custom Webhook URL for the inactive scenario `Royal Egypt – Secure Website Intake`

Do not put the webhook URL in HTML, JavaScript, Git, a public variable, or chat. Do not add it to the Production environment during testing.

## Before sending a sample

1. Confirm the branch preview deployment is ready.
2. Add the secret above to Preview settings and redeploy the preview.
3. Add a Cloudflare rate-limiting rule for the preview hostname and path `/api/intake` (suggested starting threshold: 5 requests per IP per 60 seconds; block or managed-challenge excess requests).
4. Confirm the Make scenario remains inactive and still contains only its Custom Webhook trigger.
5. Send one synthetic test record only. Do not use a real customer's personal data.

## Request behavior

- Accepts JSON only, up to 10 KiB.
- Allows only the Royal Egypt Pages hostname and its Pages preview hostnames as Origin.
- Validates request type, language, name, phone, optional email, details, and explicit consent.
- Rejects a filled honeypot field.
- Uses an opaque reference ID in the browser response.
- Does not expose Make's URL or response body to the browser.
- Forwards listing offers with `status: pending_review`; no listing is published.
- Does not connect to D1. No production data is read or changed.

## Important limits

The application-level checks are not a substitute for edge rate limiting or a managed bot challenge. Configure the Cloudflare rule before allowing public use. This branch is for preview/testing only; do not merge until the preview and security checks pass.
