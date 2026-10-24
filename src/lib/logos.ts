// Company logos from Logo.dev (browser images with the publishable key). Pure (tested in logos.test.ts).
import { cleanDomain } from "@/lib/leads";
import { companyDomain } from "@/lib/product-usage";

/**
 * Image URL for a company's logo, or null when there is no usable domain. Greyscale keeps the editorial
 * palette (paper, ink, one red); fallback=404 makes a missing logo fail so the screen shows nothing.
 */
export function logoUrl(raw: string | null | undefined, opts: { token: string | undefined; size?: number; dark?: boolean }): string | null {
  const domain = raw?.includes("@") ? companyDomain(raw) : cleanDomain(raw ?? "");
  if (!opts.token || !domain || !domain.includes(".")) return null;
  const px = Math.min(256, Math.max(16, Math.round((opts.size ?? 20) * 2)));
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(opts.token)}&size=${px}&format=png&greyscale=true&fallback=404${opts.dark ? "&theme=dark" : ""}`;
}
