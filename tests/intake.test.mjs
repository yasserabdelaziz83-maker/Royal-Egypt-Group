import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/intake.js";

const origin = "https://release-royal-eg-release-can.royalegyptgroup.pages.dev";
const webhook = "https://hook.eu1.make.com/test-placeholder";
const requestId = "a9b7c1d2-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const validPayload = {
  request_id: requestId,
  name: "Synthetic Test",
  phone: "+0000000000",
  email: "preview-test@example.invalid",
  request_type: "customer",
  location: "Suez",
  details: "Synthetic integration test only.",
  language: "en",
  consent: true,
  website: ""
};

class FakeDB {
  constructor() { this.records = new Map(); this.rateLimits = new Map(); }
  prepare(sql) {
    return {
      bind: (...values) => ({
        first: async () => {
          if (!sql.includes("intake_rate_limits")) return null;
          const [ipHash, windowStart] = values;
          const previous = this.rateLimits.get(ipHash);
          const count = previous && previous.windowStart === windowStart ? previous.count + 1 : 1;
          this.rateLimits.set(ipHash, { windowStart, count });
          return { request_count: count };
        },
        run: async () => {
          const table = sql.includes("INTO customers") ? "customers" :
            sql.includes("INTO opportunities") ? "opportunities" :
            sql.includes("INTO listings") ? "listings" : "unknown";
          const key = table + ":" + values[0];
          if (this.records.has(key)) return { meta: { changes: 0 } };
          this.records.set(key, { table, values });
          return { meta: { changes: 1 } };
        }
      })
    };
  }
}

function makeRequest(payload = validPayload, requestOrigin = origin, ip = "198.51.100.1") {
  return new Request("https://release-royal-eg-release-can.royalegyptgroup.pages.dev/api/intake", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "origin": requestOrigin,
      "cf-connecting-ip": ip
    },
    body: JSON.stringify(payload)
  });
}

async function withFetch(mock, callback) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await callback(); }
  finally { globalThis.fetch = original; }
}

test("rejects an untrusted Origin without calling Make", async () => {
  let called = false;
  const response = await withFetch(async () => {
    called = true;
    return new Response("unexpected", { status: 200 });
  }, () => onRequest({
    request: makeRequest(validPayload, "https://attacker.example"),
    env: { DB: new FakeDB(), MAKE_INTAKE_WEBHOOK_URL: webhook }
  }));
  assert.equal(response.status, 403);
  assert.equal(called, false);
});

