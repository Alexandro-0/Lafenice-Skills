import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const auditScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "audit_lafenice_pwa.mjs");

test("manual manifest implementation can pass installable without a service worker", () => {
  withFixture({}, (root) => {
    const result = runAudit(root, "installable");
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.report.ready, true);
    assert.equal(check(result.report, "pwa-build-dependency").ok, false);
    assert.equal(check(result.report, "worker-registered").ok, false);
  });
});

test("offline-shell still requires a service worker registration", () => {
  withFixture({}, (root) => {
    const result = runAudit(root, "offline-shell");
    assert.equal(result.status, 3, result.stderr || result.stdout);
    assert.equal(result.report.ready, false);
    assert.equal(check(result.report, "worker-registered").ok, false);
  });
});

test("injectRegister null is not mistaken for automatic registration", () => {
  withFixture({ vitePwa: true, injectRegister: "null" }, (root) => {
    const result = runAudit(root, "offline-shell");
    assert.equal(result.status, 3, result.stderr || result.stdout);
    assert.equal(check(result.report, "worker-registered").ok, false);
    assert.match(check(result.report, "worker-registered").detail, /disabled/i);
  });
});

test("icon filenames do not substitute for actual PNG dimensions", () => {
  withFixture({}, (root) => {
    writePngHeader(
      path.join(root, "LaFeniceFrontend", "public", "icon-192.png"),
      191,
      191,
    );
    const result = runAudit(root, "installable");
    assert.equal(result.status, 3, result.stderr || result.stdout);
    assert.equal(check(result.report, "install-icons").ok, false);
  });
});

test("relative manifest id is rejected and omitted id uses start_url identity", () => {
  withFixture({ dist: true, manifestId: "./app" }, (root) => {
    const invalid = runAudit(root, "installable", true);
    assert.equal(invalid.status, 3, invalid.stderr || invalid.stdout);
    assert.equal(check(invalid.report, "dist-manifest-identity").ok, false);

    const manifestPath = path.join(root, "LaFeniceFrontend", "dist", "manifest.webmanifest");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    delete manifest.id;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest), "utf8");

    const valid = runAudit(root, "installable", true);
    assert.equal(valid.status, 0, valid.stderr || valid.stdout);
    assert.equal(check(valid.report, "dist-manifest-identity").ok, true);
  });
});

function withFixture(options, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lafenice-pwa-audit-"));
  try {
    createFixture(root, options);
    callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function createFixture(root, options) {
  const frontend = path.join(root, "LaFeniceFrontend");
  fs.mkdirSync(path.join(frontend, "src"), { recursive: true });
  fs.mkdirSync(path.join(frontend, "public"), { recursive: true });
  fs.mkdirSync(path.join(frontend, "nginx"), { recursive: true });
  fs.mkdirSync(path.join(frontend, "docker-entrypoint.d"), { recursive: true });

  const devDependencies = options.vitePwa ? { "vite-plugin-pwa": "1.0.0" } : {};
  fs.writeFileSync(path.join(frontend, "package.json"), JSON.stringify({
    name: "lafenicefrontend",
    dependencies: { react: "18.3.1", vite: "5.4.10" },
    devDependencies,
  }), "utf8");
  fs.writeFileSync(path.join(frontend, "vite.config.ts"), `
const projectRoot = process.env.PROJECT_ROOT || "acme";
export default {
  base: \`/\${projectRoot}/\`,
  server: { https: {} },
  ${options.vitePwa ? `plugins: [VitePWA({ injectRegister: ${options.injectRegister ?? "'auto'"}, manifest: {} })],` : ""}
};
`, "utf8");
  fs.writeFileSync(path.join(frontend, "index.html"), `
<html><head><link rel="manifest" href="/acme/manifest.webmanifest"></head>
<body><div id="root"></div><script src="/acme/runtime-config.js"></script></body></html>
`, "utf8");
  fs.writeFileSync(path.join(frontend, "src", "main.tsx"), options.manualWorker
    ? "navigator.serviceWorker.register('./sw.js');"
    : "export {};", "utf8");
  fs.writeFileSync(path.join(frontend, "nginx", "default.conf.template"), `
server {
  listen 443 ssl;
  location /\${PROJECT_ROOT}/ { try_files $uri /\${PROJECT_ROOT}/index.html; }
  location = /\${PROJECT_ROOT}/manifest.webmanifest {
    default_type application/manifest+json;
    add_header Cache-Control "no-cache";
  }
  location = /\${PROJECT_ROOT}/sw.js {
    add_header Cache-Control "no-store";
    add_header X-Content-Type-Options "nosniff";
  }
  location = /\${PROJECT_ROOT}/runtime-config.js {
    add_header Cache-Control "no-store";
  }
}
`, "utf8");
  fs.writeFileSync(
    path.join(frontend, "docker-entrypoint.d", "30-lafenice-runtime-config.sh"),
    "/usr/share/nginx/html/$PROJECT_ROOT runtime-config.js",
    "utf8",
  );
  fs.writeFileSync(path.join(frontend, "Dockerfile"), "COPY dist /opt/lafenice-dist", "utf8");
  writePngHeader(path.join(frontend, "public", "icon-192.png"), 192, 192);
  writePngHeader(path.join(frontend, "public", "icon-512.png"), 512, 512);

  if (options.dist) createDist(frontend, options.manifestId);
}

function createDist(frontend, manifestId) {
  const dist = path.join(frontend, "dist");
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(
    path.join(dist, "index.html"),
    '<link rel="manifest" href="/acme/manifest.webmanifest">',
    "utf8",
  );
  fs.writeFileSync(path.join(dist, "manifest.webmanifest"), JSON.stringify({
    ...(manifestId === undefined ? {} : { id: manifestId }),
    name: "Fixture",
    short_name: "Fixture",
    start_url: "./",
    scope: "./",
    display: "standalone",
    icons: [
      { src: "./icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "./icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }), "utf8");
  writePngHeader(path.join(dist, "icon-192.png"), 192, 192);
  writePngHeader(path.join(dist, "icon-512.png"), 512, 512);
}

function writePngHeader(file, width, height) {
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  fs.writeFileSync(file, buffer);
}

function runAudit(root, level, withDist = false) {
  const args = [auditScript, "--root", root, "--level", level, "--strict", "--json"];
  if (withDist) args.push("--dist", path.join(root, "LaFeniceFrontend", "dist"));
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    report: JSON.parse(result.stdout),
  };
}

function check(report, name) {
  const result = report.checks.find((item) => item.name === name);
  assert.ok(result, `Missing check: ${name}`);
  return result;
}
