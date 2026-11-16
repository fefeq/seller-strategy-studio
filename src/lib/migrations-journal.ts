// Rules of the migrations journal (drizzle/migrations/meta/_journal.json), pure and tested in migrations-journal.test.ts.
// The journal is append-only: entries go at the end, `idx` is the position and `when` strictly grows along it. The number in a
// file name is a name, not an order of application: an environment that already applied a migration with a later `when` would
// skip a new one stamped below it without any warning. Rules that need git (new entries above main's maximum, nothing edited
// that main already has) live in check-migration-journal.mjs, which each branch runs before merging.
export type JournalEntry = { idx: number; when: number; tag: string };

/** What is wrong with the journal, in words; empty when it follows the rules. `files` are the .sql names without the extension. */
export function journalProblems(entries: JournalEntry[], files: string[]): string[] {
  const out: string[] = [];
  const byNumber = new Map<string, string[]>();
  for (const f of files) byNumber.set(f.slice(0, 4), [...(byNumber.get(f.slice(0, 4)) ?? []), f]);
  for (const [n, fs] of byNumber)
    if (fs.length > 1) out.push(`number ${n} is used by ${fs.join(", ")}`);

  const tags = new Set(entries.map((e) => e.tag));
  for (const f of files) if (!tags.has(f)) out.push(`${f}.sql has no journal entry`);
  for (const t of tags) if (!files.includes(t)) out.push(`journal entry ${t} has no .sql file`);

  entries.forEach((e, i) => {
    if (e.idx !== i) out.push(`${e.tag}: idx is ${e.idx}, expected ${i} (its position)`);
    if (i > 0 && e.when <= entries[i - 1].when)
      out.push(
        `${e.tag}: when ${e.when} does not exceed ${entries[i - 1].tag} (${entries[i - 1].when})`,
      );
  });
  return out;
}
