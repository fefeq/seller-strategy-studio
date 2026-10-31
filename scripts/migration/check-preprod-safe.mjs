#!/usr/bin/env node
// CA-26 (data part): the new project holds restored data but nothing in it can act on its own.
//   check-preprod-safe.mjs --from <snapshot.json>      Offline, on a snapshot written by verify-data.mjs.
//   check-preprod-safe.mjs --env <VAR>                  Takes a fresh snapshot first (run BEFORE restoring).
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { die, parseArgs, readJson } from "./lib.mjs";

const { flags } = parseArgs(process.argv.slice(2));
let from = flags.from;
if (!from) {
  const env = flags.env ?? die("uso: --from <snapshot.json> o --env <VAR>");
  from = join(mkdtempSync(join(tmpdir(), "nokko-safe-")), "snapshot.json");
  const r = spawnSync(
    "node",
    [
      resolve(import.meta.dirname, "verify-data.mjs"),
      "snapshot",
      "--env",
      env,
      "--out",
      from,
      "--schemas",
      "public",
    ],
    { stdio: "inherit" },
  );
  if (r.status !== 0) process.exit(1);
}

const c = readJson(from).catalog ?? {};
const problems = [];
if ((c.cron_jobs ?? 0) > 0)
  problems.push(`${c.cron_jobs} tarea(s) programada(s) en la base (cron)`);
if ((c.db_webhooks ?? 0) > 0) problems.push(`${c.db_webhooks} webhook(s) de base de datos`);
if (problems.length) {
  console.error("FALLO: el destino no es seguro para restaurar datos reales");
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}
console.log("OK: sin tareas programadas ni webhooks de base de datos en el destino");
