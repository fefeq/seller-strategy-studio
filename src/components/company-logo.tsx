// A company's logo next to its name (Logo.dev). Decorative: the name is always written beside it, so the
// image has empty alt text, and a company without a logo simply shows none (no placeholder).
import { useState, useSyncExternalStore } from "react";
import { logoUrl } from "@/lib/logos";

const TOKEN = import.meta.env["VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY"] as string | undefined;

// One observer for every logo on the page: follows the light/dark switch on <html>.
const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!observer && typeof MutationObserver !== "undefined") {
    observer = new MutationObserver(() => listeners.forEach((l) => l()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size) {
      observer?.disconnect();
      observer = null;
    }
  };
}
const isDark = () => document.documentElement.classList.contains("dark");
const useDark = () => useSyncExternalStore(subscribe, isDark, () => false);

export function CompanyLogo({
  domain,
  size = 20,
  className = "",
}: {
  domain: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const dark = useDark();
  const src = logoUrl(domain, { token: TOKEN, size, dark });
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return null;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(src)}
      className={`inline-block shrink-0 object-contain align-middle ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
