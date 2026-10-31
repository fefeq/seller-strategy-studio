#!/usr/bin/env node
// Single-writer ledger for the NOKKO software factory.
// States: LOGGED -> PROMOTED -> SHIPPED -> VERIFIED. Logging never assigns an owner; only `promote` (human GO) does.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { FACTORY_DIR } from "./paths.mjs";

const FILE = process.env.FACTORY_LEDGER
  ? resolve(process.env.FACTORY_LEDGER)
  : resolve(FACTORY_DIR, "ledger.json");
const EVIDENCE = resolve(FACTORY_DIR, "evidence");
const STATES = ["LOGGED", "PROMOTED", "SHIPPED", "VERIFIED"];
const KINDS = ["bug", "feature", "alert"];
// Estado values of a PRD/SDD that Fede has approved (see docs/factory/templates).
const APPROVED = ["Aprobado", "En curso", "Hecho"];

function load() {
  if (!existsSync(FILE)) return { version: 1, seq: 0, tickets: [] };
  return JSON.parse(readFileSync(FILE, "utf8"));
}
function save(db) {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(db, null, 2) + "\n");
}
function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}
function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    // --approved-by and --approved_by are the same flag
    if (argv[i].startsWith("--")) out[argv[i].slice(2).replaceAll("-", "_")] = argv[++i];
    else out._.push(argv[i]);
  }
  return out;
}
const tokens = (s) =>
  new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
function similarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const t of A) if (B.has(t)) common++;
  return common / (A.size + B.size - common);
}
const now = () => new Date().toISOString();
function find(db, id) {
  const t = db.tickets.find((x) => x.id === id);
  if (!t) fail(`ticket ${id} not found`);
  return t;
}
function move(t, state, by, note) {
  t.state = state;
  t.history.push({ state, at: now(), by, note: note ?? "" });
}

const [cmd, ...rest] = process.argv.slice(2);
const a = args(rest);
const db = load();

