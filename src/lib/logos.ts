// Company logos from Logo.dev (browser images with the publishable key). Pure (tested in logos.test.ts).
import { cleanDomain } from "@/lib/leads";
import { companyDomain } from "@/lib/product-usage";

/**
 * Image URL for a company's logo, or null when there is no usable domain. In colour (product decision), with
 * Logo.dev's dark variant on the Tinta theme; fallback=404 makes a missing logo fail so the screen shows nothing.
 */
export function logoUrl(raw: string | null | undefined, opts: { token: string | undefined; size?: number; dark?: boolean }): string | null {
  const domain = raw?.includes("@") ? companyDomain(raw) : cleanDomain(raw ?? "");
  if (!opts.token || !domain || !domain.includes(".")) return null;
  // Two fixed sizes scaled down by the browser: Logo.dev's small sizes (under ~48 px) sometimes come back as
  // the light-on-dark variant whatever the theme, which is invisible on paper. The theme is always explicit.
  const px = (opts.size ?? 20) <= 32 ? 64 : 128;
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(opts.token)}&size=${px}&format=png&fallback=404&theme=${opts.dark ? "dark" : "light"}`;
}
