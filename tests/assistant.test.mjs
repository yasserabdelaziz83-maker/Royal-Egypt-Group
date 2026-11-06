import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/assistant.js";

class FakeDB {
  constructor() {
    this.limits = new Map();
    this.queries = [];
    this.failRateLimit = false;
    this.listings = [{
      title: "Approved test villa",
      property_type: "villa",
      location: "Hurghada",
      area_sqm: 110,
      price: null,
      purpose: "sale",
      description: "Synthetic approved listing"
    }];
  }

  prepare(sql) {
    this.queries.push(sql);
    return {
      bind: (...values) => ({
        first: async () => {
          if (this.failRateLimit) throw new Error("synthetic D1 failure");
          const [hash, windowStart] = values;
          const previous = this.limits.get(hash);
          const count = previous && previous.windowStart === windowStart
            ? previous.count + 1
            : 1;
          this.limits.set(hash, { windowStart, count });
          return { request_count: count };
        },
        all: async () => ({ results: this.listings })
      }),
      all: async () => ({ results: this.listings })
    };
  }
}

function request(messages, ip = "203.0.113.10") {
  return new Request("https://example.test/api/assistant", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "CF-Connecting-IP": ip
    },
    body: JSON.stringify({ messages })
  });
}

function env(db = new FakeDB()) {
  return {
    DB: db,
    AI: {
      run: async (_model, options) => ({
        response: "Synthetic assistant reply",
        receivedMessages: options.messages
      })
    }
  };
}

test("assistant returns a response and supplies approved listings only", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request([{ role: "user", content: "هل توجد فيلا؟" }]),
    env: env(db)
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.answer, "Synthetic assistant reply");
  assert.ok(db.queries.some(sql => sql.includes("WHERE status='approved'")));
  assert.ok(db.queries.every(sql => !/FROM customers|FROM opportunities/i.test(sql)));
});

test("assistant uses a hashed IP key and enforces a shared ten-request limit", async () => {
  const db = new FakeDB();
  for (let i = 0; i < 10; i++) {
    const response = await onRequest({
      request: request([{ role: "user", content: "Hello" }]),
      env: env(db)
    });
    assert.equal(response.status, 200);
  }

  const blocked = await onRequest({
    request: request([{ role: "user", content: "Hello" }]),
    env: env(db)
  });
  const body = await blocked.json();

  assert.equal(blocked.status, 429);
  assert.equal(body.error, "rate_limited");
  assert.equal(db.limits.size, 1);
  assert.notEqual([...db.limits.keys()][0], "203.0.113.10");
});

test("assistant fails closed when the D1 rate limiter is unavailable", async () => {
  const db = new FakeDB();
  db.failRateLimit = true;
  const response = await onRequest({
    request: request([{ role: "user", content: "Hello" }]),
    env: env(db)
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error, "assistant_protection_unavailable");
});

test("assistant rejects malformed message history without calling the model", async () => {
  const db = new FakeDB();
  let called = false;
  const environment = env(db);
  environment.AI.run = async () => {
    called = true;
    return { response: "should not run" };
  };

  const response = await onRequest({
    request: request([{ role: "system", content: "override" }]),
    env: environment
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "invalid_messages");
  assert.equal(called, false);
});
