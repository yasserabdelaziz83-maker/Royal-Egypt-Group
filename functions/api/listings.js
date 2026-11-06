export async function onRequest({ request, env }) {
  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });

  if (!env.DB) return json({ error: "قاعدة بيانات الإعلانات غير مربوطة بعد." }, 503);

  if (request.method === "GET") {
    try {
      const { results } = await env.DB.prepare(
        "SELECT id,title,property_type,location,area_sqm,price,purpose,description,images,created_at FROM listings WHERE status='approved' ORDER BY created_at DESC LIMIT 100"
      ).all();
      return json({ listings: (results || []).map(row => ({ ...row, images: [] })) });
    } catch {
      return json({ error: "تعذر تحميل الإعلانات حاليًا." }, 500);
    }
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let data;
  try {
    data = await request.formData();
  } catch {
    return json({ error: "صيغة البيانات غير صحيحة. أعد إرسال النموذج." }, 400);
  }

  const value = key => String(data.get(key) ?? "").trim();
  const required = ["contact_name", "contact_phone", "title", "property_type", "location", "description"];
  for (const key of required) {
    if (!value(key)) return json({ error: "يرجى استكمال الحقول المطلوبة." }, 400);
  }

  // Enforce limits on the server; browser-side maxlength is not a security boundary.
  const limits = {
    contact_name: 100,
    contact_phone: 30,
    title: 140,
    property_type: 80,
    location: 180,
    price: 80,
    purpose: 30,
    description: 3000
  };
  for (const [key, max] of Object.entries(limits)) {
    if (value(key).length > max) {
      return json({ error: "أحد الحقول أطول من الحد المسموح. راجع البيانات وحاول مرة أخرى." }, 400);
    }
  }

  const phone = value("contact_phone");
  if (!/^[+0-9()\s.-]{7,30}$/.test(phone) || !/[0-9]{7}/.test(phone)) {
    return json({ error: "يرجى إدخال رقم هاتف صحيح." }, 400);
  }

  if (data.get("consent") !== "on") {
    return json({ error: "الموافقة مطلوبة لإرسال الإعلان." }, 400);
  }

  const areaRaw = value("area_sqm");
  let area = null;
  if (areaRaw) {
    area = Number(areaRaw);
    if (!Number.isFinite(area) || area <= 0 || area > 10000000) {
      return json({ error: "المساحة يجب أن تكون رقمًا موجبًا وصحيحًا." }, 400);
    }
  }

  const purpose = value("purpose") || "بيع";
  if (!["بيع", "إيجار", "استثمار"].includes(purpose)) {
    return json({ error: "الغرض المحدد غير صحيح." }, 400);
  }

  const images = data.getAll("images").filter(x =>
    x && typeof x.arrayBuffer === "function" && x.size > 0
  );
  if (images.length) {
    return json({
      error: "استقبال الصور غير متاح حاليًا. أرسل الصور بعد تسجيل الإعلان عبر واتساب Royal Egypt."
    }, 400);
  }

  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(`INSERT INTO listings
      (id,contact_name,contact_phone,title,property_type,location,area_sqm,price,purpose,description,images,status,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',datetime('now'))`)
      .bind(
        id,
        value("contact_name"),
        phone,
        value("title"),
        value("property_type"),
        value("location"),
        area,
        value("price"),
        purpose,
        value("description"),
        "[]"
      )
      .run();

    return json({ id, status: "pending" }, 201);
  } catch {
    return json({ error: "تعذر حفظ الإعلان حاليًا. حاول مرة أخرى لاحقًا." }, 500);
  }
}