switch (cmd) {
  case "log": {
    const title = a._.join(" ").trim();
    if (!title)
      fail('usage: log "<title>" --kind bug|feature|alert [--source <where>] [--by <name>]');
    const kind = a.kind ?? "bug";
    if (!KINDS.includes(kind)) fail(`kind must be one of ${KINDS.join(", ")}`);
    for (const [k, v] of [
      ["sdd", a.sdd],
      ["prd", a.prd],
    ]) {
      if (v && !existsSync(resolve(FACTORY_DIR, "..", v)))
        fail(`${k} file not found in the main checkout: ${v}`);
    }
    const dup = db.tickets
      .filter((t) => !t.duplicate_of)
      .map((t) => ({ t, s: similarity(t.title, title) }))
      .sort((x, y) => y.s - x.s)[0];
    db.seq += 1;
    const id = `NK-${String(db.seq).padStart(4, "0")}`;
    const ticket = {
      id,
      title,
      kind,
      source: a.source ?? "",
      state: "LOGGED",
      owner: null,
      duplicate_of: dup && dup.s >= 0.6 ? dup.t.id : null,
      sdd: a.sdd ?? null,
      prd: a.prd ?? null,
      branch: null,
      base_commit: null,
      history: [{ state: "LOGGED", at: now(), by: a.by ?? "tracker", note: "" }],
    };
    db.tickets.push(ticket);
    save(db);
    console.log(
      ticket.duplicate_of
        ? `${id} logged as DUPLICATE of ${ticket.duplicate_of} (similarity ${dup.s.toFixed(2)}); no owner, link it instead of dispatching`
        : `${id} logged (no owner until GO)`,
    );
    break;
  }
  case "promote": {
    const t = find(db, a._[0]);
    if (!a.go) fail("promote needs --go <human name>: only a human GO assigns work");
    if (!a.owner) fail("promote needs --owner <session or person>");
    if (t.duplicate_of) fail(`${t.id} is a duplicate of ${t.duplicate_of}; promote the original`);
    if (t.state !== "LOGGED") fail(`${t.id} is ${t.state}, expected LOGGED`);
    if (t.kind === "feature" && !t.sdd)
      fail(
        `${t.id} is a feature and needs an approved SDD: run nokko-shape, then \`doc ${t.id} --sdd <path>\``,
      );
    for (const [k, v] of [
      ["SDD", t.sdd],
      ["PRD", t.prd],
    ]) {
      if (!v) continue;
      const file = resolve(FACTORY_DIR, "..", v);
      if (!existsSync(file)) fail(`${k} file not found in the main checkout: ${v}`);
      const estado = /^\*\*Estado:\*\*\s*([^\s·(]+(?: curso)?)/m.exec(
        readFileSync(file, "utf8"),
      )?.[1];
      if (!APPROVED.includes(estado ?? ""))
        fail(`${k} ${v} is "${estado ?? "no Estado"}", needs Aprobado before promote`);
    }
    t.owner = a.owner;
    t.branch = a.branch ?? null;
    t.base_commit = a.base ?? null;
    move(t, "PROMOTED", a.go, `owner=${a.owner}`);
    save(db);
    console.log(`${t.id} PROMOTED, owner ${t.owner}`);
    break;
  }
  case "ship": {
    const t = find(db, a._[0]);
    if (t.state !== "PROMOTED") fail(`${t.id} is ${t.state}, expected PROMOTED`);
    if (!a.sha) fail("ship needs --sha <commit the gate passed>");
    const gateFile = resolve(EVIDENCE, t.id, `gate-${a.sha.slice(0, 12)}.json`);
    if (!existsSync(gateFile))
      fail(`no gate evidence at ${gateFile}; run scripts/factory/gate.mjs first`);
    const gate = JSON.parse(readFileSync(gateFile, "utf8"));
    if (gate.verdict !== "PASS") fail(`gate verdict for ${a.sha} is ${gate.verdict}, not PASS`);
    if (!a.approved_by) fail("ship needs --approved-by <human>: only a human approves the ship");
    move(t, "SHIPPED", a.approved_by, `sha=${a.sha}`);
    save(db);
    console.log(`${t.id} SHIPPED at ${a.sha} (approved by ${a.approved_by})`);
    break;
  }
  case "verify": {
    const t = find(db, a._[0]);
    if (t.state !== "SHIPPED") fail(`${t.id} is ${t.state}, expected SHIPPED`);
    if (!a.note) fail("verify needs --note <what you measured in production, read-only>");
    move(t, "VERIFIED", a.by ?? "watch", a.note);
    save(db);
    console.log(`${t.id} VERIFIED`);
    break;
  }
  case "doc": {
    const t = find(db, a._[0]);
    if (!a.sdd && !a.prd) fail("usage: doc NK-xxxx [--sdd <path>] [--prd <path>]");
    for (const [k, v] of [
      ["sdd", a.sdd],
      ["prd", a.prd],
    ]) {
      if (!v) continue;
      if (!existsSync(resolve(FACTORY_DIR, "..", v)))
        fail(`${k} file not found in the main checkout: ${v} (commit or copy it there first)`);
      t[k] = v;
    }
    t.history.push({
      state: t.state,
      at: now(),
      by: a.by ?? "tracker",
      note: `docs: sdd=${t.sdd ?? "-"} prd=${t.prd ?? "-"}`,
    });
    save(db);
    console.log(`${t.id} docs linked (sdd ${t.sdd ?? "-"}, prd ${t.prd ?? "-"})`);
    break;
  }
  case "link": {
    const t = find(db, a._[0]);
    const to = find(db, a._[1]);
    t.duplicate_of = to.id;
    t.history.push({
      state: t.state,
      at: now(),
      by: a.by ?? "tracker",
      note: `linked to ${to.id}`,
    });
    save(db);
    console.log(`${t.id} linked to ${to.id}`);
    break;
  }
  case "show": {
    console.log(JSON.stringify(find(db, a._[0]), null, 2));
    break;
  }
  case "list": {
    const state = a.state;
    if (state && !STATES.includes(state)) fail(`state must be one of ${STATES.join(", ")}`);
    for (const t of db.tickets.filter((x) => !state || x.state === state)) {
      console.log(
        `${t.id}\t${t.state}\t${t.kind}\t${t.owner ?? "-"}\t${t.duplicate_of ? `dup:${t.duplicate_of}` : ""}\t${t.title}`,
      );
    }
    break;
  }
  default:
    console.error("usage: ledger.mjs log|promote|ship|verify|doc|link|show|list ...");
    process.exit(2);
}
