import assert from "node:assert/strict";
import { test } from "node:test";
import { createTrackedTask } from "./change_activity.mjs";

test("task client attaches correlation, restricts destination and closes without replaying writes", async () => {
  const calls = [];
  const authFetch = async (url, init) => {
    calls.push({ url, init });
    return Response.json(url.endsWith("/tasks") ? { item: { id: "task-1" } } : { items: [] });
  };
  const task = await createTrackedTask({ apiBase: "https://example.test/project/api", authFetch, title: "Work", agent: "Codex", skills: ["develop-plugin-code"] });
  await task.fetch("https://example.test/project/api/orders", { method: "PATCH" });
  assert.equal(calls.at(-1).init.headers.get("X-Lafenice-Activity-ID"), "task-1");
  assert.equal(calls.at(-1).init.headers.get("X-Lafenice-Source"), "ai");
  await assert.rejects(() => task.fetch("https://other.test/api"), /authorized API base/);
  await assert.rejects(() => task.fetch("https://example.test/other/api"), /authorized API base/);
  await task.finish({ status: "completed", verification: "Tests passed" });
  assert.equal(calls.filter(call => call.url.endsWith("/orders")).length, 1);
  await assert.rejects(() => task.fetch("orders"), /finished/);
});

test("only unsupported-route responses allow the legacy fallback", async () => {
  const task = await createTrackedTask({ apiBase: "https://example.test/api", authFetch: async () => new Response(null, { status: 404 }), title: "Work", agent: "Codex" });
  assert.equal(task.supported, false);
  for (const status of [401, 403, 500]) {
    await assert.rejects(() => createTrackedTask({ apiBase: "https://example.test/api", authFetch: async () => new Response(null, { status }), title: "Work", agent: "Codex" }), /capability check failed/);
  }
});