test("rejects missing D1 binding", async () => {
  const response = await onRequest({
    request: makeRequest(),
    env: { MAKE_INTAKE_WEBHOOK_URL: webhook }
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "intake_storage_unavailable");
});

test("rejects missing consent without forwarding or storing", async () => {
  let called = false;
  const db = new FakeDB();
  const response = await withFetch(async () => {
    called = true;
    return new Response("unexpected", { status: 200 });
  }, () => onRequest({
    request: makeRequest({ ...validPayload, consent: false }),
    env: { DB: db, MAKE_INTAKE_WEBHOOK_URL: webhook }
  }));
  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.equal(db.records.size, 0);
});

test("rejects a filled honeypot without forwarding or storing", async () => {
  let called = false;
  const db = new FakeDB();
  const response = await withFetch(async () => {
    called = true;
    return new Response("unexpected", { status: 200 });
  }, () => onRequest({
    request: makeRequest({ ...validPayload, website: "bot-filled" }),
    env: { DB: db, MAKE_INTAKE_WEBHOOK_URL: webhook }
  }));
  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.equal(db.records.size, 0);
});

test("stores a synthetic customer request before notifying Make", async () => {
  let forwarded;
  const db = new FakeDB();
  const response = await withFetch(async (url, init) => {
    assert.equal(url, webhook);
    assert.equal(init.method, "POST");
    forwarded = JSON.parse(init.body);
    assert.equal(db.records.size, 1);
    return new Response("ok", { status: 200 });
  }, () => onRequest({
    request: makeRequest(),
    env: { DB: db, MAKE_INTAKE_WEBHOOK_URL: webhook }
  }));

  assert.equal(response.status, 202);
  const result = await response.json();
  assert.equal(result.accepted, true);
  assert.equal(result.stored, true);
  assert.equal(result.duplicate, false);
  assert.equal(result.reference, requestId);
  assert.equal(result.notification_status, "sent");
  assert.equal(forwarded.request_type, "customer");
  assert.equal(forwarded.name, "Synthetic Test");
  assert.equal(forwarded.website, undefined);
  assert.equal(db.records.size, 1);
});

test("duplicate request id does not create a second record or notify twice", async () => {
  const db = new FakeDB();
  let forwarded = 0;
  const handler = () => onRequest({
    request: makeRequest(),
    env: { DB: db, MAKE_INTAKE_WEBHOOK_URL: webhook }
  });
  await withFetch(async () => {
    forwarded += 1;
    return new Response("ok", { status: 200 });
  }, async () => {
    const first = await handler();
    const second = await handler();
    assert.equal(first.status, 202);
    assert.equal(second.status, 202);
    const result = await second.json();
    assert.equal(result.duplicate, true);
    assert.equal(result.notification_status, "duplicate");
  });
  assert.equal(db.records.size, 1);
  assert.equal(forwarded, 1);
});

test("opportunity requests are written to opportunities", async () => {
  const db = new FakeDB();
  const response = await withFetch(async () => new Response("ok", { status: 200 }), () =>
    onRequest({
      request: makeRequest({ ...validPayload, request_type: "opportunity" }),
      env: { DB: db, MAKE_INTAKE_WEBHOOK_URL: webhook }
    })
  );
  assert.equal(response.status, 202);
  assert.equal([...db.records.values()][0].table, "opportunities");
});

test("listing offers are written as pending", async () => {
  const db = new FakeDB();
  const response = await withFetch(async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.status, "pending_review");
    return new Response("ok", { status: 200 });
  }, () => onRequest({
    request: makeRequest({ ...validPayload, request_type: "listing" }),
    env: { DB: db, MAKE_INTAKE_WEBHOOK_URL: webhook }
  }));
  assert.equal(response.status, 202);
  assert.equal([...db.records.values()][0].table, "listings");
});

test("Make outage does not lose an already stored request", async () => {
  const db = new FakeDB();
  const response = await withFetch(async () => { throw new Error("synthetic outage"); }, () =>
    onRequest({
      request: makeRequest(),
      env: { DB: db, MAKE_INTAKE_WEBHOOK_URL: webhook }
    })
  );
  assert.equal(response.status, 202);
  const result = await response.json();
  assert.equal(result.stored, true);
  assert.equal(result.notification_status, "pending");
  assert.equal(db.records.size, 1);
});

test("limits each client IP to 10 intake requests per minute per isolate", async () => {
  const ip = "203.0.113.77";
  const db = new FakeDB();
  let forwarded = 0;
  const responses = await withFetch(async () => {
    forwarded += 1;
    return new Response("ok", { status: 200 });
  }, async () => {
    const results = [];
    for (let i = 0; i < 11; i += 1) {
      const payload = { ...validPayload, request_id: `a9b7c1d2-4e5f-4a6b-8c7d-9e0f1a2b3c${i.toString(16).padStart(2,"0")}` };
      results.push(await onRequest({
        request: makeRequest(payload, origin, ip),
        env: { DB: db, MAKE_INTAKE_WEBHOOK_URL: webhook }
      }));
    }
    return results;
  });

  assert.deepEqual(responses.map(response => response.status), [
    202, 202, 202, 202, 202, 202, 202, 202, 202, 202, 429
  ]);
  assert.equal(forwarded, 10);
  assert.equal(responses[10].headers.get("access-control-allow-origin"), origin);
});
