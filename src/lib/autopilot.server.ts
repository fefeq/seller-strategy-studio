// Autopilot (server-only, admin client, always filtered by company): proposes (pending, with estimated cost) the paid research of new accounts, prepares the
// meetings of the next 36 hours and reviews accounts that are cooling down. Bounded per run (AUTOPILOT_LIMITS),
// each item marked so it is done once; web research goes through the orchestrator budget (automatic work pauses
// at 100 %). Nokko only writes empty fields and suggestions: nothing is sent or overwritten.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { accountsToResearch, coolingAccounts, meetingsToPrep, weekKey } from "@/lib/autopilot";
import { safeErrorLog } from "@/lib/agent/safe-error-log";
import { autopilotSpendProposals } from "@/lib/autopilot";
import { errorText } from "@/lib/errors";

type Admin = SupabaseClient<Database>;
const DAY = 86_400_000;

export async function autopilotForOrg(db: Admin, orgId: string, now = new Date()) {
  const out = { researched: 0, prepped: 0, cooling: 0, notes: [] as string[] };
  const actor =
    (
      await db
        .from("org_members")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle()
    ).data?.user_id ?? "";
  const { data: org } = await db
    .from("organizations")
    .select("currency")
    .eq("id", orgId)
    .maybeSingle();
  const ctx = { db, orgId, userId: actor, roles: ["owner"], currency: org?.currency ?? "EUR" };
  const scope = { orgId, userId: actor };

  // 1 · New accounts: complete empty fields and research the web into the empty parts of the account plan.
  try {
    const { data: accs } = await db
      .from("accounts")
      .select("id,name,domain,created_at,auto_researched_at,owner_id")
      .eq("org_id", orgId)
      .is("auto_researched_at", null)
      .gte("created_at", new Date(now.getTime() - 14 * DAY).toISOString())
      .limit(50);
    const autoEnrich =
      (await db.from("lead_settings").select("auto_enrich").eq("org_id", orgId).maybeSingle()).data
        ?.auto_enrich !== false;
    const { spendEstimateLine, withEstimate } = await import("@/lib/agent/spend-confirm");
    for (const a of accountsToResearch(accs ?? [], now)) {
      // Marked first: one proposal per new account, never repeated every hour.
      await db
        .from("accounts")
        .update({ auto_researched_at: now.toISOString() })
        .eq("org_id", orgId)
        .eq("id", a.id);
      const acc = (accs ?? []).find((x) => x.id === a.id)!;
      // Spending is never automatic: each paid step becomes a pending action with its estimated cost,
      // run only when the person confirms it (decidePending). No permanent per-company permission.
      const proposals = autopilotSpendProposals(acc, autoEnrich);
      const owner = acc.owner_id ?? actor;
      const lines: string[] = [];
      for (const pr of proposals) {
        const line = await spendEstimateLine(db, orgId, pr.tool);
        const summary = withEstimate(`Piloto automático · ${pr.label} «${acc.name}»`, pr.tool, line);
        let error: unknown = null;
        try {
          ({ error } = await db.from("agent_pending_actions").insert({
          org_id: orgId,
          user_id: owner,
          tool: pr.tool,
          args: { account_id: a.id },
          summary: summary.slice(0, 500),
          source: "autopilot",
          }));
        } catch (e) {
          error = e;
        }
        if (error) {
          const e = error;
          console.error("autopilot proposal", safeErrorLog(e));
          // NK-0162: the visible text never carries the raw error; the proposal could not be left pending.
          if (pr.tool === "research_account") lines.push(`No pude investigar la web: ${errorText(e)}`);
        }
        else lines.push(`${pr.label}: ${line}.`);
      }
      if (!lines.length) continue;
      await db.from("suggestions").upsert(
        {
          org_id: orgId,
          detector: "account_researched",
          dedupe_key: `account_researched:${a.id}`,
          priority: 3,
          title: `Cuenta nueva ${acc.name}: investigación pendiente de tu confirmación`.slice(0, 200),
          body: `No he gastado nada. Confírmalo en Hoy → Pendientes del agente:\n${lines.join("\n")}`.slice(0, 4000),
          link: `/accounts/${a.id}`,
          user_id: acc.owner_id,
        },
        { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
      );
      out.researched++;
    }
  } catch (e) {
    out.notes.push(`Investigación: ${(e as Error).message}`);
  }

  // 2 · Meetings of the next 36 hours without call prep: prepared the day before.
  try {
    const { data: ms } = await db
      .from("meetings")
      .select("id,title,scheduled_at,ai_brief,account_id,created_by")
      .eq("org_id", orgId)
      .gt("scheduled_at", now.toISOString())
      .lte("scheduled_at", new Date(now.getTime() + 1.5 * DAY).toISOString())
      .limit(50);
    const { meetingBriefCore } = await import("@/lib/ai-core");
    for (const m of meetingsToPrep(ms ?? [], now)) {
      const meta = (ms ?? []).find((x) => x.id === m.id)!;
      try {
        await meetingBriefCore(db, m.id, { orgId, userId: meta.created_by ?? actor });
        await db
          .from("meetings")
          .update({ auto_prepped_at: now.toISOString() })
          .eq("org_id", orgId)
          .eq("id", m.id);
        // The «sin preparación» reminder is answered: close it now instead of at the next sync.
        await db
          .from("suggestions")
          .update({ status: "resolved", updated_at: now.toISOString() })
          .eq("org_id", orgId)
          .eq("dedupe_key", `meeting_no_prep:${m.id}`)
          .in("status", ["pending", "snoozed"]);
        const when = new Date(meta.scheduled_at!).toLocaleString("es-ES", {
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Madrid",
        });
        await db.from("suggestions").upsert(
          {
            org_id: orgId,
            detector: "meeting_prepped",
            dedupe_key: `meeting_prepped:${m.id}`,
            priority: 2,
            title: `Preparé tu reunión «${meta.title}»`.slice(0, 200),
            body: `Es el ${when}. La preparación de llamada ya está en la reunión: brief, stakeholders, preguntas, objeciones y próximo paso.`,
            link: meta.account_id ? `/accounts/${meta.account_id}` : null,
            user_id: meta.created_by,
          },
          { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
        );
        out.prepped++;
      } catch (e) {
        out.notes.push(`Reunión ${meta.title}: ${(e as Error).message}`);
        if (/créditos|bloqueado|cuota/i.test(e instanceof Error ? e.message : "")) break;
      }
    }
  } catch (e) {
    out.notes.push(`Reuniones: ${(e as Error).message}`);
  }

  // 3 · Accounts that matter and went quiet: one review per account and week, with a proposed next move.
  try {
    const since = new Date(now.getTime() - 180 * DAY).toISOString();
    const [accs, touches, calls, meetings, deals, sla] = await Promise.all([
      db
        .from("accounts")
        .select("id,name,is_target,tier,owner_id,created_at")
        .eq("org_id", orgId)
        .limit(2000),
      db
        .from("account_touches")
        .select("account_id,occurred_at")
        .eq("org_id", orgId)
        .gte("occurred_at", since)
        .limit(5000),
      db
        .from("calls")
        .select("account_id,occurred_at")
        .eq("org_id", orgId)
        .gte("occurred_at", since)
        .limit(5000),
      db
        .from("meetings")
        .select("account_id,scheduled_at")
        .eq("org_id", orgId)
        .gte("scheduled_at", since)
        .limit(5000),
      db
        .from("deals")
        .select("account_id,name,amount,stage,updated_at")
        .eq("org_id", orgId)
        .limit(5000),
      db.from("lead_settings").select("sla").eq("org_id", orgId).maybeSingle(),
    ]);
    const { data: st } = await db.from("deal_stages").select("key,kind").eq("org_id", orgId);
    const closed = new Set(
      (st ?? [])
        .filter((s) => s.kind !== "open")
        .map((s) => s.key)
        .concat(["won", "lost"]),
    );
    const allDeals = deals.data ?? [];
    const cold = coolingAccounts(
      {
        accounts: accs.data ?? [],
        activity: [
          ...(touches.data ?? []).map((t) => ({ account_id: t.account_id, at: t.occurred_at })),
          ...(calls.data ?? []).map((c) => ({ account_id: c.account_id, at: c.occurred_at })),
          ...(meetings.data ?? []).map((m) => ({ account_id: m.account_id, at: m.scheduled_at })),
          ...allDeals.map((d) => ({ account_id: d.account_id, at: d.updated_at })),
        ],
        openDeals: allDeals.filter((d) => !closed.has(d.stage)),
        thresholdDays:
          Number((sla.data?.sla as Record<string, unknown> | null)?.["cooling_account_days"]) ||
          null,
      },
      now,
    );
    const week = weekKey(now);
    const { data: done } = await db
      .from("suggestions")
      .select("dedupe_key")
      .eq("org_id", orgId)
      .in(
        "dedupe_key",
        cold.map((c) => `account_cooling:${c.id}:${week}`),
      );
    const doneKeys = new Set((done ?? []).map((d) => d.dedupe_key));
    const { accountContext } = await import("@/lib/ai-core");
    const { ask } = await import("@/lib/ai-gateway");
    for (const c of cold.filter((x) => !doneKeys.has(`account_cooling:${x.id}:${week}`))) {
      let review = "";
      try {
        review = await ask(
          "Eres un director comercial B2B. Repasa esta cuenta que se está enfriando y responde en español neutro (tú), sin signos de exclamación ni emoji, en 3 líneas cortas: «Dónde estábamos:» (lo último que pasó), «Riesgo:» (qué se pierde si no se actúa) y «Siguiente paso:» (una acción concreta con quién y qué decir, usando señales o casos del contexto si los hay). Usa solo los datos dados.",
          `Días sin actividad: ${c.idleDays}\nDeals abiertos: ${c.openDeals.map((d) => d.name).join(", ") || "ninguno"}\n\n${(await accountContext(db, c.id, scope)).slice(0, 18_000)}`,
          { effort: "low" },
        );
      } catch (e) {
        console.error("autopilot cooling review", safeErrorLog(e));
      }
      await db.from("suggestions").upsert(
        {
          org_id: orgId,
          detector: "account_cooling",
          dedupe_key: `account_cooling:${c.id}:${week}`,
          priority: c.openDeals.length ? 1 : 2,
          title: `${c.name} se está enfriando: ${c.idleDays} días sin actividad`.slice(0, 200),
          body: (
            review.trim() ||
            `Nadie ha tocado la cuenta en ${c.idleDays} días${c.openDeals.length ? ` y tiene ${c.openDeals.length} deal abierto` : ""}. Te propongo una tarea para retomar el contacto.`
          ).slice(0, 2000),
          link: `/accounts/${c.id}`,
          user_id: c.owner_id,
          action: {
            tool: "create_task",
            args: {
              title: `Retomar contacto: ${c.name}`,
              account_id: c.id,
              due_date: new Date(now.getTime() + 2 * DAY).toISOString().slice(0, 10),
              owner_id: c.owner_id,
            },
          } as never,
        },
        { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
      );
      out.cooling++;
    }
  } catch (e) {
    out.notes.push(`Cuentas que se enfrían: ${(e as Error).message}`);
  }

  if (out.notes.length) console.warn("autopilot notes", orgId, { count: out.notes.length });
  return out;
}
