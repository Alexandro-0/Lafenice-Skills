/** Attach task metadata to an already authorized, in-memory API client. */
export async function createTrackedTask({ apiBase, authFetch, title, agent, skills = [] }) {
  const base = new URL(`${String(apiBase).replace(/\/$/, "")}/`);
  if (!/^https?:$/.test(base.protocol)) throw new Error("Expected an HTTP(S) API base.");
  const headers = { "Content-Type": "application/json", "X-Lafenice-Source": "ai", "X-Lafenice-Agent": agent };
  const probe = await authFetch(new URL("change-activities?limit=1", base).href, { headers });
  let id = null;
  if (probe.status !== 404 && probe.status !== 405) {
    if (!probe.ok) throw new Error(`Activity capability check failed (${probe.status}).`);
    const response = await authFetch(new URL("change-activities/tasks", base).href, {
      method: "POST", headers, body: JSON.stringify({ title, source: "ai", agent, skills }),
    });
    if (!response.ok) throw new Error(`Activity task creation failed (${response.status}).`);
    id = (await response.json()).item?.id;
    if (typeof id !== "string" || !id) throw new Error("Activity task ID missing.");
  }
  let finished = false;
  return {
    id, supported: id !== null,
    async fetch(input, init = {}) {
      if (finished) throw new Error("This activity task has finished.");
      const url = new URL(String(input), base);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error("Activity requests must stay within the authorized API base.");
      const requestHeaders = new Headers(init.headers);
      requestHeaders.set("X-Lafenice-Source", "ai");
      requestHeaders.set("X-Lafenice-Agent", agent);
      if (id) requestHeaders.set("X-Lafenice-Activity-ID", id);
      return authFetch(url.href, { ...init, headers: requestHeaders });
    },
    async finish({ status, summary = "", verification = "" }) {
      if (finished) throw new Error("This activity task has finished.");
      if (!["completed", "failed", "cancelled"].includes(status)) throw new Error("Invalid activity result.");
      if (id) {
        const response = await authFetch(new URL(`change-activities/tasks/${encodeURIComponent(id)}`, base).href, {
          method: "PATCH", headers, body: JSON.stringify({ status, summary, verification }),
        });
        if (!response.ok) throw new Error(`Activity task completion failed (${response.status}); do not replay business writes.`);
      }
      finished = true;
    },
  };
}
