// E2: neutral conversation blocks, rendered the same way in the app and in Telegram.
// chips = short choices (a value the channel sends back), list = plain items, link = a labelled destination.
export type Chip = { label: string; value: string; selected?: boolean };
export type ConvBlock =
  | { kind: "chips"; prompt?: string; chips: Chip[] }
  | { kind: "list"; title?: string; items: string[] }
  | { kind: "link"; label: string; path: string };

const MAX_CB = 64; // Telegram callback_data limit (bytes)

/** Telegram: text + inline keyboard. Links become «label: url» lines; a selected chip is marked with «·». */
export function toTelegram(blocks: ConvBlock[], origin: string): { text: string; buttons: { text: string; data: string }[][] } {
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
