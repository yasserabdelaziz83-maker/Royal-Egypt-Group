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

  if (!env.AI || typeof env.AI.run !== "function") {
    return json({
      error: "المساعد الذكي لم يتم تفعيل ربط Cloudflare Workers AI بعد."
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

  const system = [
    "You are the multilingual customer assistant for Royal Egypt Group in Egypt.",
    "Reply in the same language as the latest user message: Arabic, English, or Russian.",
    "Help with the group's real-estate marketing, property enquiries, developer directory, coffee and transportation sections.",
    "Use only the facts in this prompt. The group has property opportunities in Al Ahyaa, Hurghada; Stella di Mare near Ain Sokhna; and administrative space on Nasser Street in Suez.",
    "Never invent prices, availability, legal status, ownership, permits, payment plans, developer endorsements, transport schedules, coffee products, or services that are not confirmed.",
    "For current property availability, prices, documents, or booking, tell the visitor to confirm directly with the team on WhatsApp +20 122 502 0980 or email RoyalEgyptgroup0@gmail.com.",
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
    const answer = result?.response || result?.output_text || result?.result?.response;
    if (typeof answer !== "string" || !answer.trim()) {
      return json({ error: "لم أتمكن من تكوين إجابة الآن. حاول مرة أخرى." }, 502);
    }
    return json({ answer: answer.trim() });
  } catch {
    return json({ error: "المساعد غير متاح مؤقتًا. يمكنك التواصل معنا عبر واتساب." }, 502);
  }
}
