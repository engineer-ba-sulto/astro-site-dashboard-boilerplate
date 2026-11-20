import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import type { ApiBindings } from "./bindings";
import { createApp } from "./index";

const schemaSql = `
create table contacts (
  id integer primary key autoincrement not null,
  name text,
  email text not null,
  category text,
  message text not null,
  status text default 'new' not null,
  admin_note text,
  ip_hash text,
  user_agent text,
  created_at integer not null,
  updated_at integer not null,
  deleted_at integer
);
create index contacts_status_created_at_idx on contacts (status, created_at);
create index contacts_created_at_idx on contacts (created_at);
create index contacts_ip_hash_created_at_idx on contacts (ip_hash, created_at);
create table contact_attempts (
  id integer primary key autoincrement not null,
  ip_hash text not null,
  created_at integer not null
);
`;

function createMemoryD1(): D1Database {
  const sqlite = new Database(":memory:");
  sqlite.exec(schemaSql);
  const wrap = (query: string, params: unknown[]) => ({
    bind(...next: unknown[]) {
      return wrap(query, next);
    },
    async run() {
      sqlite.run(query, params as never[]);
      const idRow = sqlite.query("select last_insert_rowid() as id").get() as { id: number };
      const changeRow = sqlite.query("select changes() as changes").get() as { changes: number };
      return {
        success: true,
        meta: { last_row_id: idRow.id, changes: changeRow.changes },
      };
    },
    async all() {
      return { results: sqlite.query(query).all(...(params as never[])) };
    },
    async first() {
      return sqlite.query(query).get(...(params as never[])) ?? null;
    },
    async raw() {
      return sqlite.query(query).values(...(params as never[]));
    },
  });
  return {
    prepare(query: string) {
      return wrap(query, []);
    },
    async dump() {
      throw new Error("not implemented");
    },
    async batch(statements: Array<{ run: () => Promise<unknown>; all: () => Promise<unknown> }>) {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.all());
      }
      return results;
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
  } as unknown as D1Database;
}

function bindings(overrides: Partial<ApiBindings> = {}): ApiBindings {
  return {
    DB: createMemoryD1(),
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    IP_HASH_SECRET: "test-secret",
    CF_ACCESS_CLIENT_ID: "local-dev-client-id",
    CF_ACCESS_CLIENT_SECRET: "local-dev-client-secret",
    DEMO_MODE: "false",
    WEB_ORIGIN: "http://localhost:4321",
    DASHBOARD_BASE_URL: "http://localhost:4322",
    ...overrides,
  };
}

const validBody = {
  name: "山田 太郎",
  email: "taro@example.com",
  category: "work",
  message: "【サンプル】浴室の相談です。",
  privacy_agreed: true,
  website: "",
};

function postContact(
  env: ApiBindings,
  body: unknown = validBody,
  headers: Record<string, string> = {},
) {
  return createApp().request(
    "/api/contact",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:4321",
        ...headers,
      },
      body: JSON.stringify(body),
    },
    env,
  );
}

