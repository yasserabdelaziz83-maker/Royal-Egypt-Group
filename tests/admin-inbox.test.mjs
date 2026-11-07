import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/admin/inbox.js";

const token = "synthetic-admin-token";
class FakeDB {
  constructor() {
    this.calls = [];
    this.rows = {
      customers: [{ id: "c1", name: "Synthetic", status: "new" }],
      opportunities: [{ id: "o1", title: "Synthetic opportunity", status: "new" }],
      listings: [{ id: "l1", title: "Synthetic listing", status: "pending" }]
    };
  }
  prepare(sql) {
    this.calls.push(sql);
    return {
      all: async () => {
        if (sql.includes("FROM customers")) return { results: this.rows.customers };
        if (sql.includes("FROM opportunities")) return { results: this.rows.opportunities };
        if (sql.includes("FROM listings")) return { results: this.rows.listings };
        return { results: [] };
      },
      bind: (...values) => ({
        run: async () => {
          this.calls.push(values);
          return { meta: { changes: values[1] === "missing" ? 0 : 1 } };
        }
      })
    };
  }
}
function request(method, body, auth = `Bearer ${token}`) {
  return new Request("https://example.test/api/admin/inbox", {
    method,
    headers: {
      ...(auth ? { authorization: auth } : {}),
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

test("rejects missing admin token", async () => {
  const response = await onRequest({ request: request("GET", null, ""), env: { DB: new FakeDB(), ADMIN_TOKEN: token } });
  assert.equal(response.status, 401);
});

test("rejects incorrect admin token", async () => {
  const response = await onRequest({ request: request("GET", null, "Bearer wrong"), env: { DB: new FakeDB(), ADMIN_TOKEN: token } });
  assert.equal(response.status, 401);
});

test("returns customers, opportunities and listings to an authenticated owner", async () => {
  const response = await onRequest({ request: request("GET"), env: { DB: new FakeDB(), ADMIN_TOKEN: token } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.customers.length, 1);
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.listings.length, 1);
  assert.equal(result.listings[0].status, "pending");
});

test("updates an allowlisted customer status", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request("PATCH", { type: "customer", id: "c1", status: "contacted" }),
    env: { DB: db, ADMIN_TOKEN: token }
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "contacted");
});

test("rejects an invalid status", async () => {
  const response = await onRequest({
    request: request("PATCH", { type: "customer", id: "c1", status: "delete_everything" }),
    env: { DB: new FakeDB(), ADMIN_TOKEN: token }
  });
  assert.equal(response.status, 400);
});

test("rejects listing status changes through the generic inbox endpoint", async () => {
  const response = await onRequest({
    request: request("PATCH", { type: "listing", id: "l1", status: "approved" }),
    env: { DB: new FakeDB(), ADMIN_TOKEN: token }
  });
  assert.equal(response.status, 400);
});

test("returns 404 when a record is not found", async () => {
  const response = await onRequest({
    request: request("PATCH", { type: "opportunity", id: "missing", status: "qualified" }),
    env: { DB: new FakeDB(), ADMIN_TOKEN: token }
  });
  assert.equal(response.status, 404);
});
