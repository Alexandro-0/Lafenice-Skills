#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root ?? process.cwd());
const frontend = findFrontend(root);

if (!frontend) {
  reportAndExit({
    root,
    level: args.level,
    feasible: false,
    ready: false,
    error: "LaFeniceFrontend/package.json was not found. This audit applies only to App Shell mode.",
    checks: [],
  }, 2);
}

const packagePath = path.join(frontend, "package.json");
const packageJson = readJson(packagePath);
const viteConfig = readFirst(frontend, ["vite.config.ts", "vite.config.js", "vite.config.mts"]);
const indexHtml = readText(path.join(frontend, "index.html"));
const nginx = readText(path.join(frontend, "nginx", "default.conf.template"));
const dockerfile = readText(path.join(frontend, "Dockerfile"));
const entrypoint = readText(
  path.join(frontend, "docker-entrypoint.d", "30-lafenice-runtime-config.sh"),
);
const clientSource = listFiles(path.join(frontend, "src"))
  .filter((file) => /\.(?:[cm]?[jt]sx?)$/i.test(file))
  .map(readText)
  .join("\n");

const deps = {
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
};

const checks = [];
addCheck(checks, "vite-react-stack", Boolean(deps.vite && deps.react), {
  requiredForFeasibility: true,
  detail: deps.vite && deps.react
    ? `Detected React ${deps.react} and Vite ${deps.vite}.`
    : "React or Vite dependency is missing.",
});
addCheck(
  checks,
  "configurable-project-root",
  /base\s*:\s*`?['"]?\/?\$\{?projectRoot/i.test(viteConfig)
    || (/base\s*:/.test(viteConfig) && /PROJECT_ROOT/.test(viteConfig)),
  {
    requiredForFeasibility: true,
    detail: "Vite should retain a project-root-aware base path.",
  },
);
addCheck(checks, "spa-root", /id=["']root["']/.test(indexHtml), {
  requiredForFeasibility: true,
  detail: "The frontend entry document should contain the React root.",
});
addCheck(checks, "history-fallback", /try_files[\s\S]*index\.html/.test(nginx), {
  requiredForFeasibility: true,
  detail: "Nginx should fall back to the SPA entry document.",
});
addCheck(
  checks,
  "https-capable",
  /listen\s+443\s+ssl/.test(nginx) || /server\s*:\s*\{[\s\S]*?https\s*:/i.test(viteConfig),
  {
    requiredForFeasibility: true,
    detail: "Promoted PWA installation requires HTTPS, localhost, or loopback delivery.",
  },
);
addCheck(
  checks,
  "runtime-config",
  /runtime-config\.js/.test(indexHtml) && /runtime-config\.js/.test(entrypoint),
  {
    detail: "Runtime config needs an explicit non-immutable cache policy.",
    informational: true,
  },
);

const pwaDependency = Boolean(deps["vite-plugin-pwa"]);
const pwaPluginConfigured = /\bVitePWA\s*\(/.test(viteConfig);
const manifestConfigured = /manifest\s*:/.test(viteConfig)
  || /rel=["'][^"']*manifest[^"']*["']/.test(indexHtml);
const manualWorkerRegistration = /navigator\.serviceWorker\.register\s*\(/.test(clientSource)
  || /virtual:pwa-register/.test(clientSource)
  || /\bregisterSW\s*\(/.test(clientSource);
const pluginRegistrationDisabled = /injectRegister\s*:\s*(?:false|null)\b/.test(viteConfig);
const pluginAutoRegistration = pwaPluginConfigured && !pluginRegistrationDisabled;
const workerRegistered = manualWorkerRegistration || pluginAutoRegistration;
const iconFiles = listFiles(path.join(frontend, "public"))
  .filter((file) => /\.png$/i.test(file));
const iconDimensions = iconFiles.map((file) => ({ file, dimensions: readPngDimensions(file) }));
const has192 = iconDimensions.some(({ dimensions }) => dimensions?.width === 192 && dimensions.height === 192);
const has512 = iconDimensions.some(({ dimensions }) => dimensions?.width === 512 && dimensions.height === 512);
const workerLocation = findExactLocationBlock(nginx, /(?:sw|service-worker)\.js$/i);
const manifestLocation = findExactLocationBlock(nginx, /manifest(?:\.webmanifest|\.json)$/i);
const runtimeConfigLocation = findExactLocationBlock(nginx, /runtime-config\.js$/i);
const workerNoCache = Boolean(workerLocation)
  && /Cache-Control[\s\S]*(?:no-store|no-cache)/i.test(workerLocation.body);
const workerNoSniff = Boolean(workerLocation)
  && /X-Content-Type-Options[\s\S]*nosniff/i.test(workerLocation.body);
const manifestNoCache = Boolean(manifestLocation)
  && /Cache-Control[\s\S]*(?:no-store|no-cache)/i.test(manifestLocation.body);
const manifestMime = Boolean(manifestLocation)
  && /(?:default_type|Content-Type)[\s\S]*application\/manifest\+json/i.test(manifestLocation.body);
const runtimeConfigPolicy = Boolean(runtimeConfigLocation)
  && /Cache-Control[\s\S]*(?:no-store|no-cache)/i.test(runtimeConfigLocation.body);

addCheck(checks, "pwa-build-dependency", pwaDependency, {
  informational: true,
  detail: pwaDependency
    ? `Detected optional vite-plugin-pwa ${deps["vite-plugin-pwa"]}.`
    : "No vite-plugin-pwa dependency; a reviewed manual implementation remains valid.",
});
addCheck(checks, "pwa-plugin-configured", pwaPluginConfigured, {
  informational: true,
  detail: pwaPluginConfigured
    ? "Detected VitePWA configuration."
    : "No VitePWA configuration; a linked manifest and custom worker remain valid.",
});
addCheck(checks, "manifest-configured", manifestConfigured, {
  requiredForInstallable: true,
  detail: "A web app manifest must be linked or generated.",
});
addCheck(checks, "install-icons", has192 && has512, {
  requiredForInstallable: !args.dist,
  detail: `Detected ${iconFiles.length} public PNG candidate(s); require actual 192x192 and 512x512 dimensions.`,
});
addCheck(checks, "manifest-exact-location", Boolean(manifestLocation), {
  requiredForInstallable: true,
  detail: "Add an exact nginx location for manifest.webmanifest or manifest.json.",
});
addCheck(checks, "manifest-mime", manifestMime, {
  requiredForInstallable: true,
  detail: "Serve the manifest as application/manifest+json from its exact nginx location.",
});
addCheck(checks, "manifest-no-cache", manifestNoCache, {
  requiredForInstallable: true,
  detail: "The manifest exact location must avoid immutable caching.",
});
addCheck(checks, "worker-registered", workerRegistered, {
  requiredForOfflineShell: true,
  detail: pluginRegistrationDisabled && !manualWorkerRegistration
    ? "VitePWA automatic injection is disabled; register the worker manually."
    : "Offline-shell capability requires a generated or custom worker registration.",
});
addCheck(checks, "worker-exact-location", Boolean(workerLocation), {
  requiredForOfflineShell: true,
  detail: "Add an exact nginx location for the worker script.",
});
addCheck(checks, "worker-no-cache", workerNoCache, {
  requiredForOfflineShell: true,
  detail: "The worker exact location must use no-cache or no-store.",
});
addCheck(checks, "worker-nosniff", workerNoSniff, {
  requiredForOfflineShell: true,
  detail: "The worker exact location must use X-Content-Type-Options: nosniff.",
});
addCheck(checks, "runtime-config-no-immutable-cache", runtimeConfigPolicy, {
  requiredForInstallable: true,
  detail: "runtime-config.js must have an exact non-immutable cache policy.",
});
addCheck(
  checks,
  "docker-project-root-copy",
  /\/usr\/share\/nginx\/html\/\$PROJECT_ROOT/.test(entrypoint)
    && /\/opt\/lafenice-dist/.test(dockerfile),
  {
    informational: true,
    detail: "Packaged output should remain under the configured project root.",
  },
);

let distReport = null;
if (args.dist) {
  distReport = auditDist(path.resolve(args.dist));
  for (const check of distReport.checks) checks.push(check);
}

const feasible = checks
  .filter((check) => check.requiredForFeasibility)
  .every((check) => check.ok);
const ready = feasible && checks
  .filter((check) => isRequiredForLevel(check, args.level))
  .every((check) => check.ok);

const result = {
  root,
  frontend,
  level: args.level,
  feasible,
  ready,
  summary: feasible
    ? ready
      ? `Static ${args.level} preflight passed; served-origin and browser verification are still required.`
      : `LaFenice is architecturally feasible, but the static ${args.level} preflight has failures.`
    : "The detected frontend does not satisfy the minimum LaFenice App Shell prerequisites.",
  checks,
  ...(distReport ? { dist: distReport.path } : {}),
};

const exitCode = !feasible ? 2 : args.strict && !ready ? 3 : 0;
reportAndExit(result, exitCode);

function parseArgs(values) {
  const parsed = {
    root: undefined,
    dist: undefined,
    level: "installable",
    strict: false,
    json: false,
  };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--strict") parsed.strict = true;
    else if (value === "--json") parsed.json = true;
    else if (value === "--root") parsed.root = requireValue(values, ++index, value);
    else if (value === "--dist") parsed.dist = requireValue(values, ++index, value);
    else if (value === "--level") parsed.level = requireValue(values, ++index, value);
    else if (value === "--help" || value === "-h") {
      console.log(
        "Usage: audit_lafenice_pwa.mjs [--root PATH] [--dist PATH] "
          + "[--level installable|offline-shell] [--strict] [--json]",
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${value}`);
      process.exit(64);
    }
  }
  if (!["installable", "offline-shell"].includes(parsed.level)) {
    console.error("--level must be installable or offline-shell.");
    process.exit(64);
  }
  return parsed;
}

