// Apollo posts revealed phones here a few minutes after a reveal. The URL carries a long secret
// (APOLLO_WEBHOOK_SECRET); without it nothing is read or written. Deliveries fill phone_reveals for
// every company that asked for that person, and the stakeholder's phone.
import { createFileRoute } from "@tanstack/react-router";
import { safeErrorLog } from "@/lib/agent/safe-error-log";
import { phonesFromWebhook, sameSecret } from "@/lib/apollo";

export const Route = createFileRoute("/api/public/apollo/phone-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = new URL(request.url).searchParams.get("secret");
        if (!sameSecret(secret, process.env["APOLLO_WEBHOOK_SECRET"]))
          return new Response("Unauthorized", { status: 401 });
        const raw = await request.text();
        if (raw.length > 1_000_000) return new Response("Payload too large", { status: 413 });
        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const people = phonesFromWebhook(payload);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let updated = 0;
        for (const p of people) {
          const { data: rows, error } = await supabaseAdmin
            .from("phone_reveals")
            .update({
              status: p.phones.length ? "delivered" : "not_found",
              phones: p.phones,
              received_at: new Date().toISOString(),
            })
            .eq("apollo_person_id", p.id)
            .select("org_id,stakeholder_id");
          if (error) {
            console.error("Apollo webhook update failed", safeErrorLog(error));
            continue;
          }
          updated += rows?.length ?? 0;
          const best = p.phones[0]?.number;
          if (!best) continue;
          for (const r of rows ?? []) {
            if (!r.stakeholder_id) continue;
            const { error: e2 } = await supabaseAdmin
              .from("stakeholders")
              .update({ phone: best })
              .eq("org_id", r.org_id)
              .eq("id", r.stakeholder_id);
            if (e2) console.error("Apollo webhook stakeholder update failed", safeErrorLog(e2));
          }
        }
        return Response.json({ ok: true, people: people.length, updated });
      },
    },
  },
});
