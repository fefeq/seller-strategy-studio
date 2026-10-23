// PostHog product analytics (browser only). Starts only after the visitor accepts analytics cookies
// (src/lib/analytics.ts) and stops when they reject. Privacy rules, same as GTM: people are identified
// by their user id only (never email or name), events carry fixed parameters only, and autocapture and
// session recordings mask every text and input, so no customer data (accounts, deals, notes) leaves.
import type { PostHog } from "posthog-js";

const HOSTS = { eu: "https://eu.i.posthog.com", us: "https://us.i.posthog.com" } as const;

/** Project token and ingest host from the connector's public variables; null when PostHog is not connected. */
export function posthogConfig(env: { key?: string; region?: string }): { key: string; host: string } | null {
  const key = env.key?.trim();
  if (!key || !key.startsWith("phc_")) return null;
  return { key, host: env.region === "us" ? HOSTS.us : HOSTS.eu };
}

/** Screens where nothing is measured: the OAuth consent page for external assistants. */
export const isUnmeasuredPath = (path: string) => path.startsWith("/.lovable/");

let ph: PostHog | null = null;
let starting: Promise<PostHog | null> | null = null;
let identity: { id: string; props: Record<string, string | null> } | null = null;

function applyIdentity() {
  if (!ph || !identity) return;
  ph.identify(identity.id, identity.props);
  ph.register({ org_id: identity.props.org_id ?? null, role: identity.props.role ?? null });
}

export function startPosthog(): Promise<PostHog | null> {
  if (typeof window === "undefined" || isUnmeasuredPath(window.location.pathname)) return Promise.resolve(null);
  if (ph) { ph.opt_in_capturing(); ph.startSessionRecording(); return Promise.resolve(ph); }
  const cfg = posthogConfig({ key: import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY"], region: import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_REGION"] });
  if (!cfg) return Promise.resolve(null);
  starting ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(cfg.key, {
      api_host: cfg.host,
      person_profiles: "identified_only",
      capture_pageview: "history_change",
      capture_pageleave: true,
      autocapture: true,
      mask_all_text: true,
      mask_all_element_attributes: true,
      persistence: "localStorage+cookie",
      session_recording: { maskAllInputs: true, maskTextSelector: "*" },
    });
    ph = posthog;
    applyIdentity();
    return posthog;
  }).catch((e) => { console.error("PostHog failed to load", e); starting = null; return null; });
  return starting;
}

export function stopPosthog() {
  if (!ph) return;
  ph.stopSessionRecording();
  ph.opt_out_capturing();
}

export function capture(event: string, props?: Record<string, string | undefined>) {
  ph?.capture(event, props);
}

/** Who is using the app: user id, company id and role only. Applied now or as soon as PostHog starts. */
export function setIdentity(id: string, props: { org_id: string | null; role: string | null }) {
  if (identity?.id === id && identity.props.org_id === props.org_id && identity.props.role === props.role) return;
  identity = { id, props };
  applyIdentity();
}

export function resetIdentity() {
  identity = null;
  ph?.reset();
}
