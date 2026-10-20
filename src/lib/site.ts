// Public site settings: one place for the canonical domain, the pages search engines may index,
// and the measurement IDs. All values here are public (they ship in the HTML).

export const SITE_URL = "https://nokko.ai";
export const SITE_NAME = "Nokko";
export const SITE_DESCRIPTION =
  "Plataforma de go-to-market para equipos comerciales: planes de cuenta, MEDDPICC, preparación de reuniones, pipeline y una base única de personas.";

/**
 * Pages that may be indexed and go in the sitemap. Everything else that renders HTML
 * (the app behind the login, /auth, OAuth screens) is served with `X-Robots-Tag: noindex`.
 * Add each new public page here.
 */
export const PUBLIC_PATHS = ["/"] as const;

/** Date of the last content change to the public pages (sitemap <lastmod>). Update with them. */
export const PUBLIC_LASTMOD = "2026-10-21";

/** Google Tag Manager container (cosentinofede@gmail.com → cuenta «Nokko» → contenedor nokko.ai). */
export const GTM_ID = "GTM-W9NPG8P9";

/** Search Console, URL-prefix property https://nokko.ai/ (HTML tag method). */
export const GOOGLE_SITE_VERIFICATION = "x3lXNYw6qMVOXHb2MGtDFbG_-McQRXNlzp3uCK6zv34";

/**
 * Analytics stays off until the legal pages (aviso legal, privacidad, cookies) are published:
 * in Spain analytics cookies need prior consent, and the banner must link to the cookie policy.
 * Turning this on loads GTM (consent denied by default) and shows the cookie banner.
 */
export const ANALYTICS_ENABLED = false;

/** Where the cookie banner links to. Must exist before ANALYTICS_ENABLED is turned on. */
export const COOKIE_POLICY_PATH = "/cookies";

export const absoluteUrl = (path: string) => `${SITE_URL}${path === "/" ? "/" : path}`;
