#!/usr/bin/env node

import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HOST = "127.0.0.1";
export const DEFAULT_PORT = 3000;
export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CONTENT_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
});

export function resolveStaticRequest(requestUrl, root = repositoryRoot) {
  const url = new URL(requestUrl, `http://${HOST}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname.includes("\0") || pathname.includes("\\")) return null;
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

export function createStaticServer(root = repositoryRoot) {
  return createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }

    const filePath = resolveStaticRequest(request.url || "/", root);
    try {
      if (!filePath || !statSync(filePath).isFile()) throw Object.assign(new Error("Not found"), { code: "ENOENT" });
      response.writeHead(200, {
        "Content-Type": CONTENT_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "no-store"
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      createReadStream(filePath).pipe(response);
    } catch (error) {
      const status = error.code === "ENOENT" ? 404 : 500;
      response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(status === 404 ? "Not found" : "Server error");
    }
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
