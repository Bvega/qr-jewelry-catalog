#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";
import { build } from "esbuild";
import {
  LOCAL_SUPABASE_ORIGIN
} from "./policy.mjs";
import { sanitizeText } from "./sanitizer.mjs";
import {
  LOCAL_CANARY_PUBLIC_ID,
  LOCAL_CANARY_TITLE,
  LOCAL_RELATION_ANCHOR_PUBLIC_ID
} from "./stage-b.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const runtimeRoot = resolve(tmpdir(), "m09-stage-b-local");
const siteRoot = resolve(runtimeRoot, "site");
const credentialPath = resolve(runtimeRoot, "LOCAL_CREDENTIALS.txt");
const statePath = resolve(runtimeRoot, "state.json");
const supabaseExecutable = resolve(repositoryRoot, "node_modules/.bin/supabase");
const localProjectReference = "local-m07b3";
const managerOrigin = "http://127.0.0.1:3000";
const managerURL = `${managerOrigin}/admin/`;
const forbiddenEnvironmentNames = Object.freeze([
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL"
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABEUlEQVR4nLXWzQ3CMAwFYE9TMRRDdgwm4hqUg6WQ2n7+S6WIS1p/QJ9jGmOM7+elrut9m8u6F90/L5qbLMQpwLzmJ/FGDXECwMX/ABqiG7AWfwAkRCdgLy4CdkQXQCquAlZEB0ArbgIYUQWgZxAqUOkT6N65ICDbJ/ibtwCifWL92dsA3j6x/+etANQnpBeuHaD1Ce1tPwLY+4QVtWMARqCcQwDagHJenSfSgDXnlXkiBZBynp0nwgAr55l5IgTw5Dw6T7gBkZxH5gkXIJNz7zwBAZWce+YJsxF5znNUAD1DBXjPcwRAfUIERM5zD8BCPADR89wL0BBkFe8GSAiyip8A7AjK5rwCWBFUPc+zAEb8AFmjiNc/VvyEAAAAAElFTkSuQmCC",
  "base64"
);

function fail(message) {
  const error = new Error(message);
  error.code = "M09_LOCAL_CANARY_FAILED";
  throw error;
}

function assertRuntimeRoot() {
  if (basename(runtimeRoot) !== "m09-stage-b-local" || runtimeRoot === tmpdir()) {
    fail("The disposable runtime root is not exact.");
  }
}

function assertNoRemoteEnvironment() {
  const present = forbiddenEnvironmentNames.filter(
    (name) => Object.hasOwn(process.env, name) && process.env[name] !== ""
  );
  if (present.length > 0) {
    fail("A remote-capable Supabase environment is present; local setup stopped.");
  }
}

function childEnvironment() {
  const environment = {
    ...process.env,
    DO_NOT_TRACK: "1",
    SUPABASE_TELEMETRY_DISABLED: "1"
  };
  for (const name of forbiddenEnvironmentNames) delete environment[name];
  return environment;
}

function run(command, arguments_, {
  input,
  allowFailure = false,
  encoding = "utf8",
  label = "local command"
} = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    env: childEnvironment(),
    input,
    encoding,
    maxBuffer: 32 * 1024 * 1024
  });
  if (!allowFailure && (result.error || result.status !== 0)) {
    fail(`A disposable ${label} failed without retaining its raw output.`);
  }
  return result;
}

function runSupabase(arguments_, options) {
  if (!existsSync(supabaseExecutable)) {
    fail("The locked local Supabase CLI is unavailable; dependency installation is prohibited.");
  }
  return run(
    supabaseExecutable,
    [...arguments_, "--workdir", repositoryRoot, "--agent", "no"],
    {
      ...options,
      label: options?.label || `Supabase ${arguments_.join(" ")} command`
    }
  );
}

function localStatus() {
  const result = runSupabase(["status", "-o", "env"]);
  const values = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  const apiUrl = values.API_URL;
  const publishableKey = values.PUBLISHABLE_KEY || values.ANON_KEY;
  const serviceKey = values.SECRET_KEY || values.SERVICE_ROLE_KEY;
  if (
    apiUrl !== LOCAL_SUPABASE_ORIGIN ||
    typeof publishableKey !== "string" ||
    publishableKey.length < 16 ||
    typeof serviceKey !== "string" ||
    serviceKey.length < 16
  ) {
    fail("Local Supabase status did not return the exact loopback configuration.");
  }
  return Object.freeze({ apiUrl, publishableKey, serviceKey });
}

