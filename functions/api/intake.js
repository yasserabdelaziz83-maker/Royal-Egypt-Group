const MAX_BODY_BYTES = 10 * 1024;
const ALLOWED_TYPES = new Set(["customer", "opportunity", "listing"]);
const ALLOWED_LANGUAGES = new Set(["ar", "en", "ru"]);
const TRUSTED_WEBHOOK_HOST = "hook.eu1.make.com";
const MAX_REQUESTS_PER_IP_PER_MINUTE = 10;
const SECURITY_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

async function allowRequest(db, ip) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const ipHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const windowStart = Math.floor(Date.now() / 60_000);
  const row = await db.prepare(`
    INSERT INTO intake_rate_limits (ip_hash, window_start, request_count, updated_at)
    VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(ip_hash) DO UPDATE SET
      request_count = CASE
        WHEN intake_rate_limits.window_start = excluded.window_start
          THEN intake_rate_limits.request_count + 1
        ELSE 1
      END,
      window_start = excluded.window_start,
      updated_at = datetime('now')
    RETURNING request_count
  `).bind(ipHash, windowStart).first();
  return Number(row?.request_count || 0) <= MAX_REQUESTS_PER_IP_PER_MINUTE;
}

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

function trustedWebhook(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === TRUSTED_WEBHOOK_HOST &&
      !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

function isUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function saveIntake(env, item) {
  const id = item.reference;
  let result;
  if (item.request_type === "customer") {
    result = await env.DB.prepare(`
      INSERT OR IGNORE INTO customers
        (id,name,email,phone,language,type,interests,source,status,notes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
    `).bind(
      id, item.name, item.email, item.phone, item.language,
      "website_inquiry", item.details, "website", "new", item.location
    ).run();
  } else if (item.request_type === "opportunity") {
    result = await env.DB.prepare(`
      INSERT OR IGNORE INTO opportunities
        (id,title,type,details,country,estimated_value,status,source,url,created_at)
      VALUES (?,?,?,?,?,NULL,'new','website',NULL,datetime('now'))
    `).bind(
      id, item.details.slice(0, 140) || "Website opportunity",
      "property_search", item.details, item.location
    ).run();
  } else {
    result = await env.DB.prepare(`
      INSERT OR IGNORE INTO listings
        (id,contact_name,contact_phone,title,property_type,location,price,purpose,description,images,status,created_at)
      VALUES (?,?,?,?,?,?,NULL,NULL,?,'[]','pending',datetime('now'))
    `).bind(
      id, item.name, item.phone, item.details.slice(0, 140) || "New property offer",
      "unspecified", item.location || "Not specified", item.details
    ).run();
  }
  return Number(result?.meta?.changes || 0) > 0;
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

  if (!env.DB) return json({ error: "intake_storage_unavailable" }, 503, origin);
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  try {
    if (!await allowRequest(env.DB, clientIp)) return json({ error: "rate_limited" }, 429, origin);
  } catch {
    return json({ error: "intake_protection_unavailable" }, 503, origin);
  }
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return json({ error: "json_required" }, 415, origin);
  }

  let raw;
  try { raw = await request.text(); }
  catch { return json({ error: "invalid_body" }, 400, origin); }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413, origin);
  }

  let input;
  try { input = JSON.parse(raw); }
  catch { return json({ error: "invalid_json" }, 400, origin); }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return json({ error: "invalid_payload" }, 400, origin);
  }
  if (clean(input.website, 200)) return json({ error: "submission_rejected" }, 400, origin);

  const name = clean(input.name, 100);
  const phone = clean(input.phone, 24);
  const email = clean(input.email, 160);
  const requestType = clean(input.request_type, 30);
  const location = clean(input.location, 180);
  const details = clean(input.details, 3000);
  const language = clean(input.language, 2);
  const digits = phone.replace(/\D/g, "");
  if (name.length < 2 || digits.length < 7 || digits.length > 15 ||
      !details || !ALLOWED_TYPES.has(requestType) ||
      !ALLOWED_LANGUAGES.has(language) || input.consent !== true) {
    return json({ error: "validation_failed" }, 400, origin);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ error: "invalid_email" }, 400, origin);
  }

  const reference = isUuid(input.request_id) ? input.request_id : crypto.randomUUID();
  const forwarded = {
    event: "royal_egypt_website_intake",
    reference,
    request_type: requestType,
    status: requestType === "listing" ? "pending_review" : "new",
    name, phone, email: email || null, location: location || null,
    details, language, consent: true,
    source: "royalegyptgroup.pages.dev",
    received_at: new Date().toISOString(),
  };

  let inserted;
  try {
    inserted = await saveIntake(env, forwarded);
  } catch {
    return json({ error: "intake_storage_failed" }, 503, origin);
  }

  // The database is authoritative. Make is an optional orchestration/notification layer.
  // A webhook outage must never make the visitor submit the same lead again.
  let notificationStatus = "not_configured";
  if (inserted && env.MAKE_INTAKE_WEBHOOK_URL && trustedWebhook(env.MAKE_INTAKE_WEBHOOK_URL)) {
    try {
      const upstream = await fetch(env.MAKE_INTAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(forwarded),
      });
      notificationStatus = upstream.ok ? "sent" : "pending";
    } catch {
      notificationStatus = "pending";
    }
  } else if (!inserted) {
    notificationStatus = "duplicate";
  } else if (env.MAKE_INTAKE_WEBHOOK_URL) {
    notificationStatus = "configuration_error";
  }

  return json({
    accepted: true,
    stored: true,
    duplicate: !inserted,
    reference,
    notification_status: notificationStatus,
  }, 202, origin);
}
