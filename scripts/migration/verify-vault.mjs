#!/usr/bin/env node
// CA-28: every company that had a Stripe key in the source still has a usable one in the destination.
//   snapshot --env <VAR> --out <file>   Asks the database, per company, whether stripe_key_for() returns a value. The value never leaves the database; only sha256(org_id) is stored.
//   diff <source.json> <target.json>    Offline. Prints counts only, never ids.
// [Por verificar] stripe_key_for may check the caller's role; run the snapshot as the database owner (postgres) if it returns nothing.
import { connect, die, parseArgs, readJson, scrub, sha256, writeJson } from "./lib.mjs";

const [cmd, ...argv] = process.argv.slice(2);
const { flags, rest } = parseArgs(argv);

async function snapshot() {
  const envName = flags.env ?? "NOKKO_SOURCE_DB_URL";
  const out = flags.out ?? die("falta --out <archivo>");
  const sql = await connect(envName);
  const withKey = [];
  let errors = 0;
  let total = 0;
  try {
    await sql.begin("read only", async (tx) => {
      const orgs =
        await tx`select distinct org_id from stripe_connections where vault_secret_id is not null`;
      total = orgs.length;
      for (const { org_id } of orgs) {
        try {
          const [r] = await tx`select stripe_key_for(${org_id}) is not null as ok`;
          if (r.ok) withKey.push(sha256(String(org_id)));
        } catch {
          errors++;
        }
      }
    });
  } catch (e) {
    return die(`no se pudo leer la base (${envName}): ${scrub(e?.message ?? e)}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
  writeJson(out, {
    version: 1,
    kind: "vault",
    taken_at: new Date().toISOString(),
    stripe_connections: total,
    stripe_orgs_with_key: withKey.sort(),
    errors,
  });
  console.log(
    `OK: ${total} empresa(s) con conexión de Stripe, ${withKey.length} con clave utilizable, ${errors} error(es) -> ${out}`,
  );
}

function diff() {
  const [aPath, bPath] = rest;
  if (!aPath || !bPath) die("uso: diff <origen.json> <destino.json>");
  const a = readJson(aPath);
  const b = readJson(bPath);
  const have = new Set(b.stripe_orgs_with_key ?? []);
  const lost = (a.stripe_orgs_with_key ?? []).filter((h) => !have.has(h)).length;
  const errors = (a.errors ?? 0) + (b.errors ?? 0);
  if (lost || errors) {
    console.error(
      `FALLO: ${lost} empresa(s) sin clave utilizable en destino, ${errors} comprobación(es) con error`,
    );
    process.exit(1);
  }
  console.log(
    `OK: las ${(a.stripe_orgs_with_key ?? []).length} empresa(s) con clave en origen la tienen en destino`,
  );
}

if (cmd === "snapshot") await snapshot();
else if (cmd === "diff") diff();
else die("uso: verify-vault.mjs snapshot|diff");
