import { DAY, type Detector } from "../types";

/** Approved partner registration expiring within 14 days. */
export const registrationExpiring: Detector = (s) =>
  s.registrations
    .filter((r) => r.status === "approved" && r.expires_at)
    .filter((r) => {
      const t = new Date(r.expires_at!).getTime() - s.now.getTime();
      return t >= 0 && t <= 14 * DAY;
    })
    .map((r) => ({
      detector: "registration_expiring",
      dedupe_key: `registration_expiring:${r.id}`,
      priority: 2,
      title: `El registro de partner de ${r.account_name} caduca el ${r.expires_at!.slice(0, 10)}`,
      body: "Decide si renovarlo o liberarlo antes de que expire (90 días).",
      link: "/abm",
      action: null,
      user_id: null,
    }));
