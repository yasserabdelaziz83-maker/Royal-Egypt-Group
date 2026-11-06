const MAX_BODY_BYTES = 10 * 1024;
const ALLOWED_TYPES = new Set(["customer", "opportunity", "listing"]);
const ALLOWED_LANGUAGES = new Set(["ar", "en", "ru"]);
const SECURITY_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

function json(data, status, origin) {
  const headers = new Headers(SECURITY_HEADERS);
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function allowedOrigin(origin) {
  if (!origin) return false;
  return origin === "https://royalegyptgroup.pages.dev" ||
    /^https:\/\/[a-z0-9-]+\.royalegyptgroup\.pages\.dev$/i.test(origin);
}

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function onRequest({ request, env }) {
  const origin = request.headers.get("Origin") || "";
  if (!allowedOrigin(origin)) return json({ error: "origin_not_allowed" }, 403);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "Content-Type",
      "access-control-max-age": "600",
      "vary": "Origin",
    }});
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
  if (!env.MAKE_INTAKE_WEBHOOK_URL) return json({ error: "intake_not_configured" }, 503, origin);
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return json({ error: "json_required" }, 415, origin);
  }

  let raw;
  try { raw = await request.text(); } catch { return json({ error: "invalid_body" }, 400, origin); }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413, origin);

  let input;
  try { input = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400, origin); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: "invalid_payload" }, 400, origin);

  // Honeypot: bots commonly fill hidden fields; never forward these submissions.
  if (clean(input.website, 200)) return json({ error: "submission_rejected" }, 400, origin);
  const name = clean(input.name, 100);
  const phone = clean(input.phone, 24);
  const email = clean(input.email, 160);
  const requestType = clean(input.request_type, 30);
  const location = clean(input.location, 180);
  const details = clean(input.details, 3000);
  const language = clean(input.language, 2);
  const digits = phone.replace(/\D/g, "");

  if (name.length < 2 || digits.length < 7 || digits.length > 15 || !details || !ALLOWED_TYPES.has(requestType) || !ALLOWED_LANGUAGES.has(language) || input.consent !== true) {
    return json({ error: "validation_failed" }, 400, origin);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "invalid_email" }, 400, origin);

  const reference = crypto.randomUUID();
  const forwarded = {
    event: "royal_egypt_website_intake",
    reference,
    request_type: requestType,
    status: requestType === "listing" ? "pending_review" : "new",
    name, phone, email: email || null, location: location || null, details,
    language,
    consent: true,
    source: "royalegyptgroup.pages.dev",
    received_at: new Date().toISOString(),
  };

  try {
    const upstream = await fetch(env.MAKE_INTAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(forwarded),
    });
    if (!upstream.ok) return json({ error: "upstream_unavailable" }, 502, origin);
    return json({ accepted: true, reference }, 202, origin);
  } catch {
    return json({ error: "upstream_unavailable" }, 502, origin);
  }
}
