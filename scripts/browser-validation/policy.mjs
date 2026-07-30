import { isIP } from "node:net";

export const ACTION_CLASSES = Object.freeze({
  OBSERVE: "OBSERVE",
  HUMAN_CHECKPOINT: "HUMAN_CHECKPOINT",
  PROHIBITED_WRITE: "PROHIBITED_WRITE"
});

export const PRODUCTION_CATALOG_BASE =
  "https://bvega.github.io/qr-jewelry-catalog/";
export const PRODUCTION_MANAGER_URL =
  "https://bvega.github.io/qr-jewelry-catalog/admin/";
export const APPROVED_QR_LIBRARY =
  "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";

export const LOCAL_NAVIGATION_ORIGINS = Object.freeze([
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4175"
]);
export const LOCAL_SUPABASE_ORIGIN = "http://127.0.0.1:54321";

const productionBase = new URL(PRODUCTION_CATALOG_BASE);
const publicPaths = new Set([
  productionBase.pathname,
  `${productionBase.pathname}index.html`,
  `${productionBase.pathname}find.html`,
  `${productionBase.pathname}item.html`
]);
const managerPaths = new Set([
  `${productionBase.pathname}admin/`,
  `${productionBase.pathname}admin/index.html`
]);
const localPublicPaths = new Set(["/", "/index.html", "/find.html", "/item.html"]);
const localManagerPaths = new Set(["/admin/", "/admin/index.html", "/"]);
const publicIds = new Set(["BU-0001", "BU-0002", "BU-0003", "BU-0004", "BU-0005"]);
const legacyIds = new Set(["1", "2", "3", "4", "5"]);
const publicSlugs = new Set([
  "gold-twisted-rope-bracelet",
  "silver-stackable-ring-set",
  "pearl-drop-earrings",
  "layered-gold-chain-necklace",
  "crystal-stud-earrings"
]);

const observeActions = new Set([
  "navigate_approved",
  "read_visible_text",
  "inspect_semantic_ui",
  "capture_anonymous_screenshot",
  "inspect_anonymous_console",
  "inspect_anonymous_network_metadata",
  "apply_public_filter",
  "select_public_gallery_photo",
  "open_public_detail",
  "verify_public_canonical",
  "verify_ui_presence"
]);

const checkpointActions = new Set([
  "authenticate_privately",
  "sign_out",
  "terminate_session",
  "scan_qr",
  "open_and_cancel_share_sheet"
]);

const prohibitedActions = new Set([
  "publish",
  "unpublish",
  "create",
  "edit",
  "save",
  "archive",
  "restore",
  "delete",
  "upload",
  "download",
  "copy_clipboard",
  "send_message",
  "reserve",
  "inspect_credentials",
  "inspect_cookies",
  "inspect_browser_storage",
  "inspect_authenticated_network",
  "inspect_authenticated_console",
  "capture_authenticated_screenshot"
]);

function reject(message) {
  const error = new Error(message);
  error.code = "M09_POLICY_DENIED";
  throw error;
}

function parseURL(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    reject(`${label} must be an absolute URL.`);
  }
  if (url.username || url.password) reject(`${label} cannot contain credentials.`);
  return url;
}

function validatePublicQuery(url) {
  const entries = [...url.searchParams.entries()];
  if (url.pathname.endsWith("/index.html") || url.pathname.endsWith("/")) {
    if (entries.length !== 0) reject("Catalog navigation cannot include a query.");
    return;
  }
  if (entries.length !== 1) reject("Find navigation requires exactly one approved query.");
  const [[name, value]] = entries;
  if (url.pathname.endsWith("/find.html")) {
    if (name === "id" && publicIds.has(value)) return;
    if (name === "slug" && publicSlugs.has(value)) return;
  }
  if (url.pathname.endsWith("/item.html") && name === "id" && legacyIds.has(value)) return;
  reject("Find navigation query is outside the protected five-Find baseline.");
}

export function assertNavigation(
  value,
  { phase = "anonymous", allowLocal = false } = {}
) {
  if (phase !== "anonymous" && phase !== "manager") {
    reject("Navigation phase must be anonymous or manager.");
  }
  const url = parseURL(value, "Navigation target");
  if (url.hash) reject("Navigation fragments are not approved for the rehearsal.");

  const isProduction = url.origin === productionBase.origin;
  const isLocal = allowLocal && LOCAL_NAVIGATION_ORIGINS.includes(url.origin);
  if (!isProduction && !isLocal) reject("Navigation origin is not allowlisted.");
  if (isProduction && url.protocol !== "https:") reject("Production navigation requires HTTPS.");
  if (isLocal && (url.protocol !== "http:" || url.hostname !== "127.0.0.1")) {
    reject("Local navigation requires an exact loopback origin.");
  }

  const paths = phase === "manager"
    ? (isProduction ? managerPaths : localManagerPaths)
    : (isProduction ? publicPaths : localPublicPaths);
  if (!paths.has(url.pathname)) reject("Navigation path is not allowlisted for this phase.");

  if (phase === "manager") {
    if (url.search) reject("Manager navigation cannot include a query.");
  } else {
    validatePublicQuery(url);
  }
  return Object.freeze({
    phase,
    url: url.href,
    origin: url.origin,
    production: isProduction
  });
}

