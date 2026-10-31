// Shared helpers for the Lovable-exit migration scripts. Reports hold counts, hashes and object names only, never rows or secret values.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export function die(msg) {
  console.error(`FALLO: ${msg}`);
  process.exit(1);
}

export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return die(`no se pudo leer ${path}: ${scrub(String(e?.message ?? e))}`);
  }
}

export function writeJson(path, body) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`);
}

/** Drop anything that looks like a connection string before it reaches the terminal. */
export function scrub(text) {
  return String(text).replace(/postgres(ql)?:\/\/\S+/gi, "<url>");
}

/** `--flag value` pairs plus positional args. */
export function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[++i];
    else rest.push(argv[i]);
  }
  return { flags, rest };
}

/** Connect with the URL held in an environment variable; the URL is never printed. */
export async function connect(envName) {
  const url = process.env[envName];
  if (!url)
    die(
      `falta la variable ${envName} con la URL de la base (la carga Fede en su terminal; el agente no la ve)`,
    );
  const { default: postgres } = await import("postgres");
  return postgres(url, {
    max: 1,
    onnotice: () => {},
    connection: { application_name: "nokko-migration" },
  });
}