function databaseContainer() {
  const result = run("docker", ["ps", "--format", "{{.Names}}"], {
    label: "Docker container listing command"
  });
  const matches = result.stdout
    .split(/\r?\n/)
    .filter((name) => name === "supabase_db_qr-jewelry-catalog");
  if (matches.length !== 1) fail("The exact disposable local database container is unavailable.");
  return matches[0];
}

function sql(source) {
  const result = run("docker", [
    "exec",
    "-i",
    databaseContainer(),
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-Atq"
  ], { input: source, label: "local database SQL command" });
  return result.stdout.trim();
}

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function assertFixturePhotoReady(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.subarray(0, 8).equals(pngSignature)) {
    fail("The local canary photograph is not a PNG.");
  }

  const chunks = [];
  let offset = pngSignature.length;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;
    if (crcEnd > buffer.length) fail("The local canary PNG chunk structure is invalid.");
    const data = buffer.subarray(dataStart, dataEnd);
    const expectedCrc = buffer.readUInt32BE(dataEnd);
    const actualCrc = crc32(buffer.subarray(offset + 4, dataEnd));
    if (actualCrc !== expectedCrc) fail("The local canary PNG chunk checksum is invalid.");
    chunks.push({ type, data });
    offset = crcEnd;
    if (type === "IEND") break;
  }
  if (offset !== buffer.length) fail("The local canary PNG has trailing or truncated bytes.");

  const ihdr = chunks.find((chunk) => chunk.type === "IHDR")?.data;
  const idat = chunks
    .filter((chunk) => chunk.type === "IDAT")
    .map((chunk) => chunk.data);
  if (!ihdr || ihdr.length !== 13 || idat.length === 0) {
    fail("The local canary PNG is missing required chunks.");
  }
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const compression = ihdr[10];
  const filter = ihdr[11];
  const interlace = ihdr[12];
  if (
    width < 32 ||
    height < 32 ||
    bitDepth !== 8 ||
    colorType !== 6 ||
    compression !== 0 ||
    filter !== 0 ||
    interlace !== 0
  ) {
    fail("The local canary PNG is not a visible 32x32 RGBA image.");
  }

  const decoded = inflateSync(Buffer.concat(idat));
  const rowLength = 1 + width * 4;
  if (decoded.length !== rowLength * height) {
    fail("The local canary PNG decoded byte length is invalid.");
  }
  const colors = new Set();
  let visiblePixels = 0;
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowLength;
    if (decoded[rowOffset] !== 0) {
      fail("The local canary PNG uses an unsupported row filter.");
    }
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const alpha = decoded[pixelOffset + 3];
      if (alpha > 0) {
        visiblePixels += 1;
        colors.add(decoded.subarray(pixelOffset, pixelOffset + 4).toString("hex"));
      }
    }
  }
  if (visiblePixels < width * height || colors.size < 3) {
    fail("The local canary PNG does not contain nontrivial visible content.");
  }
  return Object.freeze({
    width,
    height,
    byteLength: buffer.length,
    visiblePixels,
    uniqueColors: colors.size
  });
}

async function localFetch(path, {
  method = "GET",
  key,
  body,
  contentType = "application/json"
} = {}) {
  const url = new URL(path, LOCAL_SUPABASE_ORIGIN);
  if (url.origin !== LOCAL_SUPABASE_ORIGIN) fail("A local request escaped loopback.");
  const headers = { apikey: key };
  if (key) headers.Authorization = `Bearer ${key}`;
  if (body !== undefined) headers["Content-Type"] = contentType;
  const response = await fetch(url, {
    method,
    headers,
    body:
      body === undefined || Buffer.isBuffer(body) || typeof body === "string"
        ? body
        : JSON.stringify(body),
    redirect: "error",
    cache: "no-store"
  });
  return response;
}