describe("api", () => {
  test("health", async () => {
    const response = await createApp().request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  test("不正な入力は 400 VALIDATION_ERROR", async () => {
    const response = await postContact(bindings(), {
      ...validBody,
      email: "nope",
      privacy_agreed: false,
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("IP_HASH_SECRET が無いときは一般的な 500 を返し、設定名を含めない", async () => {
    const response = await postContact(bindings({ IP_HASH_SECRET: undefined }));
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain("IP_HASH_SECRET");
    const body = JSON.parse(text) as { error: { code: string; message: string } };
    expect(body.error).toEqual({
      code: "INTERNAL",
      message: "内部エラーが発生しました",
    });
  });

  test("正常送信は 201 でレコードが増え、管理 API で読める", async () => {
    const env = bindings();
    const created = await postContact(env);
    expect(created.status).toBe(201);
    const payload = (await created.json()) as { id: number };
    expect(payload.id).toBeGreaterThan(0);

    const headers = {
      "cf-access-client-id": "local-dev-client-id",
      "cf-access-client-secret": "local-dev-client-secret",
    };
    const list = await createApp().request("/api/admin/contacts", { headers }, env);
    expect(list.status).toBe(200);
    const listed = (await list.json()) as { total: number; items: Array<{ email: string }> };
    expect(listed.total).toBe(1);
    expect(listed.items[0]?.email).toBe("taro@example.com");

    const patched = await createApp().request(
      `/api/admin/contacts/${payload.id}`,
      {
        method: "PATCH",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ status: "in_progress", admin_note: "折り返す" }),
      },
      env,
    );
    expect(patched.status).toBe(200);
    const detail = (await patched.json()) as { status: string; admin_note: string };
    expect(detail.status).toBe("in_progress");
    expect(detail.admin_note).toBe("折り返す");

    const removed = await createApp().request(
      `/api/admin/contacts/${payload.id}`,
      { method: "DELETE", headers },
      env,
    );
    expect(removed.status).toBe(204);
    const after = await createApp().request("/api/admin/contacts", { headers }, env);
    const afterBody = (await after.json()) as { total: number };
    expect(afterBody.total).toBe(0);
  });

  test("トークン不一致は 401", async () => {
    const response = await createApp().request("/api/admin/contacts", {}, bindings());
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("ハニーポットは保存せず 201", async () => {
    const env = bindings();
    const response = await postContact(env, { ...validBody, website: "https://spam.example" });
    expect(response.status).toBe(201);
    const headers = {
      "cf-access-client-id": "local-dev-client-id",
      "cf-access-client-secret": "local-dev-client-secret",
    };
    const list = await createApp().request("/api/admin/contacts", { headers }, env);
    const body = (await list.json()) as { total: number };
    expect(body.total).toBe(0);
  });

  test("デモモードではレコードが増えない", async () => {
    const env = bindings({ DEMO_MODE: "true" });
    const response = await postContact(env);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: null });
    const headers = {
      "cf-access-client-id": "local-dev-client-id",
      "cf-access-client-secret": "local-dev-client-secret",
    };
    const list = await createApp().request("/api/admin/contacts", { headers }, env);
    expect(((await list.json()) as { total: number }).total).toBe(0);
  });

  test("バインディングが拒否すると 429", async () => {
    const env = bindings({ RATE_LIMITER: { limit: async () => ({ success: false }) } });
    const response = await postContact(env);
    expect(response.status).toBe(429);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      "RATE_LIMITED",
    );
  });

  test("10分以内に6件目は 429", async () => {
    const env = bindings();
    for (let index = 0; index < 5; index += 1) {
      const response = await postContact(env, {
        ...validBody,
        email: `user${index}@example.com`,
      });
      expect(response.status).toBe(201);
    }
    const blocked = await postContact(env, { ...validBody, email: "sixth@example.com" });
    expect(blocked.status).toBe(429);
  });

  test("同じ IPv6 /64 は 10 分の上限を共有し、別の /64 は別枠", async () => {
    const env = bindings();
    for (let index = 0; index < 5; index += 1) {
      const response = await postContact(
        env,
        { ...validBody, email: `v6${index}@example.com` },
        { "cf-connecting-ip": `2001:db8:1:2::${index + 1}` },
      );
      expect(response.status).toBe(201);
    }
    const blocked = await postContact(
      env,
      { ...validBody, email: "blocked-v6@example.com" },
      { "cf-connecting-ip": "2001:0db8:0001:0002:ffff:ffff:ffff:ffff" },
    );
    expect(blocked.status).toBe(429);
    const other = await postContact(
      env,
      { ...validBody, email: "other-prefix@example.com" },
      { "cf-connecting-ip": "2001:db8:1:3::1" },
    );
    expect(other.status).toBe(201);

    const headers = {
      "cf-access-client-id": "local-dev-client-id",
      "cf-access-client-secret": "local-dev-client-secret",
    };
    const list = await createApp().request("/api/admin/contacts", { headers }, env);
    const body = (await list.json()) as { items: Array<{ email: string; ip_hash: string }> };
    const hashes = new Map(body.items.map((item) => [item.email, item.ip_hash]));
    expect(hashes.get("v60@example.com")).toBe(hashes.get("v61@example.com"));
    expect(hashes.get("v60@example.com")).not.toBe(hashes.get("other-prefix@example.com"));
  });

  test("IPv4 はアドレスごとに 10 分の上限を数える", async () => {
    const env = bindings();
    for (let index = 0; index < 5; index += 1) {
      const response = await postContact(
        env,
        { ...validBody, email: `v4${index}@example.com` },
        { "cf-connecting-ip": "203.0.113.10" },
      );
      expect(response.status).toBe(201);
    }
    const blocked = await postContact(
      env,
      { ...validBody, email: "v4-blocked@example.com" },
      { "cf-connecting-ip": "203.0.113.10" },
    );
    expect(blocked.status).toBe(429);
    const neighbor = await postContact(
      env,
      { ...validBody, email: "v4-neighbor@example.com" },
      { "cf-connecting-ip": "203.0.113.11" },
    );
    expect(neighbor.status).toBe(201);
  });

  test("デモモードでも 10 分に 6 件目は 429 で、問い合わせは増えない", async () => {
    const env = bindings({ DEMO_MODE: "true" });
    for (let index = 0; index < 5; index += 1) {
      const response = await postContact(
        env,
        { ...validBody, email: `demo${index}@example.com` },
        { "cf-connecting-ip": `2001:db8:9:9::${index + 1}` },
      );
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ id: null });
    }
    const blocked = await postContact(
      env,
      { ...validBody, email: "demo-blocked@example.com" },
      { "cf-connecting-ip": "2001:db8:9:9::ffff" },
    );
    expect(blocked.status).toBe(429);
    const headers = {
      "cf-access-client-id": "local-dev-client-id",
      "cf-access-client-secret": "local-dev-client-secret",
    };
    const list = await createApp().request("/api/admin/contacts", { headers }, env);
    expect(((await list.json()) as { total: number }).total).toBe(0);
  });

  test("CSV は BOM 付きで絞り込みに従う", async () => {
    const env = bindings();
    await postContact(env);
    const headers = {
      "cf-access-client-id": "local-dev-client-id",
      "cf-access-client-secret": "local-dev-client-secret",
    };
    const response = await createApp().request(
      "/api/admin/contacts/export.csv?status=new",
      { headers },
      env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    const text = await response.text();
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain("taro@example.com");
  });
});