function requireValue(values, index, flag) {
  const value = values[index];
  if (!value || value.startsWith("--")) {
    console.error(`${flag} requires a value.`);
    process.exit(64);
  }
  return value;
}

function findFrontend(start) {
  const direct = path.join(start, "LaFeniceFrontend");
  if (fs.existsSync(path.join(direct, "package.json"))) return direct;
  if (
    fs.existsSync(path.join(start, "package.json"))
    && /lafenice/i.test(path.basename(start) + readText(path.join(start, "package.json")))
  ) {
    return start;
  }
  return null;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`Cannot parse ${file}: ${error.message}`);
    process.exit(65);
  }
}

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function readFirst(directory, candidates) {
  for (const candidate of candidates) {
    const content = readText(path.join(directory, candidate));
    if (content) return content;
  }
  return "";
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

function readPngDimensions(file) {
  try {
    const buffer = fs.readFileSync(file);
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) return null;
    if (buffer.toString("ascii", 12, 16) !== "IHDR") return null;
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  } catch {
    return null;
  }
}

function findExactLocationBlock(config, targetPattern) {
  const lines = config.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const openBrace = line.lastIndexOf("{");
    if (openBrace < 0) continue;
    const declaration = line.slice(0, openBrace).match(/^\s*location\s*=\s*(\S+)\s*$/);
    if (!declaration || !targetPattern.test(declaration[1])) continue;
    const body = [];
    for (let bodyIndex = index + 1; bodyIndex < lines.length; bodyIndex += 1) {
      if (lines[bodyIndex].trim() === "}") break;
      body.push(lines[bodyIndex]);
    }
    return { target: declaration[1], body: body.join("\n") };
  }
  return null;
}