async function createLocalOwner(serviceKey) {
  const email =
    `m09-local-owner-${randomBytes(6).toString("hex")}@example.test`;
  const password = `M09!${randomBytes(18).toString("base64url")}`;
  const response = await localFetch("/auth/v1/admin/users", {
    method: "POST",
    key: serviceKey,
    body: {
      email,
      password,
      email_confirm: true
    }
  });
  if (!response.ok) fail("The ephemeral local owner could not be created.");
  const payload = await response.json();
  if (!uuidPattern.test(payload?.id || "")) {
    fail("The ephemeral local owner response was malformed.");
  }
  writeFileSync(
    credentialPath,
    [
      "M09 disposable localhost rehearsal",
      `Manager: ${managerURL}`,
      `Email: ${email}`,
      `Password: ${password}`,
      "",
      "Enter these values privately in the isolated in-app Browser.",
      "Do not paste them into chat, logs, screenshots, or evidence.",
      "This file is removed during the mandatory local reset."
    ].join("\n") + "\n",
    { encoding: "utf8", mode: 0o600 }
  );
  return payload.id;
}

async function rotateLocalOwner() {
  assertRuntimeRoot();
  assertNoRemoteEnvironment();
  const configuration = localStatus();
  const priorOwnerId = sql(`
select user_id
from private.catalog_admins
where role = 'owner'
order by created_at
limit 1;
`);
  if (!uuidPattern.test(priorOwnerId)) {
    fail("The current disposable local owner is unavailable for rotation.");
  }

  const deletion = await localFetch(
    `/auth/v1/admin/users/${encodeURIComponent(priorOwnerId)}?should_soft_delete=false`,
    {
      method: "DELETE",
      key: configuration.serviceKey
    }
  );
  if (!deletion.ok) fail("The prior disposable local owner could not be invalidated.");
  if (existsSync(credentialPath)) rmSync(credentialPath, { force: false });

  const invalidationProof = sql(`
select concat_ws(
  ':',
  (select count(*) from auth.users where id = ${quoteSql(priorOwnerId)}),
  (select count(*) from auth.sessions where user_id = ${quoteSql(priorOwnerId)}),
  (select count(*) from private.catalog_admins where user_id = ${quoteSql(priorOwnerId)})
);
`);
  if (invalidationProof !== "0:0:0") {
    fail("The prior disposable account or session remained after rotation.");
  }

  const nextOwnerId = await createLocalOwner(configuration.serviceKey);
  sql(`
insert into private.catalog_admins (user_id, role)
values (${quoteSql(nextOwnerId)}, 'owner');
`);
  const nextProof = sql(`
select concat_ws(
  ':',
  (select count(*) from auth.users where id = ${quoteSql(nextOwnerId)}),
  (select count(*) from private.catalog_admins where user_id = ${quoteSql(nextOwnerId)} and role = 'owner'),
  (select count(*) from auth.users),
  (select count(*) from private.catalog_admins)
);
`);
  if (nextProof !== "1:1:1:1") {
    fail("The rotated disposable local owner proof differs.");
  }
  console.log("M09 disposable local credential rotation: PASS");
  console.log("Prior local account and sessions: invalidated");
  console.log("Rotated credential: retained only in the private local sheet");
}

function createFixture(ownerId) {
  if (!uuidPattern.test(ownerId)) fail("The local owner identifier is invalid.");
  const canaryId = sql(`
begin;
insert into private.catalog_admins (user_id, role)
values (${quoteSql(ownerId)}, 'owner');

insert into public.finds (
  public_id,
  slug,
  title,
  collection_id,
  price_amount,
  price_currency,
  availability,
  description,
  condition,
  is_published,
  sort_order,
  archived_at
)
values (
  ${quoteSql(LOCAL_RELATION_ANCHOR_PUBLIC_ID)},
  null,
  'M09 Local Relation Anchor',
  'jewelry',
  10.01,
  'USD',
  'available',
  'Disposable local-only shadow used to validate a related protected Find.',
  'Local test fixture',
  true,
  9001,
  null
);

with inserted as (
  insert into public.finds (
    public_id,
    slug,
    title,
    collection_id,
    price_amount,
    price_currency,
    availability,
    description,
    condition,
    is_published,
    sort_order,
    archived_at
  )
  values (
    ${quoteSql(LOCAL_CANARY_PUBLIC_ID)},
    'm09-local-write-canary',
    ${quoteSql(LOCAL_CANARY_TITLE)},
    'jewelry',
    19.09,
    'USD',
    'available',
    'Disposable localhost-only Find for the M09 human publish and rollback rehearsal.',
    'Safe local test fixture',
    false,
    9000,
    null
  )
  returning id
)
select id from inserted;
commit;
`);
  if (!uuidPattern.test(canaryId)) fail("The local canary identifier was not created safely.");
  return canaryId;
}

