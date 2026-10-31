#!/usr/bin/env node
// CA-5, CA-6, CA-7, CA-27 of the Lovable-exit SDD A.
//   snapshot --env <VAR> --out <file> [--schemas public,auth,vault,drizzle] [--cipher schema.table.col,...]
//       Reads the database in ONE read-only repeatable-read transaction and writes counts, md5 per table, md5 per encrypted column and the catalog.
//   diff <source.json> <target.json>      Offline. Exit 1 (FALLO) on any difference.
//   files manifest --out <file> <files...> / files verify <manifest>   Hashes of the encrypted dump copies (needs no key).
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { connect, die, parseArgs, readJson, scrub, sha256, writeJson } from "./lib.mjs";

const [cmd, ...argv] = process.argv.slice(2);
const { flags, rest } = parseArgs(argv);

const q = (s) => `"${String(s).replaceAll('"', '""')}"`;

async function snapshot() {
  const envName = flags.env ?? "NOKKO_SOURCE_DB_URL";
  const out = flags.out ?? die("falta --out <archivo>");
  const schemas = (flags.schemas ?? "public,auth,vault,drizzle").split(",");
  const cipher = (flags.cipher ?? "").split(",").filter(Boolean);
  const sql = await connect(envName);
  const tables = {};
  const cipherColumns = {};
  const catalog = {};
  try {
    await sql.begin("isolation level repeatable read read only", async (tx) => {
      const list = await tx`select table_schema as s, table_name as t from information_schema.tables
        where table_type = 'BASE TABLE' and table_schema = any(${schemas}) order by 1, 2`;
      for (const { s, t } of list) {
        const key = `${s}.${t}`;
        try {
          const pk = await tx`select a.attname as c from pg_index i
            join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
            where i.indisprimary and i.indrelid = ${`${q(s)}.${q(t)}`}::regclass order by array_position(i.indkey, a.attnum)`;
          const order = pk.length ? pk.map((r) => `r.${q(r.c)}`).join(", ") : "r::text";
          const [row] = await tx.unsafe(
            `select count(*)::int as n, coalesce(md5(string_agg(r::text, E'\\n' order by ${order})), '') as h from ${q(s)}.${q(t)} r`,
          );
          tables[key] = { rows: row.n, md5: row.h };
        } catch (e) {
          tables[key] = { error: scrub(e?.message ?? e) };
        }
      }
      for (const spec of cipher) {
        const [s, t, c] = spec.split(".");
        try {
          const [row] = await tx.unsafe(
            `select count(${q(c)})::int as n, coalesce(md5(string_agg(${q(c)}::text, E'\\n' order by ${q(c)}::text)), '') as h from ${q(s)}.${q(t)}`,
          );
          cipherColumns[spec] = { rows: row.n, md5: row.h };
        } catch (e) {
          cipherColumns[spec] = { error: scrub(e?.message ?? e) };
        }
      }
      const one = async (query) => (await query).map((r) => r.v);
      catalog.triggers =
        await one(tx`select distinct event_object_schema || '.' || event_object_table || '.' || trigger_name as v
        from information_schema.triggers where event_object_schema = any(${schemas}) order by 1`);
      catalog.policies =
        await one(tx`select schemaname || '.' || tablename || '.' || policyname || ':' ||
        md5(cmd || coalesce(qual, '') || coalesce(with_check, '') || array_to_string(roles, ',')) as v
        from pg_policies where schemaname = any(${schemas}) order by 1`);
      catalog.grants =
        await one(tx`select distinct table_schema || '.' || table_name || '.' || grantee || '.' || privilege_type as v
        from information_schema.role_table_grants where table_schema = any(${schemas})
        and grantee in ('anon', 'authenticated', 'service_role') order by 1`);
      catalog.publications = await one(
        tx`select pubname || '.' || schemaname || '.' || tablename as v from pg_publication_tables order by 1`,
      );
      catalog.extensions = await one(tx`select extname as v from pg_extension order by 1`);
      const [hasCron] = await tx`select to_regclass('cron.job') is not null as ok`;
      catalog.cron_jobs = hasCron.ok ? (await tx`select count(*)::int as n from cron.job`)[0].n : 0;
      catalog.db_webhooks = (
        await tx`select count(*)::int as n from pg_trigger t join pg_proc p on p.oid = t.tgfoid
        where not t.tgisinternal and p.proname = 'http_request'`
      )[0].n;
    });
  } catch (e) {
    return die(`no se pudo leer la base (${envName}): ${scrub(e?.message ?? e)}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
  writeJson(out, {
    version: 1,
    kind: "snapshot",
    taken_at: new Date().toISOString(),
    tables,
    cipher_columns: cipherColumns,
    catalog,
  });
  console.log(
    `OK: ${Object.keys(tables).length} tablas, ${cipher.length} columnas cifradas -> ${out}`,
  );
}

function diff() {
  const [aPath, bPath] = rest;
  if (!aPath || !bPath) die("uso: diff <origen.json> <destino.json>");
  const a = readJson(aPath);
  const b = readJson(bPath);
  const problems = [];

  for (const [name, src] of Object.entries(a.tables ?? {})) {
    const dst = b.tables?.[name];
    if (!dst) problems.push(`tabla ausente en destino: ${name}`);
    else if (src.error || dst.error)
      problems.push(`tabla ilegible: ${name} (${src.error ? "origen" : "destino"})`);
    else if (src.rows !== dst.rows)
      problems.push(`recuento distinto en ${name}: origen ${src.rows}, destino ${dst.rows}`);
    else if (src.md5 !== dst.md5)
      problems.push(`contenido distinto en ${name} (mismo recuento, hash distinto)`);
  }
  for (const [name, src] of Object.entries(a.cipher_columns ?? {})) {
    const dst = b.cipher_columns?.[name];
    if (!dst || src.error || dst.error) problems.push(`columna cifrada no comparable: ${name}`);
    else if (src.rows !== dst.rows || src.md5 !== dst.md5)
      problems.push(`columna cifrada alterada: ${name}`);
  }
  for (const kind of ["triggers", "policies", "grants", "publications", "extensions"]) {
    const have = new Set(b.catalog?.[kind] ?? []);
    for (const item of a.catalog?.[kind] ?? [])
      if (!have.has(item)) problems.push(`falta en destino (${kind}): ${item}`);
  }

  if (problems.length) {
    console.error(`FALLO: ${problems.length} diferencia(s)`);
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }
  const extra = Object.keys(b.tables ?? {}).filter((t) => !(t in (a.tables ?? {})));
  console.log(
    `OK: ${Object.keys(a.tables ?? {}).length} tablas, columnas cifradas y catálogo coinciden${extra.length ? `; el destino tiene ${extra.length} tabla(s) más (no cuenta)` : ""}`,
  );
}

function files() {
  const [sub, ...args] = rest;
  if (sub === "manifest") {
    const out = flags.out ?? die("falta --out <archivo>");
    if (!args.length) die("uso: files manifest --out <archivo> <archivos...>");
    const entries = {};
    for (const f of args) {
      try {
        entries[basename(f)] = { path: f, sha256: sha256(readFileSync(f)) };
      } catch {
        die(`no se pudo leer ${f}`);
      }
    }
    writeJson(out, { version: 1, kind: "files", files: entries });
    console.log(`OK: ${args.length} archivo(s) registrados -> ${out}`);
    return;
  }
  if (sub === "verify") {
    const m = readJson(args[0] ?? die("uso: files verify <manifiesto>"));
    const bad = [];
    for (const [name, e] of Object.entries(m.files ?? {})) {
      try {
        if (sha256(readFileSync(e.path)) !== e.sha256) bad.push(`${name}: el hash cambió`);
      } catch {
        bad.push(`${name}: no se puede leer`);
      }
    }
    if (bad.length) {
      console.error(`FALLO: ${bad.length} copia(s) con problemas`);
      for (const b of bad) console.error(`- ${b}`);
      process.exit(1);
    }
    console.log(`OK: ${Object.keys(m.files ?? {}).length} copia(s) intactas`);
    return;
  }
  die("uso: files manifest|verify");
}

if (cmd === "snapshot") await snapshot();
else if (cmd === "diff") diff();
else if (cmd === "files") files();
else die("uso: verify-data.mjs snapshot|diff|files");
