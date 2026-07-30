#!/usr/bin/env node

import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createStaticServer, loadRuntimeConfiguration } from "../serve-static.mjs";
import { LOCAL_SUPABASE_ORIGIN } from "./policy.mjs";

const siteRoot = resolve(tmpdir(), "m09-stage-b-local/site");
const configuration = loadRuntimeConfiguration(siteRoot);

if (
  configuration.url !== `${LOCAL_SUPABASE_ORIGIN}/` ||
  configuration.projectRef !== "local-m07b3"
) {
  throw new Error("The disposable server configuration is not exact loopback.");
}

const server = createStaticServer(siteRoot);
server.listen(3000, "127.0.0.1");
