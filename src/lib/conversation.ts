// E2: neutral conversation blocks, rendered the same way in the app and in Telegram.
// chips = short choices (a value the channel sends back), list = plain items, link = a labelled destination.
export type Chip = { label: string; value: string; selected?: boolean };
export type ConvBlock =
  | { kind: "chips"; prompt?: string; chips: Chip[] }
  | { kind: "list"; title?: string; items: string[] }
  | { kind: "link"; label: string; path: string };

const MAX_CB = 64; // Telegram callback_data limit (bytes)

/** Telegram: text + inline keyboard. Links become «label: url» lines; a selected chip is marked with «·». */
export function toTelegram(
  blocks: ConvBlock[],
  origin: string,
): { text: string; buttons: { text: string; data: string }[][] } {
  const lines: string[] = [];
  const buttons: { text: string; data: string }[][] = [];
  for (const b of blocks) {
    if (b.kind === "list") {
      if (b.title) lines.push(b.title);
      for (const i of b.items) lines.push(`- ${i}`);
    } else if (b.kind === "link") {
      lines.push(`${b.label}: ${new URL(b.path, origin).href}`);
    } else {
      if (b.prompt) lines.push(b.prompt);
      const row = b.chips
        .filter((c) => new TextEncoder().encode(c.value).length <= MAX_CB)
        .map((c) => ({ text: c.selected ? `· ${c.label}` : c.label, data: c.value }));
      // Two per row keeps buttons readable on a phone.
      for (let i = 0; i < row.length; i += 2) buttons.push(row.slice(i, i + 2));
    }
  }
  return { text: lines.join("\n"), buttons };
}

const STEP_RE =
  /^\s*[-*]?\s*(?:\*\*)?(?:siguiente|próximo) paso(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.+?)\s*$/i;
const LINK_RE = /\[([^\]]{1,60})\]\((\/[A-Za-z0-9/_\-?=&%.#]*)\)/g;
const cut = (t: string, bytes: number) => {
  let o = t;
  while (new TextEncoder().encode(o).length > bytes) o = o.slice(0, -1);
  return o;
};

/**
 * E2: the blocks of an agent reply, the same for app and Telegram.
 * - pending actions → «Confirmar» / «Descartar» chips (a:<id>:c|x, the callback Telegram already handles);
 * - «Siguiente paso: …» lines → chips that send that text back (q:<text>, cut to Telegram's 64 bytes);
 * - markdown links to app paths → «abrir pantalla» link blocks (deduped, max 4).
 */
export function replyBlocks(
  text: string,
  pending: { id: string; summary: string }[] = [],
): ConvBlock[] {
  const out: ConvBlock[] = [];
  for (const p of pending)
    out.push({
      kind: "chips",
      prompt: `¿Confirmas? ${p.summary}`,
      chips: [
        { label: "Confirmar", value: `a:${p.id}:c` },
        { label: "Descartar", value: `a:${p.id}:x` },
      ],
    });
  const steps = [
    ...new Set(
      text
        .split("\n")
        .map((l) =>
          STEP_RE.exec(l)?.[1]
            ?.replace(/\*\*/g, "")
            .replace(/[.\s]+$/, ""),
        )
        .filter((x): x is string => !!x),
    ),
  ].slice(0, 3);
  if (steps.length)
    out.push({
      kind: "chips",
      prompt: "Siguiente paso",
      chips: steps.map((st) => ({
        label: st.length > 48 ? `${st.slice(0, 47)}…` : st,
        value: cut(`q:${st}`, MAX_CB),
      })),
    });
  const seen = new Set<string>();
  for (const m of text.matchAll(LINK_RE)) {
    if (seen.has(m[2]) || seen.size >= 4) continue;
    seen.add(m[2]);
    out.push({ kind: "link", label: `Abrir ${m[1]}`, path: m[2] });
  }
  return out;
}

/** What a chip value asks for: confirm/cancel a pending action, or send a follow-up message. */
export function chipIntent(
  value: string,
):
  | { kind: "action"; id: string; decision: "confirm" | "cancel" }
  | { kind: "say"; text: string }
  | null {
  const a = /^a:([0-9a-f-]{36}):(c|x)$/i.exec(value);
  if (a) return { kind: "action", id: a[1], decision: a[2] === "c" ? "confirm" : "cancel" };
  if (value.startsWith("q:") && value.length > 2) return { kind: "say", text: value.slice(2) };
  return null;
}
