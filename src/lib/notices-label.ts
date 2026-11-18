// SDD-20261118-ux-legibilidad-pantallas-diarias · U-6 · CA-10: the «Avisos» label of the top bar. Below sm only the
// short label shows and its number is capped at «9+» (as the bottom bar badge does) so the bar has a bounded width; the
// long label (from sm up) and the aria-label keep the real number. Pure and tested (notices-label.test.ts).
const cap = (n: number) => (n > 9 ? "9+" : String(n));

export function noticeLabels(unread: number, running: number): { short: string; label: string } {
  if (running) return { short: `Avisos · ${cap(running)}`, label: `Avisos · ${running} en marcha` };
  if (unread) return { short: `Avisos · ${cap(unread)}`, label: `Avisos · ${unread}` };
  return { short: "Avisos", label: "Avisos" };
}
