const SECURITY_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: SECURITY_HEADERS });
}

export async function onRequest({ request, env }) {
  const auth = request.headers.get("authorization") || "";
  if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.DB) return json({ error: "database_unavailable" }, 503);

  try {
    if (request.method === "GET") {
      const [customers, opportunities, listings] = await Promise.all([
        env.DB.prepare(`
          SELECT id,name,email,phone,language,type,interests,source,status,notes,created_at,updated_at
          FROM customers ORDER BY created_at DESC LIMIT 100
        `).all(),
        env.DB.prepare(`
          SELECT id,title,type,details,country,estimated_value,status,source,url,created_at
          FROM opportunities ORDER BY created_at DESC LIMIT 100
        `).all(),
        env.DB.prepare(`
          SELECT id,contact_name,contact_phone,title,property_type,location,price,purpose,description,status,created_at,reviewed_at
          FROM listings ORDER BY created_at DESC LIMIT 100
        `).all(),
      ]);
      return json({
        customers: customers.results || [],
        opportunities: opportunities.results || [],
        listings: listings.results || [],
        generated_at: new Date().toISOString(),
      });
    }

    if (request.method === "PATCH") {
      let body;
      try { body = await request.json(); }
      catch { return json({ error: "invalid_json" }, 400); }

      if (!body || typeof body !== "object" || typeof body.id !== "string" ||
          !body.id.trim() || !["customer", "opportunity"].includes(body.type)) {
        return json({ error: "invalid_request" }, 400);
      }

      const allowed = new Set(["new", "contacted", "qualified", "closed", "archived"]);
      if (!allowed.has(body.status)) return json({ error: "invalid_status" }, 400);

      const result = body.type === "customer"
        ? await env.DB.prepare(
            "UPDATE customers SET status=?, updated_at=datetime('now') WHERE id=?"
          ).bind(body.status, body.id.trim()).run()
        : await env.DB.prepare(
            "UPDATE opportunities SET status=? WHERE id=?"
          ).bind(body.status, body.id.trim()).run();

      if (!result.meta?.changes) return json({ error: "record_not_found" }, 404);
      return json({ ok: true, type: body.type, id: body.id, status: body.status });
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
}
