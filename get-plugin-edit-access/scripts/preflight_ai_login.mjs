#!/usr/bin/env node

import { constants, publicEncrypt } from "node:crypto";

function parseArgs(argv) {
  const options = {
    accountEnv: "LAFENICE_AI_ACCOUNT",
    passwordEnv: "LAFENICE_AI_PASSWORD",
    probes: [],
    timeoutMs: 10000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${value} requires a value`);
      return argv[index];
    };
    if (value === "--project-url") options.projectUrl = next();
    else if (value === "--account-env") options.accountEnv = next();
    else if (value === "--password-env") options.passwordEnv = next();
    else if (value === "--probe") options.probes.push(next());
    else if (value === "--timeout") options.timeoutMs = Number(next()) * 1000;
    else throw new Error(`unknown argument: ${value}`);
  }
  if (!options.projectUrl) throw new Error("--project-url is required");
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("--timeout must be a positive number of seconds");
  }
  return options;
}

function apiCandidates(projectUrl) {
  const input = projectUrl.trim().replace(/\/+$/, "");
  const parsed = new URL(input);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error("project URL must be an absolute http(s) URL");
  }
  if (parsed.username || parsed.password) {
    throw new Error("project URL must not contain credentials");
  }
  let raw = input;
  if (parsed.pathname.replace(/\/+$/, "").endsWith("/api/ping")) {
    raw = raw.slice(0, -"/ping".length);
  }
  const normalized = new URL(raw);
  const values = normalized.pathname.replace(/\/+$/, "").endsWith("/api")
    ? [raw]
    : [`${raw}/api`];
  values.push(`${parsed.origin}/api`, `${parsed.origin}/lafenice/api`);
  return [...new Set(values.map((value) => value.replace(/\/+$/, "")))];
}

async function requestJson(url, { method = "GET", headers = {}, payload, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(payload === undefined ? {} : { "Content-Type": "application/json; charset=utf-8" }),
        ...headers,
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let body = {};
    if (text) {
      try { body = JSON.parse(text); }
      catch { body = { message: text.slice(0, 500) }; }
    }
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function discover(projectUrl, timeoutMs) {
  const attempts = [];
  for (const apiBase of apiCandidates(projectUrl)) {
    try {
      const { status, body } = await requestJson(`${apiBase}/ping`, { timeoutMs });
      attempts.push({ api_base: apiBase, status });
      if (status === 200 && body?.message === "pong") return { apiBase, ping: body };
    } catch (error) {
      attempts.push({ api_base: apiBase, error: error?.name ?? "Error" });
    }
  }
  throw new Error(`could not confirm a LaFenice API base: ${JSON.stringify(attempts)}`);
}

function summarize(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const result = {};
  for (const key of ["message", "detail"]) {
    if (typeof body[key] === "string") result[key] = body[key].slice(0, 500);
  }
  if (body.error && typeof body.error === "object") {
    for (const key of ["code", "message"]) {
      if (typeof body.error[key] === "string") {
        result[`error_${key}`] = body.error[key].slice(0, 500);
      }
    }
  }
  return result;
}

async function login(apiBase, account, password, timeoutMs) {
  const keyResponse = await requestJson(`${apiBase}/auth-password-public-key`, { timeoutMs });
  const key = keyResponse.body;
  if (
    keyResponse.status !== 200 ||
    key?.algorithm !== "RSA-OAEP-256" ||
    typeof key?.public_key_pem !== "string"
  ) {
    throw new Error("backend did not provide an RSA-OAEP-256 public key");
  }
  const ciphertext = publicEncrypt(
    {
      key: key.public_key_pem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(password, "utf8"),
  ).toString("base64");
  return requestJson(`${apiBase}/auth-login`, {
    method: "POST",
    payload: {
      account,
      password_ciphertext: ciphertext,
      password_encryption: "RSA-OAEP-256",
    },
    timeoutMs,
  });
}

function normalizeProbe(value) {
  const endpoint = value.trim().replace(/^\/+/, "");
  if (!endpoint || /^[a-z][a-z0-9+.-]*:/i.test(endpoint) || endpoint.includes("#")) {
    throw new Error("invalid probe endpoint");
  }
  const path = endpoint.split("?", 1)[0];
  if (path.split("/").includes("..")) throw new Error("invalid probe endpoint");
  return endpoint;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const account = (process.env[options.accountEnv] ?? "").trim();
  let password = process.env[options.passwordEnv] ?? "";
  if (!account || !password) {
    console.log(JSON.stringify({
      ok: false,
      error: "role: ai account/password environment variables are not both set",
      required_environment_variables: [options.accountEnv, options.passwordEnv],
    }));
    return 2;
  }

  const { apiBase, ping } = await discover(options.projectUrl, options.timeoutMs);
  let auth = await login(apiBase, account, password, options.timeoutMs);
  if (auth.status === 400 && auth.body?.detail === "password_ciphertext is invalid.") {
    auth = await login(apiBase, account, password, options.timeoutMs);
  }
  password = "";
  if (auth.status !== 200 || typeof auth.body?.access_token !== "string") {
    console.log(JSON.stringify({
      ok: false,
      error: "encrypted login failed",
      api_base: apiBase,
      status: auth.status,
      response: summarize(auth.body),
    }));
    return 1;
  }

  const headers = { Authorization: `Bearer ${auth.body.access_token}` };
  const me = await requestJson(`${apiBase}/auth-me`, { headers, timeoutMs: options.timeoutMs });
  if (me.status !== 200 || !Array.isArray(me.body?.roles)) {
    console.log(JSON.stringify({
      ok: false,
      error: "auth-me verification failed",
      api_base: apiBase,
      status: me.status,
      response: summarize(me.body),
    }));
    return 1;
  }
  const roles = [...new Set(me.body.roles.map((role) => String(role).trim().toLowerCase()))].sort();
  if (!roles.includes("ai")) {
    console.log(JSON.stringify({
      ok: false,
      error: "authenticated account does not have the required role: ai",
      api_base: apiBase,
      roles,
    }));
    return 1;
  }

  const probes = [];
  for (const rawProbe of options.probes) {
    const endpoint = normalizeProbe(rawProbe);
    const response = await requestJson(`${apiBase}/${endpoint}`, {
      headers,
      timeoutMs: options.timeoutMs,
    });
    probes.push({
      method: "GET",
      endpoint,
      status: response.status,
      response: summarize(response.body),
    });
  }
  const ok = probes.every(({ status }) => status >= 200 && status < 300);
  console.log(JSON.stringify({
    ok,
    api_base: apiBase,
    version: ping?.version,
    authenticated: true,
    required_role_verified: "ai",
    probes,
  }, null, 2));
  return ok ? 0 : 1;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.log(JSON.stringify({ ok: false, error: error?.message ?? String(error) }));
  process.exitCode = 1;
}