async function attachFixturePhoto({ canaryId, serviceKey }) {
  const photoProof = assertFixturePhotoReady(tinyPng);
  const storagePath = `finds/${canaryId}/m09-local-canary.png`;
  const response = await localFetch(
    `/storage/v1/object/find-images/${storagePath.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      key: serviceKey,
      body: tinyPng,
      contentType: "image/png"
    }
  );
  if (!response.ok) fail("The safe local test photo could not be uploaded.");
  const download = await localFetch(
    `/storage/v1/object/authenticated/find-images/${
      storagePath.split("/").map(encodeURIComponent).join("/")
    }`,
    { key: serviceKey }
  );
  const storedBytes = download.ok
    ? Buffer.from(await download.arrayBuffer())
    : Buffer.alloc(0);
  if (
    !download.ok ||
    download.headers.get("content-type") !== "image/png" ||
    !storedBytes.equals(tinyPng)
  ) {
    fail("The uploaded local canary photo byte proof differs.");
  }
  assertFixturePhotoReady(storedBytes);
  sql(`
insert into public.find_photos (
  find_id,
  storage_path,
  role,
  sequence,
  alt_text,
  width,
  height
)
values (
  ${quoteSql(canaryId)},
  ${quoteSql(storagePath)},
  'primary',
  1,
  'Synthetic local-only M09 canary image.',
  ${photoProof.width},
  ${photoProof.height}
);

insert into public.find_relations (find_id, related_find_id, sort_order)
select
  ${quoteSql(canaryId)},
  id,
  1
from public.finds
where public_id = ${quoteSql(LOCAL_RELATION_ANCHOR_PUBLIC_ID)};
`);
}

function canaryPhotoStoragePath() {
  const storagePath = sql(`
select p.storage_path
from public.find_photos p
join public.finds f on f.id = p.find_id
where f.public_id = ${quoteSql(LOCAL_CANARY_PUBLIC_ID)}
  and p.role = 'primary'
  and p.sequence = 1
  and p.width = 32
  and p.height = 32;
`);
  if (!/^finds\/[0-9a-f-]+\/m09-local-canary\.png$/i.test(storagePath)) {
    fail("The local canary photo metadata contract differs.");
  }
  return storagePath;
}

async function verifyStoredFixturePhoto({ key }) {
  const storagePath = canaryPhotoStoragePath();
  const response = await localFetch(
    `/storage/v1/object/authenticated/find-images/${
      storagePath.split("/").map(encodeURIComponent).join("/")
    }`,
    { key }
  );
  const bytes = response.ok
    ? Buffer.from(await response.arrayBuffer())
    : Buffer.alloc(0);
  if (
    !response.ok ||
    response.headers.get("content-type") !== "image/png" ||
    !bytes.equals(tinyPng)
  ) {
    fail("The local canary Storage byte proof differs.");
  }
  return assertFixturePhotoReady(bytes);
}

function serializeConfig(configuration, publicOnly = false) {
  const value = publicOnly
    ? {
        url: configuration.apiUrl,
        publishableKey: configuration.publishableKey
      }
    : {
        url: configuration.apiUrl,
        publishableKey: configuration.publishableKey,
        projectRef: localProjectReference
      };
  const name = publicOnly
    ? "BETWEEN_US_PUBLIC_CONFIG"
    : "BETWEEN_US_ADMIN_CONFIG";
  return `window.${name} = Object.freeze(${JSON.stringify(value, null, 2)});\n`;
}

function localPublicHtml(source) {
  const policy = [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' https://cdnjs.cloudflare.com",
    "style-src 'self'",
    `connect-src 'self' ${LOCAL_SUPABASE_ORIGIN}`,
    `img-src 'self' data: blob: ${LOCAL_SUPABASE_ORIGIN}`,
    "font-src 'self'"
  ].join("; ");
  const marker = "<head>";
  if (!source.includes(marker)) fail("A public HTML shell could not receive its local CSP.");
  return source.replace(
    marker,
    `${marker}\n  <meta http-equiv="Content-Security-Policy" content="${policy};">`
  );
}

function localManagerHtml(source) {
  const transformed = source
    .replaceAll(" https://*.supabase.co wss://*.supabase.co", "")
    .replaceAll(" https://*.supabase.co", "");
  if (
    transformed.includes(".supabase.co") ||
    !transformed.includes(`connect-src 'self' ${LOCAL_SUPABASE_ORIGIN}`)
  ) {
    fail("The Manager shell could not be restricted to exact loopback.");
  }
  return transformed;
}

async function buildLocalSite(configuration) {
  const manifest = JSON.parse(
    readFileSync(resolve(repositoryRoot, "deployment/pages-manifest.json"), "utf8")
  );
  mkdirSync(siteRoot, { recursive: true });
  for (const entry of manifest.files) {
    const output = resolve(siteRoot, entry.output);
    mkdirSync(dirname(output), { recursive: true });
    if (entry.output === ".nojekyll") {
      writeFileSync(output, "");
      continue;
    }
    if (entry.output === "admin/assets/app.js") continue;
    if (entry.output === "admin/assets/styles.css") {
      cpSync(resolve(repositoryRoot, "admin/assets/styles.css"), output);
      continue;
    }
    if (entry.output === "admin/runtime-config.js") {
      const source = serializeConfig(configuration);
      writeFileSync(output, source, {
        encoding: "utf8",
        mode: 0o600
      });
      writeFileSync(resolve(siteRoot, "admin/config.js"), source, {
        encoding: "utf8",
        mode: 0o600
      });
      continue;
    }
    if (entry.output === "runtime-config.js") {
      writeFileSync(output, serializeConfig(configuration, true), {
        encoding: "utf8",
        mode: 0o600
      });
      continue;
    }
    const source = readFileSync(resolve(repositoryRoot, entry.source), "utf8");
    if (entry.output === "admin/index.html") {
      writeFileSync(output, localManagerHtml(source));
    } else if (entry.output.endsWith(".html")) {
      writeFileSync(output, localPublicHtml(source));
    } else {
      cpSync(resolve(repositoryRoot, entry.source), output);
    }
  }

  const appSource = readFileSync(resolve(repositoryRoot, "admin-src/app.js"), "utf8");
  const guard = 'return url.protocol === "https:"';
  const replacement = `return (url.protocol === "https:" || (
      url.protocol === "http:"
      && url.hostname === "127.0.0.1"
      && url.port === "54321"
      && value.projectRef === "${localProjectReference}"
    ))`;
  if (appSource.split(guard).length !== 2) {
    fail("The accepted Manager configuration guard differs from the local harness contract.");
  }
  await build({
    bundle: true,
    charset: "utf8",
    legalComments: "none",
    logLevel: "silent",
    minify: true,
    sourcemap: false,
    target: ["es2020"],
    format: "iife",
    platform: "browser",
    outfile: resolve(siteRoot, "admin/assets/app.js"),
    stdin: {
      contents: appSource.replace(guard, replacement),
      loader: "js",
      resolveDir: resolve(repositoryRoot, "admin-src"),
      sourcefile: "app.js"
    }
  });
  if (
    readFileSync(resolve(siteRoot, "admin/assets/app.js"), "utf8").includes(
      "https://bvega.github.io"
    )
  ) {
    fail("The disposable Manager bundle contains a production destination.");
  }
}

function verifyPreparedState() {
  const proof = sql(`
select concat_ws(
  ':',
  (
    select count(*)
    from public.finds
    where public_id = ${quoteSql(LOCAL_CANARY_PUBLIC_ID)}
      and is_published = false
      and archived_at is null
  ),
  (
    select count(*)
    from public.find_photos
    where find_id = (
      select id from public.finds where public_id = ${quoteSql(LOCAL_CANARY_PUBLIC_ID)}
    )
      and width = 32
      and height = 32
  ),
  (
    select count(*)
    from storage.objects
    where bucket_id = 'find-images'
      and name like 'finds/%/m09-local-canary.png'
  ),
  (select last_value from public.find_public_id_seq),
  (select is_called from public.find_public_id_seq)
);
`);
  if (proof !== "1:1:1:9:t") fail("The local fixture or sequence proof differs.");
}

function spawnServer() {
  const serverScript = fileURLToPath(
    new URL("./local-canary-server.mjs", import.meta.url)
  );
  const child = spawn(process.execPath, [serverScript], {
    cwd: repositoryRoot,
    env: childEnvironment(),
    detached: true,
    stdio: ["ignore", "ignore", "pipe"]
  });
  let sanitizedFailure = "";
  let stderrBuffer = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderrBuffer += chunk;
    const controlled =
      /M09 disposable local canary: FAIL\s+- ([^\r\n]+)/.exec(stderrBuffer);
    if (controlled) sanitizedFailure = controlled[1];
    else if (/EADDRINUSE/.test(stderrBuffer)) {
      sanitizedFailure = "loopback port unavailable";
    } else if (/Invalid browser configuration/.test(stderrBuffer)) {
      sanitizedFailure = "local browser configuration validation failed";
    } else if (/ENOENT/.test(stderrBuffer)) {
      sanitizedFailure = "a required disposable site file is missing";
    } else if (/EACCES|EPERM/.test(stderrBuffer)) {
      sanitizedFailure = "the loopback server was denied local filesystem or port access";
    } else if (/SyntaxError/.test(stderrBuffer)) {
      sanitizedFailure = "the loopback server encountered a syntax error";
    } else if (/ReferenceError/.test(stderrBuffer)) {
      sanitizedFailure = "the loopback server encountered a reference error";
    } else if (/TypeError/.test(stderrBuffer)) {
      sanitizedFailure = "the loopback server encountered a type error";
    }
  });
  writeFileSync(statePath, JSON.stringify({ serverPid: child.pid }) + "\n", {
    encoding: "utf8",
    mode: 0o600
  });
  return {
    child,
    failure() {
      return sanitizedFailure || "server process exited";
    }
  };
}

async function waitForServer(serverProcess) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (serverProcess.child.exitCode !== null) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
      fail(
        `The disposable localhost Manager ${
          serverProcess.child.exitCode === 0
            ? "server process exited without starting"
            : serverProcess.failure()
        }.`
      );
    }
    try {
      const response = await fetch(managerURL, {
        method: "HEAD",
        redirect: "error",
        cache: "no-store"
      });
      lastStatus = response.status;
      if (response.ok) {
        serverProcess.child.stderr.destroy();
        serverProcess.child.unref();
        return;
      }
    } catch {
      // Retry only the exact loopback health check.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  fail(
    lastStatus
      ? `The disposable localhost Manager returned status ${lastStatus}.`
      : "The disposable localhost Manager server did not become ready."
  );
}

async function prepare() {
  assertRuntimeRoot();
  assertNoRemoteEnvironment();
  if (existsSync(runtimeRoot)) {
    fail("A prior disposable M09 runtime exists; cleanup is required before setup.");
  }
  mkdirSync(runtimeRoot, { recursive: false, mode: 0o700 });
  try {
    runSupabase(["stop", "--no-backup"], { allowFailure: true });
    runSupabase(["start"]);
    runSupabase(["db", "reset", "--local"]);
    const configuration = localStatus();
    const ownerId = await createLocalOwner(configuration.serviceKey);
    const canaryId = createFixture(ownerId);
    assertFixturePhotoReady(tinyPng);
    await attachFixturePhoto({
      canaryId,
      serviceKey: configuration.serviceKey
    });
    verifyPreparedState();
    await buildLocalSite(configuration);
    const serverProcess = spawnServer();
    await waitForServer(serverProcess);
    console.log("M09 disposable local canary preparation: PASS");
    console.log("Local runtime: exact loopback only; production write path: unavailable");
    console.log("Canary: active, hidden, unpublished; next generated ID remains BU-0010");
  } catch (error) {
    await cleanup({ failedPrepare: true });
    throw error;
  }
}

async function anonymousRows(configuration, table, query) {
  const response = await localFetch(`/rest/v1/${table}?${query}`, {
    key: configuration.publishableKey
  });
  if (!response.ok) fail("A sanitized anonymous local verification request failed.");
  const value = await response.json();
  if (!Array.isArray(value)) fail("A local anonymous response was malformed.");
  return value;
}

async function verifyHidden({ afterRollback = false } = {}) {
  const configuration = localStatus();
  const databaseProof = sql(`
select concat_ws(
  ':',
  (
    select count(*)
    from public.finds
    where public_id = ${quoteSql(LOCAL_CANARY_PUBLIC_ID)}
      and is_published = false
      and archived_at is null
  ),
  (
    select count(*)
    from public.find_photos
    where find_id = (
      select id from public.finds where public_id = ${quoteSql(LOCAL_CANARY_PUBLIC_ID)}
    )
      and width = 32
      and height = 32
  ),
  (
    select count(*)
    from storage.objects
    where bucket_id = 'find-images'
      and name like 'finds/%/m09-local-canary.png'
  ),
  (
    select count(*)
    from public.finds
    where public_id = ${quoteSql(LOCAL_CANARY_PUBLIC_ID)}
      and published_at is not null
  )
);
`);
  await verifyStoredFixturePhoto({ key: configuration.serviceKey });
  const finds = await anonymousRows(
    configuration,
    "finds",
    `select=public_id&public_id=eq.${LOCAL_CANARY_PUBLIC_ID}`
  );
  const photos = await anonymousRows(
    configuration,
    "find_photos",
    "select=id&alt_text=eq.Synthetic%20local-only%20M09%20canary%20image."
  );
  const expectedDatabaseProof = afterRollback ? "1:1:1:1" : "1:1:1:0";
  if (
    databaseProof !== expectedDatabaseProof ||
    finds.length !== 0 ||
    photos.length !== 0
  ) {
    fail("The hidden local canary or preserved media proof differs.");
  }
  console.log(
    afterRollback
      ? "M09 local rollback and preservation verification: PASS"
      : "M09 local hidden baseline verification: PASS"
  );
}

async function verifyPublished() {
  const configuration = localStatus();
  const databaseProof = sql(`
select concat_ws(
  ':',
  (
    select count(*)
    from public.finds
    where public_id = ${quoteSql(LOCAL_CANARY_PUBLIC_ID)}
      and is_published = true
      and archived_at is null
  ),
  (
    select count(*)
    from public.find_relations
    where find_id = (
      select id from public.finds where public_id = ${quoteSql(LOCAL_CANARY_PUBLIC_ID)}
    )
  )
);
`);
  const finds = await anonymousRows(
    configuration,
    "finds",
    `select=public_id,is_published,archived_at&public_id=eq.${LOCAL_CANARY_PUBLIC_ID}`
  );
  const photos = await anonymousRows(
    configuration,
    "find_photos",
    "select=storage_path,alt_text&alt_text=eq.Synthetic%20local-only%20M09%20canary%20image."
  );
  const relations = await anonymousRows(
    configuration,
    "find_relations",
    "select=sort_order&sort_order=eq.1"
  );
  if (
    databaseProof !== "1:1" ||
    finds.length !== 1 ||
    finds[0].is_published !== true ||
    finds[0].archived_at !== null ||
    photos.length !== 1 ||
    relations.length !== 1
  ) {
    fail("The published local canary anonymous proof differs.");
  }
  const image = await localFetch(
    `/storage/v1/object/authenticated/find-images/${
      photos[0].storage_path.split("/").map(encodeURIComponent).join("/")
    }`,
    { key: configuration.publishableKey }
  );
  const imageBytes = image.ok
    ? Buffer.from(await image.arrayBuffer())
    : Buffer.alloc(0);
  if (
    !image.ok ||
    image.headers.get("content-type") !== "image/png" ||
    !imageBytes.equals(tinyPng)
  ) {
    fail("The published local canary photo is not anonymously retrievable.");
  }
  assertFixturePhotoReady(imageBytes);
  console.log("M09 local published canary verification: PASS");
}

async function diagnosePhoto() {
  const configuration = localStatus();
  const photoProof = await verifyStoredFixturePhoto({ key: configuration.serviceKey });
  const proof = Object.freeze({
    downloadSucceeded: true,
    contentTypeIsPng: true,
    bytesMatchFixture: true,
    byteLength: photoProof.byteLength,
    width: photoProof.width,
    height: photoProof.height,
    visiblePixels: photoProof.visiblePixels,
    uniqueColors: photoProof.uniqueColors
  });
  console.log(JSON.stringify(proof));
}

function stopServer() {
  if (!existsSync(statePath)) return;
  let state;
  try {
    state = JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    fail("The disposable server state is malformed.");
  }
  if (!Number.isInteger(state.serverPid) || state.serverPid < 2) {
    fail("The disposable server process is invalid.");
  }
  const inspection = run("ps", ["-p", String(state.serverPid), "-o", "command="], {
    allowFailure: true
  });
  if (
    inspection.status === 0 &&
    inspection.stdout.includes("local-canary-server.mjs")
  ) {
    process.kill(state.serverPid, "SIGTERM");
  }
}

async function cleanup({ failedPrepare = false } = {}) {
  assertRuntimeRoot();
  try {
    stopServer();
  } catch {
    if (!failedPrepare) throw new Error("The disposable local server could not be stopped safely.");
  }

  const status = runSupabase(["status", "-o", "env"], { allowFailure: true });
  if (status.status === 0) {
    runSupabase(["db", "reset", "--local"]);
    const resetProof = sql(`
select concat_ws(
  ':',
  (select count(*) from public.finds),
  (select count(*) from public.find_photos),
  (select count(*) from private.catalog_admins),
  (select count(*) from auth.users),
  (select count(*) from storage.objects where bucket_id = 'find-images'),
  (select last_value from public.find_public_id_seq),
  (select is_called from public.find_public_id_seq)
);
`);
    if (resetProof !== "0:0:0:0:0:9:t") {
      fail("The final local reset did not remove every disposable fixture.");
    }
    runSupabase(["stop", "--no-backup"]);
  }

  if (existsSync(runtimeRoot)) {
    rmSync(runtimeRoot, { recursive: true, force: false });
  }
  if (!failedPrepare) {
    console.log("M09 disposable local canary cleanup: PASS");
    console.log("Local account, fixture, photo, object, credentials, and services removed");
  }
}

async function selfTestServer() {
  assertRuntimeRoot();
  if (existsSync(runtimeRoot)) fail("A disposable runtime already exists.");
  mkdirSync(runtimeRoot, { recursive: false, mode: 0o700 });
  try {
    await buildLocalSite({
      apiUrl: LOCAL_SUPABASE_ORIGIN,
      publishableKey: ["sb", "publishable", "m09localfictionalkey123456"].join("_")
    });
    const serverProcess = spawnServer();
    await waitForServer(serverProcess);
    stopServer();
    console.log("M09 disposable loopback server self-test: PASS");
  } finally {
    if (existsSync(runtimeRoot)) {
      rmSync(runtimeRoot, { recursive: true, force: false });
    }
  }
}

function showCredentials() {
  assertRuntimeRoot();
  if (!existsSync(credentialPath)) {
    fail("The private local credential sheet is unavailable.");
  }
  const result = run("open", ["-n", "-a", "TextEdit", credentialPath], {
    allowFailure: true
  });
  if (result.status !== 0) {
    fail("The private local credential sheet could not be displayed.");
  }
  console.log("Private local credential sheet opened outside the Browser.");
}

async function main() {
  const command = process.argv[2];
  try {
    if (command === "prepare") await prepare();
    else if (command === "verify-hidden") await verifyHidden();
    else if (command === "verify-published") await verifyPublished();
    else if (command === "verify-unpublished") {
      await verifyHidden({ afterRollback: true });
    } else if (command === "diagnose-photo") await diagnosePhoto();
    else if (command === "cleanup") await cleanup();
    else if (command === "rotate-credentials") await rotateLocalOwner();
    else if (command === "self-test-server") await selfTestServer();
    else if (command === "show-credentials") showCredentials();
    else fail("Unknown disposable local canary command.");
  } catch (error) {
    console.error(
      `M09 disposable local canary: FAIL\n- ${sanitizeText(error.message)}`
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
