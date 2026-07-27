#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { pagesArtifactRoot } from "./build-pages-artifact.mjs";

export const PAGES_HOST = "127.0.0.1";
export const PAGES_DEFAULT_PORT = 4175;

const CONTENT_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
});

export function parsePagesPort(value = String(PAGES_DEFAULT_PORT)) {
  if (!/^[1-9][0-9]{0,4}$/.test(value)) {
    throw new Error("PAGES_PORT must be an integer from 1 to 65535.");
  }
  const port = Number(value);
  if (port > 65535) throw new Error("PAGES_PORT must be an integer from 1 to 65535.");
  return port;
}

export function resolvePagesRequest(requestUrl, root = pagesArtifactRoot) {
  let url;
  try {
    url = new URL(requestUrl, `http://${PAGES_HOST}`);
  } catch {
    return null;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname.includes("\0") || pathname.includes("\\") || pathname.split("/").some((part) => part.startsWith("."))) {
    return null;
  }
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/admin" || pathname === "/admin/") pathname = "/admin/index.html";
  const candidate = resolve(root, `.${pathname}`);
  const relativePath = relative(root, candidate);
  if (
    !relativePath
    || relativePath === ".."
    || relativePath.startsWith(`..${sep}`)
    || relativePath.includes(`${sep}..${sep}`)
  ) return null;
  return candidate;
}

function send(response, status, body, type = "text/plain; charset=utf-8", head = false) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": String(body.byteLength),
    "Content-Type": type,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(head ? undefined : body);
}

export function createPagesServer(root = pagesArtifactRoot) {
  return createServer((request, response) => {
    if (!["GET", "HEAD"].includes(request.method || "")) {
      response.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }
    const filePath = resolvePagesRequest(request.url || "/", root);
    try {
      if (!filePath || !statSync(filePath).isFile()) throw new Error("not found");
      const body = readFileSync(filePath);
      send(
        response,
        200,
        body,
        CONTENT_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
        request.method === "HEAD"
      );
    } catch {
      send(response, 404, Buffer.from("Not found", "utf8"), undefined, request.method === "HEAD");
    }
  });
}

async function main() {
  let port;
  try {
    port = parsePagesPort(process.env.PAGES_PORT);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  const server = createPagesServer();
  server.on("error", () => {
    console.error(`Pages preview could not bind to http://${PAGES_HOST}:${port}/.`);
    process.exitCode = 1;
  });
  const shutdown = () => {
    server.close(() => {
      console.log("Pages preview stopped.");
      process.exitCode = 0;
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  server.listen(port, PAGES_HOST, () => {
    console.log(`Pages public preview: http://${PAGES_HOST}:${port}/`);
    console.log(`Pages Manager preview: http://${PAGES_HOST}:${port}/admin/`);
    console.log("Press Ctrl+C to stop.");
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