export function assertRedirectChain(urls, options) {
  if (!Array.isArray(urls) || urls.length === 0) {
    reject("A redirect chain must contain at least one navigation target.");
  }
  return Object.freeze(urls.map((url) => assertNavigation(url, options)));
}

export function pinSupabaseOrigin(value) {
  const url = parseURL(value, "Supabase service origin");
  const labels = url.hostname.split(".");
  const projectReference = labels[0] || "";
  if (
    url.protocol !== "https:" ||
    labels.length !== 3 ||
    labels[1] !== "supabase" ||
    labels[2] !== "co" ||
    projectReference.length < 8 ||
    projectReference.length > 63 ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(projectReference) ||
    isIP(url.hostname) !== 0 ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    reject("Supabase service origin is not an exact remote project origin.");
  }
  return Object.freeze({
    origin: url.origin,
    evidenceAlias: "https://SUPABASE_ORIGIN"
  });
}

export function assertAnonymousRequest(
  { url: value, method = "GET" },
  { pinnedSupabaseOrigin } = {}
) {
  const url = parseURL(value, "Anonymous request");
  const normalizedMethod = String(method).toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(normalizedMethod)) {
    reject("Anonymous rehearsal requests must be read-only.");
  }

  if (url.origin === productionBase.origin) {
    if (!url.pathname.startsWith(productionBase.pathname)) {
      reject("Request escaped the production project path.");
    }
    return Object.freeze({ service: "catalog", method: normalizedMethod });
  }
  if (url.href === APPROVED_QR_LIBRARY) {
    return Object.freeze({ service: "qr-library", method: normalizedMethod });
  }
  if (pinnedSupabaseOrigin && url.origin === pinnedSupabaseOrigin.origin) {
    if (
      !url.pathname.startsWith("/rest/v1/") &&
      !url.pathname.startsWith("/storage/v1/object/authenticated/find-images/")
    ) {
      reject("Supabase request path is outside anonymous catalog reads.");
    }
    return Object.freeze({ service: "supabase", method: normalizedMethod });
  }
  reject("Anonymous request origin is not allowlisted.");
}

export function assertLocalRequest(
  { url: value, method = "GET" },
  { phase = "anonymous" } = {}
) {
  if (phase !== "anonymous" && phase !== "manager") {
    reject("Local request phase must be anonymous or manager.");
  }
  const url = parseURL(value, "Local request");
  const normalizedMethod = String(method).toUpperCase();
  if (
    url.origin !== LOCAL_SUPABASE_ORIGIN ||
    url.username ||
    url.password ||
    url.hash
  ) {
    reject("Local rehearsal requests require the exact loopback Supabase origin.");
  }

  if (phase === "anonymous") {
    if (!["GET", "HEAD", "OPTIONS"].includes(normalizedMethod)) {
      reject("Anonymous local rehearsal requests must be read-only.");
    }
    if (
      !url.pathname.startsWith("/rest/v1/") &&
      !url.pathname.startsWith("/storage/v1/object/authenticated/find-images/")
    ) {
      reject("Anonymous local request path is outside catalog reads.");
    }
    return Object.freeze({
      service: "local-supabase",
      method: normalizedMethod,
      writeCapable: false
    });
  }

  const readOnly = ["GET", "HEAD", "OPTIONS"].includes(normalizedMethod);
  const humanAuthentication =
    normalizedMethod === "POST" &&
    (url.pathname === "/auth/v1/token" || url.pathname === "/auth/v1/logout");
  const humanPublication =
    normalizedMethod === "PATCH" &&
    url.pathname === "/rest/v1/finds";
  if (!readOnly && !humanAuthentication && !humanPublication) {
    reject("Manager request is outside the local human-checkpoint boundary.");
  }
  return Object.freeze({
    service: "local-supabase",
    method: normalizedMethod,
    writeCapable: !readOnly,
    humanOnly: !readOnly
  });
}

export function classifyAction(action) {
  if (observeActions.has(action)) return ACTION_CLASSES.OBSERVE;
  if (checkpointActions.has(action)) return ACTION_CLASSES.HUMAN_CHECKPOINT;
  if (prohibitedActions.has(action)) return ACTION_CLASSES.PROHIBITED_WRITE;
  return ACTION_CLASSES.PROHIBITED_WRITE;
}

export function requireAction(action) {
  const classification = classifyAction(action);
  if (classification === ACTION_CLASSES.PROHIBITED_WRITE) {
    reject(`Action is prohibited during M09 Stage A: ${action}`);
  }
  return classification;
}

export const CHECKPOINT_INSTRUCTIONS = Object.freeze({
  authentication:
    "Sign in privately in the isolated Browser. Do not send credentials or identifiers here. When the Manager is ready, reply only READY.",
  unexpected:
    "Stop. Leave the page unchanged and report only the visible non-private warning or unexpected destination."
});
