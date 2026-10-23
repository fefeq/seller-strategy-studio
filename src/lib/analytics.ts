// Measurement through Google Tag Manager with Consent Mode v2 (basic): nothing reaches GA4
// until the visitor accepts analytics cookies. Only event names and a few fixed parameters are
// sent — never emails, names, companies, accounts, deals or any customer text.
import { ANALYTICS_ENABLED, GTM_ID } from "@/lib/site";
import { capture, resetIdentity, startPosthog, stopPosthog } from "@/lib/posthog";

export const CONSENT_KEY = "nokko-consent";
export type ConsentChoice = "granted" | "denied";

/** Events the GTM container listens for (trigger «CE - eventos Nokko»). Keep both lists in sync. */
export const GTM_EVENTS = ["cta_click", "sign_up_start", "sign_up", "login", "org_created"] as const;
/** Product events that go only to PostHog (sign-up funnel and feature use). */
export const PRODUCT_EVENTS = ["setup_saved", "lead_created", "deal_created", "agent_message", "artifact_drafted"] as const;
export type AnalyticsEvent = (typeof GTM_EVENTS)[number] | (typeof PRODUCT_EVENTS)[number];
export type AnalyticsParams = { method?: "email" | "google"; location?: string };

export const isGtmEvent = (e: AnalyticsEvent) => (GTM_EVENTS as readonly string[]).includes(e);

/**
 * Runs in <head> before GTM: consent denied by default, restored to granted if the visitor
 * already accepted, then the GTM loader. OAuth screens for external assistants never load GTM.
 */
export const CONSENT_BOOT = `(function(){window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"denied",functionality_storage:"granted",security_storage:"granted",wait_for_update:500});try{if(localStorage.getItem("${CONSENT_KEY}")==="granted")gtag("consent","update",{analytics_storage:"granted"})}catch(e){}if(location.pathname.indexOf("/.lovable/")===0)return;(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({"gtm.start":new Date().getTime(),event:"gtm.js"});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src="https://www.googletagmanager.com/gtm.js?id="+i;f.parentNode.insertBefore(j,f)})(window,document,"script","dataLayer","${GTM_ID}")})();`;

type DataLayerWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

/**
 * The object pushed for an event. Every parameter key is always present (undefined when unused)
 * so GTM's data model never carries a value over from a previous event.
 */
export function eventPayload(event: AnalyticsEvent, params: AnalyticsParams = {}) {
  return { event, method: params.method ?? undefined, location: params.location ?? undefined };
}

export function track(event: AnalyticsEvent, params?: AnalyticsParams) {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  // PostHog only captures after consent (it is not started otherwise).
  capture(event, { method: params?.method, location: params?.location });
  if (!isGtmEvent(event)) return;
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(eventPayload(event, params));
}

/** On page load: PostHog starts only for a visitor who already accepted analytics cookies. */
export function bootProductAnalytics() {
  if (ANALYTICS_ENABLED && readConsent() === "granted") void startPosthog();
}

/** Signing out: the next person on this browser is not counted as the previous one. */
export const forgetAnalyticsUser = () => resetIdentity();

export function readConsent(): ConsentChoice | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: ConsentChoice) {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* blocked storage: the choice lasts for this page only */
  }
  const w = window as DataLayerWindow;
  w.gtag?.("consent", "update", { analytics_storage: choice });
  // Fires the Google tag on the page where the visitor accepts (trigger «CE - consent_update»).
  if (choice === "granted") (w.dataLayer = w.dataLayer ?? []).push({ event: "consent_update" });
  if (choice === "granted") void startPosthog(); else stopPosthog();
}
