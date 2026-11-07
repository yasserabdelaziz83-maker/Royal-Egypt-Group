export async function onRequest({ request, env }) {
  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });

  const auth = request.headers.get("authorization") || "";
  if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return json({ error: "غير مصرح" }, 401);
  }
  if (!env.DB) return json({ error: "قاعدة بيانات D1 غير مربوطة" }, 503);

  try {
    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM listings WHERE status='pending' ORDER BY created_at ASC LIMIT 100"
      ).all();
      return json({ listings: (results || []).map(row => ({ ...row, images: [] })) });
    }

    if (request.method === "PATCH") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "صيغة الطلب غير صحيحة" }, 400);
      }

      if (
        !body ||
        typeof body.id !== "string" ||
        !body.id.trim() ||
        !["approved", "rejected"].includes(body.status)
      ) {
        return json({ error: "بيانات غير صحيحة" }, 400);
      }

      const result = await env.DB.prepare(
        "UPDATE listings SET status=?, reviewed_at=datetime('now') WHERE id=? AND status='pending'"
      ).bind(body.status, body.id.trim()).run();

      if (!result.meta?.changes) {
        return json({ error: "الإعلان غير موجود أو تمت مراجعته بالفعل" }, 404);
      }
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch {
    // Do not expose database details or submitted personal data to the browser.
    return json({ error: "حدث خطأ داخلي أثناء معالجة الطلب." }, 500);
  }
}
