const MAX_REQUESTS_PER_IP_PER_MINUTE = 10;

async function allowRequest(db, ip) {
  // Keep assistant buckets separate from website-intake buckets; never store raw IPs.
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("assistant:" + ip)
  );
  const ipHash = Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
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

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  }
});

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  if (!env.DB) {
    return json({ error: "assistant_protection_unavailable" }, 503);
  }

  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  try {
    if (!await allowRequest(env.DB, clientIp)) {
      return json({ error: "rate_limited" }, 429);
    }
  } catch {
    // Fail closed: the assistant must not become an unmetered public AI endpoint.
    return json({ error: "assistant_protection_unavailable" }, 503);
  }

  if (!env.AI || typeof env.AI.run !== "function") {
    return json({ error: "assistant_not_configured" }, 503);
  }

  let body;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 12_000) {
      return json({ error: "message_too_long" }, 413);
    }
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !Array.isArray(body.messages) || body.messages.length < 1) {
    return json({ error: "messages_required" }, 400);
  }

  const messages = body.messages.slice(-8).map(item => {
    if (!item || !["user", "assistant"].includes(item.role) ||
        typeof item.content !== "string" || !item.content.trim()) {
      return null;
    }
    return { role: item.role, content: item.content.trim().slice(0, 1_500) };
  });

  if (messages.some(item => !item) || !messages.some(item => item.role === "user")) {
    return json({ error: "invalid_messages" }, 400);
  }

  let approvedListings = [];
  let listingsState = "unavailable";
  try {
    const { results } = await env.DB.prepare(
      "SELECT title,property_type,location,area_sqm,price,purpose,description FROM listings WHERE status='approved' ORDER BY created_at DESC LIMIT 20"
    ).all();
    approvedListings = (results || []).map(row => ({
      title: String(row.title || "").slice(0, 140),
      property_type: String(row.property_type || "").slice(0, 80),
      location: String(row.location || "").slice(0, 180),
      area_sqm: row.area_sqm ?? null,
      price: row.price ?? null,
      purpose: row.purpose ?? null,
      description: String(row.description || "").slice(0, 500)
    }));
    listingsState = "loaded";
  } catch {
    listingsState = "unavailable";
  }

  const listingsContext = listingsState === "loaded"
    ? JSON.stringify(approvedListings)
    : "unavailable — do not claim that no listings exist; ask the visitor to contact the team to confirm.";

  const system = [
    "You are the multilingual customer assistant for Royal Egypt Group in Egypt.",
    "LANGUAGE REQUIREMENT: Detect the language of the latest user message and write the entire answer in that language.",
    "If the latest user message is in Russian, answer entirely in natural Russian using Cyrillic. Do not answer in Arabic or English unless explicitly requested.",
    "If the latest user message is in English, answer entirely in English.",
    "If the latest user message is in Arabic, answer entirely in Arabic.",
    "Ignore the language of earlier messages when choosing the response language; use the latest user message.",
    "Currently ACTIVE services: real-estate marketing, property enquiries, and developer directory only.",
"Coffee and transportation sections exist on the website but are NOT yet operational. If asked about them, say they are coming soon and redirect to active services.",
"Do not invent or describe specific coffee products, transport routes, pricing, or operational details for services that are not yet active.",
    "Use only the facts in this prompt and the approved public listings JSON below. Never claim that a property is currently available unless it appears in that list. If the list is empty, say there are no currently published listings in the website catalogue. If the listings data is unavailable, say you cannot verify current listings and ask the visitor to contact the team.",
    `Approved public listings (JSON): ${listingsContext}`,
    "Never invent prices, availability, legal status, ownership, permits, payment plans, developer endorsements, transport schedules, coffee products, or services that are not confirmed.",
    "For current property availability, prices, documents, or booking, direct visitors to the official WhatsApp button/link shown on the website or to email RoyalEgyptgroup0@gmail.com. Do not rewrite, reorder, or invent phone numbers.",
    "The property catalogue may show published opportunities, but it is not a legal verification or guarantee. Encourage independent document and legal checks before payment.",
    "Do not ask visitors to send passwords, payment-card details, national ID numbers, or sensitive personal information.",
    "Be concise, helpful, welcoming, and practical. Ask one clear follow-up question when needed."
  ].join(" ");

  try {
    const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
      messages: [{ role: "system", content: system }, ...messages],
      chat_template_kwargs: { enable_thinking: false },
      max_tokens: 500
    });
    const answer = [
      result?.response,
      result?.output_text,
      result?.result?.response,
      result?.choices?.[0]?.message?.content,
      result?.result?.choices?.[0]?.message?.content
    ].find(value => typeof value === "string" && value.trim());
    if (typeof answer !== "string" || !answer.trim()) {
      return json({ error: "assistant_unavailable" }, 502);
    }
    return json({ answer: answer.trim() });
  } catch {
    return json({ error: "assistant_unavailable" }, 502);
  }
}
