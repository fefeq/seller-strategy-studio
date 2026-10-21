import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { readConsent, saveConsent, type ConsentChoice } from "@/lib/analytics";
import { ANALYTICS_ENABLED, COOKIE_POLICY_PATH } from "@/lib/site";

const REOPEN = "nokko:cookie-settings";

/** Lets a «Cookies» link anywhere reopen the banner to change the choice. */
export function openCookieSettings() {
  window.dispatchEvent(new Event(REOPEN));
}

/**
 * Asks once for analytics cookies; accept and reject carry the same weight.
 * Renders nothing while analytics is off (see ANALYTICS_ENABLED).
 */
export function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ANALYTICS_ENABLED) return;
    if (readConsent() === null) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener(REOPEN, reopen);
    return () => window.removeEventListener(REOPEN, reopen);
  }, []);

  if (!open) return null;

  const choose = (choice: ConsentChoice) => {
    saveConsent(choice);
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-banner-title"
      className="fixed inset-x-0 bottom-0 z-[60] border-t-2 border-hairline-firm bg-paper-edge px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="measure-body">
          <p id="cookie-banner-title" className="font-medium">
            Cookies de analítica
          </p>
          <p className="mt-1 text-sm text-ink-mid">
            Las usamos para saber qué páginas sirven y mejorar Nokko. No se activan hasta que
            aceptes.{" "}
            <a href={COOKIE_POLICY_PATH} className="text-signal underline underline-offset-4">
              Política de cookies
            </a>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => choose("denied")}>
            Rechazar
          </Button>
          <Button variant="outline" onClick={() => choose("granted")}>
            Aceptar
          </Button>
        </div>
      </div>
    </div>
  );
}
