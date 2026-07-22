#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HOST = "127.0.0.1";
export const DEFAULT_PORT = 3000;
export const MAINTENANCE_PREFIX = "/__maintenance/m07b3";
export const RUNTIME_CONFIG_URL = "/admin/runtime-config.js";
export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CONTENT_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
});

export const MAINTENANCE_RESOURCES = Object.freeze({
  [`${MAINTENANCE_PREFIX}/plan`]: "migration/m07b3-catalog-plan.json",
  [`${MAINTENANCE_PREFIX}/finds.csv`]: "content-intake/finds.csv",
  [`${MAINTENANCE_PREFIX}/photo-manifest.csv`]: "content-intake/photo-manifest.csv",
  [`${MAINTENANCE_PREFIX}/collections.js`]: "data/collections.js",
  [`${MAINTENANCE_PREFIX}/identifier-registry.md`]: "docs/IDENTIFIER_REGISTRY.md",
  [`${MAINTENANCE_PREFIX}/photos/vintage-ceramic-handbell-01.jpeg`]: "content-intake/photos/vintage-ceramic-handbell-01.jpeg",
  [`${MAINTENANCE_PREFIX}/photos/burgundy-montblanc-pen-01.jpeg`]: "content-intake/photos/burgundy-montblanc-pen-01.jpeg",
  [`${MAINTENANCE_PREFIX}/photos/hand-painted-decorative-shell-01.png`]: "content-intake/photos/hand-painted-decorative-shell-01.png",
  [`${MAINTENANCE_PREFIX}/photos/vintage-floral-teacup-saucer-01.png`]: "content-intake/photos/vintage-floral-teacup-saucer-01.png"
});

