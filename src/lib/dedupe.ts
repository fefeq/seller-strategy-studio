export type PersonInput = {
  full_name?: string;
  email?: string | null;
  linkedin_url?: string | null;
  company?: string | null;
  title?: string | null;
  source?: string | null;
};

export function normEmail(e?: string | null) {
  const v = (e ?? "").trim().toLowerCase();
  return v || null;
}

export function normLinkedin(u?: string | null) {
  const v = (u ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/+$/, "");
  return v || null;
}

/** Splits incoming rows into new vs duplicates (against existing rows and within the batch). A match on email OR LinkedIn counts. */
export function dedupePeople(
  incoming: PersonInput[],
  existing: Pick<PersonInput, "email" | "linkedin_url">[],
) {
  const emails = new Set<string>();
  const links = new Set<string>();
  for (const p of existing) {
    const e = normEmail(p.email);
    const l = normLinkedin(p.linkedin_url);
    if (e) emails.add(e);
    if (l) links.add(l);
  }
  const fresh: PersonInput[] = [];
  let skipped = 0;
  for (const p of incoming) {
    const e = normEmail(p.email);
    const l = normLinkedin(p.linkedin_url);
    if (!e && !l) {
      skipped++;
      continue;
    }
    if ((e && emails.has(e)) || (l && links.has(l))) {
      skipped++;
      continue;
    }
    if (e) emails.add(e);
    if (l) links.add(l);
    fresh.push({ ...p, email: e, linkedin_url: p.linkedin_url?.trim() || null });
  }
  return { fresh, skipped };
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const split = (l: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') {
        if (q && l[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = !q;
      } else if (c === "," && !q) {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const head = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((l) => {
    const cells = split(l);
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""]));
  });
}
