const requestBuckets = new Map();

function allowRequest(ip) {
  const now = Date.now();
  const bucket = requestBuckets.get(ip);
  if (!bucket || now - bucket.startedAt >= 60_000) {
    requestBuckets.set(ip, { startedAt: now, count: 1 });
    if (requestBuckets.size > 500) {
      for (const [key, value] of requestBuckets) {
        if (now - value.startedAt >= 60_000) requestBuckets.delete(key);
      }
    }
    return true;
  }
  if (bucket.count >= 10) return false;
  bucket.count += 1;
  return true;
}

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  }
});

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Best-effort per-isolate guard; configure Cloudflare edge rate limiting for global enforcement.
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!allowRequest(clientIp)) return json({ error: "rate_limited" }, 429);

  if (!env.AI || typeof env.AI.run !== "function") {
    return json({
      error: "assistant_not_configured"
    }, 503);
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 12000) return json({ error: "الرسالة أطول من الحد المسموح." }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "صيغة الطلب غير صحيحة." }, 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length < 1) {
    return json({ error: "اكتب سؤالك أولاً." }, 400);
  }

  const messages = body.messages.slice(-8).map(item => {
    if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") {
      return null;
    }
    return { role: item.role, content: item.content.slice(0, 1500) };
  });

  if (messages.some(item => !item) || !messages.some(item => item.role === "user")) {
    return json({ error: "محتوى المحادثة غير صالح." }, 400);
  }

  let approvedListings = [];
  let listingsState = "unavailable";
  if (env.DB) {
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
  }

  const listingsContext = listingsState === "loaded"
    ? JSON.stringify(approvedListings)
    : "unavailable — do not claim that no listings exist; ask the visitor to contact the team to confirm.";

  const system = [
    "You are the multilingual customer assistant for Royal Egypt Group in Egypt.",
    "Reply in the same language as the latest user message: Arabic, English, or Russian.",
    "Help with the group's real-estate marketing, property enquiries, developer directory, coffee and transportation sections.",
    "Use only the facts in this prompt and the approved public listings JSON below. Never claim that a property is currently available unless it appears in that list. If the list is empty, say there are no currently published listings in the website catalogue. If the listings data is unavailable, say you cannot verify current listings and ask the visitor to contact the team.",
    `Approved public listings (JSON): ${listingsContext}`,
    "Never invent prices, availability, legal status, ownership, permits, payment plans, developer endorsements, transport schedules, coffee products, or services that are not confirmed.",
    "For current property availability, prices, documents, or booking, direct visitors to the official WhatsApp button/link shown on the website or to email RoyalEgyptgroup0@gmail.com. Do not rewrite, reorder, or invent phone numbers.",
    "The property catalogue may show published opportunities, but it is not a legal verification or guarantee. Encourage independent document and legal checks before payment.",
    "Do not ask visitors to send passwords, payment-card details, national ID numbers, or sensitive personal information.",
    "Be concise, helpful, welcoming, and practical. Ask one clear follow-up question when needed."
  ].join(" ");

  try {
    const result = await env.AI.run("@cf/google/gemma-4-26b-a4b-it", {
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