function parseRequestUrl(requestUrl) {
  const url = new URL(requestUrl, `http://${HOST}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname.includes("\0") || pathname.includes("\\")) return null;
  return { url, pathname };
}

function isProtectedStaticPath(pathname) {
  const lowerPathname = pathname.toLowerCase();
  return lowerPathname === "/migration"
    || lowerPathname.startsWith("/migration/")
    || lowerPathname === "/content-intake"
    || lowerPathname.startsWith("/content-intake/")
    || lowerPathname === "/docs/identifier_registry.md"
    || lowerPathname === "/admin/config.js"
    || lowerPathname === MAINTENANCE_PREFIX
    || lowerPathname.startsWith(`${MAINTENANCE_PREFIX}/`);
}

export function resolveStaticRequest(requestUrl, root = repositoryRoot) {
  const parsed = parseRequestUrl(requestUrl);
  if (!parsed) return null;
  let { pathname } = parsed;
  if (isProtectedStaticPath(pathname)) return null;
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/admin" || pathname === "/admin/") pathname = "/admin/index.html";
  const segments = pathname.split("/").filter(Boolean);
  if (segments.some((segment) => segment.startsWith("."))) return null;

  const filePath = resolve(root, `.${pathname}`);
  const relativePath = relative(root, filePath);
  if (!relativePath || relativePath.startsWith(`..${sep}`) || relativePath === ".." || relativePath.includes(`${sep}..${sep}`)) {
    return null;
  }
  return filePath;
}

export function resolveMaintenanceRequest(requestUrl, root = repositoryRoot) {
  const parsed = parseRequestUrl(requestUrl);
  if (!parsed || parsed.url.search || parsed.url.hash) return null;
  const relativePath = MAINTENANCE_RESOURCES[parsed.pathname];
  return relativePath ? resolve(root, relativePath) : null;
}

export function loadRuntimeConfiguration(root = repositoryRoot) {
  const source = readFileSync(resolve(root, "admin/config.js"), "utf8");
  const match = source.match(/^window\.BETWEEN_US_ADMIN_CONFIG\s*=\s*Object\.freeze\((\{[\s\S]*\})\);\s*$/);
  if (!match) throw new Error("Invalid browser configuration.");
  const configuration = JSON.parse(match[1]);
  if (
    !configuration
    || typeof configuration.url !== "string"
    || typeof configuration.publishableKey !== "string"
    || typeof configuration.projectRef !== "string"
  ) {
    throw new Error("Invalid browser configuration.");
  }
  const url = new URL(configuration.url);
  const local = url.protocol === "http:"
    && url.hostname === "127.0.0.1"
    && url.port === "54321"
    && configuration.projectRef === "local-m07b3";
  const remote = url.protocol === "https:"
    && url.hostname === `${configuration.projectRef}.supabase.co`
    && url.port === "";
  if (
    (!local && !remote)
    || url.username
    || url.password
    || url.pathname !== "/"
    || url.search
    || url.hash
    || configuration.publishableKey.trim() === ""
  ) {
    throw new Error("Invalid browser configuration.");
  }
  return Object.freeze({
    url: url.toString(),
    publishableKey: configuration.publishableKey,
    projectRef: configuration.projectRef
  });
}

function bearerToken(request) {
  const value = request.headers?.authorization;
  if (typeof value !== "string") return null;
  const match = value.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  return match?.[1] || null;
}

export function createMaintenanceAuthorizer({
  root = repositoryRoot,
  fetchImpl = globalThis.fetch.bind(globalThis),
  configurationProvider = () => loadRuntimeConfiguration(root)
} = {}) {
  return async function authorizeMaintenanceRequest(request) {
    const accessToken = bearerToken(request);
    if (!accessToken) return 401;

    let configuration;
    try {
      configuration = configurationProvider();
    } catch {
      return 404;
    }
    const headers = {
      apikey: configuration.publishableKey,
      authorization: `Bearer ${accessToken}`
    };

    try {
      const userResponse = await fetchImpl(new URL("auth/v1/user", configuration.url), {
        method: "GET",
        headers,
        cache: "no-store",
        redirect: "error"
      });
      if (!userResponse.ok) return 401;
      const user = await userResponse.json();
      if (!user || typeof user.id !== "string" || user.id === "") return 401;

      const roleResponse = await fetchImpl(new URL("rest/v1/rpc/current_catalog_admin_role", configuration.url), {
        method: "GET",
        headers,
        cache: "no-store",
        redirect: "error"
      });
      if (!roleResponse.ok) return 403;
      return await roleResponse.json() === "owner" ? 200 : 403;
    } catch {
      return 404;
    }
  };
}

function responseHeaders(contentType, byteLength) {
  return {
    "Content-Type": contentType,
    "Content-Length": String(byteLength),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store"
  };
}

function sendBytes(request, response, status, bytes, contentType, extraHeaders = {}) {
  response.writeHead(status, { ...responseHeaders(contentType, bytes.byteLength), ...extraHeaders });
  response.end(request.method === "HEAD" ? undefined : bytes);
}

function sendNeutral(request, response, status) {
  const messages = { 401: "Unauthorized", 403: "Forbidden", 404: "Not found", 405: "Method not allowed" };
  const bytes = Buffer.from(messages[status] || "Not found", "utf8");
  const headers = status === 405 ? { Allow: "GET, HEAD" } : {};
  sendBytes(request, response, status, bytes, "text/plain; charset=utf-8", headers);
}

function sendFile(request, response, filePath) {
  try {
    if (!filePath || !statSync(filePath).isFile()) return sendNeutral(request, response, 404);
    const bytes = readFileSync(filePath);
    return sendBytes(
      request,
      response,
      200,
      bytes,
      CONTENT_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream"
    );
  } catch {
    return sendNeutral(request, response, 404);
  }
}

function sendRuntimeConfiguration(request, response, root) {
  try {
    const configuration = loadRuntimeConfiguration(root);
    const serialized = `window.BETWEEN_US_ADMIN_CONFIG = Object.freeze(${JSON.stringify(configuration)});\n`;
    return sendBytes(request, response, 200, Buffer.from(serialized, "utf8"), "text/javascript; charset=utf-8");
  } catch {
    return sendNeutral(request, response, 404);
  }
}

export function createStaticServer(root = repositoryRoot, options = {}) {
  const authorizeMaintenanceRequest = options.authorizeMaintenanceRequest
    || createMaintenanceAuthorizer({ root, fetchImpl: options.fetchImpl });
  return createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendNeutral(request, response, 405);
      return;
    }

    const parsed = parseRequestUrl(request.url || "/");
    if (!parsed) {
      sendNeutral(request, response, 404);
      return;
    }
    if (parsed.pathname === RUNTIME_CONFIG_URL && !parsed.url.search && !parsed.url.hash) {
      sendRuntimeConfiguration(request, response, root);
      return;
    }
    if (parsed.pathname === MAINTENANCE_PREFIX || parsed.pathname.startsWith(`${MAINTENANCE_PREFIX}/`)) {
      const filePath = resolveMaintenanceRequest(request.url || "/", root);
      if (!filePath) {
        sendNeutral(request, response, 404);
        return;
      }
      let status;
      try {
        status = await authorizeMaintenanceRequest(request);
      } catch {
        status = 404;
      }
      if (status !== 200) {
        sendNeutral(request, response, [401, 403, 404].includes(status) ? status : 404);
        return;
      }
      sendFile(request, response, filePath);
      return;
    }

    sendFile(request, response, resolveStaticRequest(request.url || "/", root));
  });
}

async function main() {
  const port = Number.parseInt(process.env.ADMIN_PORT || String(DEFAULT_PORT), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("ADMIN_PORT must be an integer from 1 to 65535.");
    process.exitCode = 1;
    return;
  }
  const server = createStaticServer();
  server.listen(port, HOST, () => {
    console.log(`Seller Manager available at http://${HOST}:${port}/admin/`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