function addCheck(checks, name, ok, options = {}) {
  checks.push({
    name,
    ok: Boolean(ok),
    detail: options.detail ?? "",
    requiredForFeasibility: Boolean(options.requiredForFeasibility),
    requiredForInstallable: Boolean(options.requiredForInstallable),
    requiredForOfflineShell: Boolean(options.requiredForOfflineShell),
    informational: Boolean(options.informational),
  });
}

function isRequiredForLevel(check, level) {
  if (check.requiredForInstallable) return true;
  return level === "offline-shell" && check.requiredForOfflineShell;
}

function auditDist(directory) {
  const distChecks = [];
  const distIndex = readText(path.join(directory, "index.html"));
  addCheck(distChecks, "dist-index", Boolean(distIndex), {
    requiredForInstallable: true,
    detail: `Expected ${path.join(directory, "index.html")}.`,
  });

  const manifestMatch = distIndex.match(
    /<link[^>]+rel=["'][^"']*manifest[^"']*["'][^>]+href=["']([^"']+)["']/i,
  ) ?? distIndex.match(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*manifest[^"']*["']/i,
  );
  const manifestHref = manifestMatch?.[1] ?? "";
  const manifestPath = resolveDistReference(directory, null, manifestHref);
  const manifestText = manifestPath ? readText(manifestPath) : "";
  let manifest = null;
  if (manifestText) {
    try {
      manifest = JSON.parse(manifestText);
    } catch {
      manifest = null;
    }
  }

  addCheck(distChecks, "dist-manifest", Boolean(manifest), {
    requiredForInstallable: true,
    detail: manifestHref
      ? `Manifest reference: ${manifestHref}.`
      : "The built index does not link a manifest.",
  });
  addCheck(
    distChecks,
    "dist-manifest-installability-fields",
    Boolean(
      manifest
      && (nonEmptyText(manifest.name) || nonEmptyText(manifest.short_name))
      && nonEmptyText(manifest.start_url)
      && hasInstallableDisplayMode(manifest)
      && manifest.prefer_related_applications !== true
    ),
    {
      requiredForInstallable: true,
      detail: "The manifest needs name/short_name, start_url, an installable display mode, and no prefer_related_applications: true.",
    },
  );
  addCheck(
    distChecks,
    "dist-manifest-scope",
    Boolean(
      manifest
      && nonEmptyText(manifest.scope)
      && isProjectRootReference(manifestHref, manifest.scope)
      && isProjectRootReference(manifestHref, manifest.start_url)
      && startUrlIsInScope(manifestHref, manifest.start_url, manifest.scope)
    ),
    {
      requiredForInstallable: true,
      detail: "scope and start_url must be dot-relative or build-derived root-relative project references, with start_url inside scope.",
    },
  );
  addCheck(
    distChecks,
    "dist-manifest-identity",
    manifest?.id === undefined || manifest?.id === null
      ? true
      : isRootRelativeIdentityInsideScope(manifestHref, manifest.id, manifest.scope),
    {
      requiredForInstallable: true,
      detail: "Omit id or use a root-relative identity inside the configured application scope; './app' is not plugin-relative.",
    },
  );

  const iconResult = inspectManifestIcons(directory, manifestPath, manifest);
  addCheck(distChecks, "dist-manifest-icons", iconResult.ok, {
    requiredForInstallable: true,
    detail: iconResult.detail,
  });

  const worker = listFiles(directory).find((file) =>
    /(?:^|[\\/])(sw|service-worker)\.js$/i.test(file));
  addCheck(distChecks, "dist-worker", Boolean(worker), {
    requiredForOfflineShell: true,
    detail: worker ? `Worker: ${worker}.` : "No sw.js or service-worker.js was found.",
  });

  return { path: directory, checks: distChecks };
}

function inspectManifestIcons(directory, manifestPath, manifest) {
  if (!Array.isArray(manifest?.icons)) {
    return { ok: false, detail: "The built manifest does not declare icons." };
  }
  const dimensions = manifest.icons.map((icon) => {
    const file = resolveDistReference(directory, manifestPath, icon?.src);
    return {
      file,
      type: icon?.type,
      declaredSizes: icon?.sizes,
      dimensions: file ? readPngDimensions(file) : null,
    };
  });
  const hasSize = (size) => dimensions.some((icon) =>
    icon.type === "image/png"
      && new RegExp(`(?:^|\\s)${size}x${size}(?:\\s|$)`).test(icon.declaredSizes ?? "")
      && icon.dimensions?.width === size
      && icon.dimensions.height === size);
  return {
    ok: hasSize(192) && hasSize(512),
    detail: "The built manifest must reference image/png files whose PNG headers and declared sizes are 192x192 and 512x512.",
  };
}

function resolveDistReference(directory, baseFile, reference) {
  if (!reference || /^(?:https?:|data:)/i.test(reference)) return null;
  const clean = reference.split(/[?#]/, 1)[0];
  const relativeClean = clean.replace(/^\.\//, "");
  const rootClean = clean.replace(/^\/+/, "");
  const candidates = [
    ...(baseFile && !clean.startsWith("/")
      ? [path.resolve(path.dirname(baseFile), relativeClean)]
      : []),
    path.join(directory, rootClean),
    path.join(directory, path.basename(rootClean)),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0] ?? null;
}

function isProjectRootReference(manifestHref, value) {
  if (!nonEmptyText(value) || /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith("//")) {
    return false;
  }
  if (!value.startsWith("/")) return true;
  try {
    const manifestUrl = new URL(manifestHref || "manifest.webmanifest", "https://audit.invalid/");
    const manifestDirectory = ensureTrailingSlash(path.posix.dirname(manifestUrl.pathname));
    return new URL(value, manifestUrl).pathname.startsWith(manifestDirectory);
  } catch {
    return false;
  }
}

function hasInstallableDisplayMode(manifest) {
  const allowed = new Set(["fullscreen", "standalone", "minimal-ui", "window-controls-overlay"]);
  if (allowed.has(manifest?.display)) return true;
  return Array.isArray(manifest?.display_override)
    && manifest.display_override.some((value) => allowed.has(value));
}

function startUrlIsInScope(manifestHref, startUrl, scope) {
  try {
    const manifestUrl = new URL(manifestHref || "manifest.webmanifest", "https://audit.invalid/");
    const resolvedStart = new URL(startUrl, manifestUrl);
    const resolvedScope = new URL(scope, manifestUrl);
    return resolvedStart.origin === resolvedScope.origin
      && resolvedStart.pathname.startsWith(ensureTrailingSlash(resolvedScope.pathname));
  } catch {
    return false;
  }
}

function isRootRelativeIdentityInsideScope(manifestHref, id, scope) {
  if (!nonEmptyText(id) || !id.startsWith("/") || id.startsWith("//")) return false;
  try {
    const manifestUrl = new URL(manifestHref || "manifest.webmanifest", "https://audit.invalid/");
    const resolvedScope = new URL(scope, manifestUrl);
    const resolvedId = new URL(id, "https://audit.invalid/");
    return resolvedId.origin === resolvedScope.origin
      && resolvedId.pathname.startsWith(ensureTrailingSlash(resolvedScope.pathname));
  } catch {
    return false;
  }
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function nonEmptyText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function reportAndExit(result, code) {
  if (args?.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.summary ?? result.error ?? "PWA static preflight");
    console.log(`Level: ${result.level ?? "installable"}`);
    console.log(`Feasible: ${result.feasible ? "yes" : "no"}`);
    console.log(`Ready: ${result.ready ? "yes" : "no"}`);
    for (const check of result.checks ?? []) {
      const required = check.requiredForFeasibility || isRequiredForLevel(check, result.level);
      const marker = check.ok ? "PASS" : required ? "FAIL" : "INFO";
      console.log(`[${marker}] ${check.name}: ${check.detail}`);
    }
  }
  process.exit(code);
}
