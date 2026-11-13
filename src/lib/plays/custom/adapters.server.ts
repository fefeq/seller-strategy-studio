import { z } from "zod";
import type { Db } from "@/lib/org-data";
import type { Json, Tables } from "@/integrations/supabase/types";
import { executeCustomPlay, type ExecutionInput, type ExecutionPorts } from "./execution";
import type { Proposal } from "./propose";
import { jsonObject } from "@/lib/json";
import { fetchAll } from "@/lib/fetch-all";
import { accountsForCompetitor, splitCompetitors } from "./library";
import { effectiveEmailStatus } from "@/lib/email-verification";
import { loadEmailVerifications } from "@/lib/email-verification-read";
import { buildStepPayload, type StepPayload } from "./step-output";
import { budgetState, planFor } from "@/lib/orchestrator/planner";
import { runtimeServices, readStepSource } from "./sources.server";
import { selectSignals, type PlayCost } from "./measured-ai.server";
import type { TaggedItem, Target } from "./engine";
import type { ToolCtx } from "@/lib/agent/tool-kit";
const stepSchema = z.object({ n:z.number().int().positive(),source:z.enum(["news","web","reviews_or_cases","reviews","competitors","people","company","drive","posthog"]),question:z.string().min(1),returns:z.array(z.string()) });
const receiptSchema = z.object({ step:z.number(),evidenceCount:z.number().int().nonnegative(),suggestionCount:z.number().int().nonnegative() });
function proposalOf(row: Tables<"custom_plays">): Proposal {
  const d = jsonObject(row.definition) ?? {};
  return z.object({ name:z.string(),trigger:z.string(),window:z.object({ backDays:z.number().positive(),forwardDays:z.number().nonnegative() }),steps:z.array(stepSchema).min(1).max(8),message:z.object({ claims:z.array(z.object({ text:z.string(),step:z.number() })),built:z.string(),ask:z.string() }),test:z.object({ n:z.number(),k:z.number(),base:z.number() }),verifiedOnly:z.boolean() }).parse({ ...d,name:row.name,verifiedOnly:row.verified_only });
}
const checked = <T>(r: { data:T;error:unknown }): T => { if(r.error) throw new Error("No se pudo guardar o leer la ejecución. Revisa el play antes de repetir.");return r.data; };
async function budgetFor(c:ToolCtx) {
  const start=new Date();start.setUTCDate(1);start.setUTCHours(0,0,0,0);
  const limit=checked(await c.db.from("org_budgets").select("monthly_limit").eq("org_id",c.orgId).maybeSingle());
  const usage=await fetchAll((a,b) => c.db.from("integration_usage").select("cost").eq("org_id",c.orgId).gte("created_at",start.toISOString()).order("id").range(a,b));
  if(usage.truncated) throw new Error("No se pudo comprobar el presupuesto completo. Revisa Conexiones.");
  return budgetState(usage.rows.reduce((s,r) => s+Number(r.cost),0),limit?.monthly_limit == null ? null : Number(limit.monthly_limit));
}
const parsePayload = (v: Json): StepPayload => {
  // Only server-owned committed payloads are read; validate their container before narrowing.
  const p = jsonObject(v);
  if (!p || !Array.isArray(p.signals) || !Array.isArray(p.evidence) || !Array.isArray(p.costs)) throw new Error("El resultado guardado no es válido. Revisa el play.");
  return p as unknown as StepPayload;
};
async function targetsFor(c: ToolCtx, signals: TaggedItem[], now:Date): Promise<Target[]> {
  const [plans,deals,accounts] = await Promise.all([
    fetchAll((a,b) => c.db.from("account_plans").select("account_id,competitors").eq("org_id",c.orgId).order("id").range(a,b)),
    fetchAll((a,b) => c.db.from("deals").select("account_id,lost_competitor").eq("org_id",c.orgId).order("id").range(a,b)),
    fetchAll((a,b) => c.db.from("accounts").select("id,name,domain").eq("org_id",c.orgId).order("id").range(a,b)),
  ]);
  if (plans.truncated || deals.truncated || accounts.truncated) throw new Error("Hay demasiadas cuentas para comprobar este play. Acota la búsqueda.");
  const pos = checked(await c.db.from("positioning").select("competitive_alternative").eq("org_id",c.orgId).limit(1).maybeSingle());
  const text = signals.map(s => `${s.title} ${s.snippet}`).join(" ").toLowerCase();
  const ids = new Set<string>();
  for(const comp of splitCompetitors(pos?.competitive_alternative)) if(text.includes(comp.toLowerCase()))
    for(const id of accountsForCompetitor(comp,{ plans:plans.rows,lostDeals:deals.rows })) ids.add(id);
  for(const a of accounts.rows) if(signals.some(s => {
    try { return !!a.domain && new URL(s.url).hostname.replace(/^www\./,"") === a.domain.replace(/^https?:\/\//,"").replace(/^www\./,"").replace(/\/$/,""); } catch { return false; }
  })) ids.add(a.id);
  const selected = [...ids].slice(0,20);
  if(!selected.length) return [];
  const people = checked(await c.db.from("stakeholders").select("id,account_id,email").eq("org_id",c.orgId).in("account_id",selected).order("created_at").limit(100));
  const verifications = await loadEmailVerifications(c.db,c.orgId,(people ?? []).map(p => p.email));
  return selected.map(accountId => {
    const p = people?.find(x => x.account_id === accountId && x.email);
    return { accountId,personId:p?.id ?? null,emailStatus:p?.email ? effectiveEmailStatus(p.email,verifications.find(v => v.email === p.email?.trim().toLowerCase()) ?? null,now) : null };
  });
}
export function createExecutionPorts(db:Db, token:string): ExecutionPorts {
  const context = (i:ExecutionInput):ToolCtx => ({ db,orgId:i.orgId,userId:i.userId,roles:[],currency:"" });
  const args = (i:ExecutionInput) => ({ p_org:i.orgId,p_play:i.playId,p_run:i.runId,p_token:token });
  const prior = async (i:ExecutionInput) => checked(await db.from("custom_play_steps").select("step_number,status,payload,evidence_count,suggestion_count").eq("org_id",i.orgId).eq("run_id",i.runId).order("step_number")) ?? [];
  const ports:ExecutionPorts = {
    load:async i => {
      const row = checked(await db.from("custom_plays").select("*").eq("org_id",i.orgId).eq("id",i.playId).maybeSingle());
      if(!row) return null;
      const [org,member,drive,posthog] = await Promise.all([
        db.from("organizations").select("archived_at").eq("id",i.orgId).maybeSingle(),
        db.from("org_members").select("user_id").eq("org_id",i.orgId).eq("user_id",i.userId).limit(1),
        db.from("drive_folders").select("folder_id").eq("org_id",i.orgId).is("account_id",null).maybeSingle(),
        db.from("posthog_connections").select("org_id").eq("org_id",i.orgId).maybeSingle(),
      ]);
      return { status:row.status === "activo" && !row.execution_pause ? "active" : row.status,archived:!checked(org) || !!org.data?.archived_at,member:!!checked(member)?.length,proposal:proposalOf(row),sources:{ services:runtimeServices(),driveFolder:!!checked(drive),posthog:!!checked(posthog) } };
    },
    claim:async i => checked(await db.rpc("claim_custom_play",{ ...args(i),p_user:i.userId })) === true,
    release:async i => { checked(await db.from("custom_plays").update({ lease_token:null,lease_until:null }).eq("org_id",i.orgId).eq("id",i.playId).eq("lease_token",token)); },
    checkpoint:async(i,n) => {
      const s = (await prior(i)).find(s => s.step_number === n);
      if(s?.status === "reserved") {
        await ports.pause(i,"uncertain");
        throw new Error("Este paso quedó sin resultado confirmado. Se ha pausado para no repetir gasto; revisa la ejecución.");
      }
      return s?.status === "committed" ? { step:n,evidenceCount:s.evidence_count,suggestionCount:s.suggestion_count } : null;
    },
    guard:async i => {
      const row = checked(await db.from("custom_plays").select("status,execution_pause").eq("org_id",i.orgId).eq("id",i.playId).maybeSingle());
      const org = checked(await db.from("organizations").select("archived_at").eq("id",i.orgId).maybeSingle());
      const members = checked(await db.from("org_members").select("user_id").eq("org_id",i.orgId).eq("user_id",i.userId).limit(1));
      const pause=checked(await db.from("job_locks").select("paused_reason").eq("name",`custom_plays:${i.orgId}`).maybeSingle());
      return { active:row?.status === "activo" && !row.execution_pause && !pause?.paused_reason && !!org && !org.archived_at && !!members?.length,cancelled:false,budgetPaused:(await budgetFor(context(i))).paused };
    },
    pause:async(i,reason) => {
      // ALL custom-play entry points consult this durable company-wide circuit breaker.
      checked(await db.from("job_locks").upsert({ name:`custom_plays:${i.orgId}`,paused_reason:reason },{ onConflict:"name" }));
      checked(await db.from("custom_plays").update({ status:"pausado",execution_pause:reason }).eq("org_id",i.orgId).eq("id",i.playId).eq("lease_token",token));
      checked(await db.from("custom_play_runs").update({ status:"paused",updated_at:new Date().toISOString() }).eq("org_id",i.orgId).eq("id",i.runId));
    },
    runStep:async i => {
      const reserved = checked(await db.rpc("reserve_custom_play_step",{ ...args(i),p_step:i.step.n }));
      if(!reserved) throw new Error("No se pudo reservar el paso. Revisa la ejecución antes de repetir.");
      const previous = (await prior(i)).filter(s => s.status === "committed").map(s => parsePayload(s.payload));
      const c = context(i);
      let signals:TaggedItem[] = [];
      let usage:StepPayload["usage"] = [];
      let costs:PlayCost[] = [];
      let selectionError:unknown;
      let sourceData:unknown = null;
      const pos = checked(await db.from("positioning").select("competitive_alternative,product_name,need,target_customer").eq("org_id",i.orgId).limit(1).maybeSingle());
      const competitors = splitCompetitors(pos?.competitive_alternative).slice(0,3);
      if(["people","company"].includes(i.step.source)) {
        const relevantTargets = await targetsFor(c,previous.flatMap(p => p.signals),i.now);
        const need=i.step.source === "people" ? "find_stakeholders" : "enrich_account";
        const budget=await budgetFor(c);
        const option=planFor({ need,connected:runtimeServices(),budget:{ remaining:budget.remaining,paused:budget.paused,automatic:i.trigger === "automatic" } }).steps.find(s => s.service === "apollo" || s.service === "clay");
        if(relevantTargets.length && !option) throw new Error("No hay una fuente disponible para buscar estos datos. Revisa Conexiones.");
        const data:unknown[]=[];
        for(const target of relevantTargets.slice(0,3)) {
          if(!option) break;
          // One selected Need option: no hidden web-fallback AI call or automatic contact reveal.
          const gateway=option.service === "apollo" ? await import("@/lib/apollo-gateway") : await import("@/lib/clay-gateway");
          const found=i.step.source === "people" ? await gateway.findPeople(c,{ accountId:target.accountId }) : await gateway.enrichAccount(c,target.accountId);
          data.push({ accountId:target.accountId,result:found });
          usage.push({ service:option.service,need,trigger:i.trigger,cost:option.cost });
        }
        sourceData=data;
        costs=usage.map(u => ({ provider:u.service,amount:u.cost,cost_kind:"provider_estimated",currency:"EUR",input_tokens:null,output_tokens:null }));
      } else if(i.step.source === "posthog") {
        // Cached company-scoped product usage is not a public dated event and cannot support message claims.
        sourceData=checked(await db.from("product_usage").select("account_id,active_users_7d,synced_at").eq("org_id",i.orgId).limit(20));
      } else if(i.step.source === "competitors") {
        // Declared competitors only: never infer which competitor is used by a customer.
        sourceData=competitors;
      } else if(i.step.source === "drive") {
        const { companyFolder } = await import("@/lib/drive-core");
        const { listChildren,exportText,downloadText } = await import("@/lib/google-drive");
        const folder = await companyFolder(c,false);
        if(!folder) throw new Error("La empresa no tiene carpeta de Drive. Revisa la conexión.");
        for(const file of (await listChildren(folder.id)).filter(f => f.mimeType === "application/vnd.google-apps.document" || f.mimeType === "text/plain").slice(0,3)) {
          const text = file.mimeType === "text/plain" ? await downloadText(file.id) : await exportText(file.id,"text/plain");
          // Modification time is NOT event time. Only a date literally present in the source may qualify.
          signals.push({ title:file.name,url:file.webViewLink ?? `https://drive.google.com/file/d/${file.id}`,snippet:text.slice(0,280),date:null,source:"Drive",provider:"drive" });
        }
      } else {
        const query = i.step.source === "reviews" ? competitors[0] : `${i.step.question} ${competitors.join(" ")} ${pos?.product_name ?? ""} ${pos?.need ?? ""}`.slice(0,1500);
        if(!query) throw new Error("Falta un competidor declarado para buscar reseñas. Completa el posicionamiento.");
        const read = await readStepSource(c,{ ...i.step,question:query },i.trigger);
        signals = read.signals;usage=read.usage;
        costs = usage.map(u => ({ provider:u.service,amount:u.cost,cost_kind:"provider_estimated",currency:"EUR",input_tokens:null,output_tokens:null }));
      }
      if(signals.length) {
        try {
          const { loadAgentRules,rulesBlock }=await import("@/lib/knowledge-rules");
          const rules=await loadAgentRules(c);
          if(!rules.ok) throw new Error("No se pudieron leer las reglas del equipo. Revisa la ejecución.");
          const selection = await selectSignals(`${i.proposal.trigger}\n${i.step.question}`,signals,process.env,fetch,rulesBlock(rules.rules));
          costs.push(selection.cost);
          signals = selection.selected.flatMap(n => signals[n] ? [signals[n]] : []);
        } catch(e) {
          const cost = e && typeof e === "object" && "playCost" in e ? e.playCost as PlayCost : null;
          if(cost) costs.push(cost);
          signals=[];selectionError=e;
        }
      }
      const last = i.proposal.steps.at(-1)?.n === i.step.n;
      const allSignals = [...previous.flatMap(p => p.signals),...signals];
      const targets = last && !selectionError ? await targetsFor(c,allSignals,i.now) : [];
      const payload = buildStepPayload({ playId:i.playId,proposal:i.proposal,step:i.step,signals,targets,previous,now:i.now,last });
      if(selectionError) payload.suggestions=[];
      payload.costs=costs;payload.usage=usage;payload.sourceData=sourceData;
      const receipt = receiptSchema.parse(checked(await db.rpc("commit_custom_play_step",{ ...args(i),p_step:i.step.n,p_payload:payload as unknown as Json })));
      if(selectionError) throw selectionError;
      return receipt;
    },
  };
  return ports;
}
/** One bounded hourly batch. It neither activates a play nor sends anything. */
export async function runActiveCustomPlays(db:Db,orgId:string,now=new Date()) {
  const pause=checked(await db.from("job_locks").select("paused_reason").eq("name",`custom_plays:${orgId}`).maybeSingle());
  if(pause?.paused_reason) return { runs:0,evidenceCount:0,suggestionCount:0,paused:1 };
  const rows = checked(await db.from("custom_plays").select("id").eq("org_id",orgId).eq("status","activo").is("execution_pause",null).order("updated_at").limit(3)) ?? [];
  const members = checked(await db.from("org_members").select("user_id").eq("org_id",orgId).in("role",["owner","sales_leader"]).order("created_at").limit(1));
  const userId = members?.[0]?.user_id;
  const total = { runs:0,evidenceCount:0,suggestionCount:0,paused:0 };
  if(!userId) return total;
  for(const row of rows) {
    const since = new Date(now);since.setUTCMinutes(0,0,0);
    // Recover an unfinished run even across the hour boundary; never lose uncertain reservations.
    const unfinished = checked(await db.from("custom_play_runs").select("id,status").eq("org_id",orgId).eq("play_id",row.id).eq("status","running").order("created_at").limit(1));
    const existing = unfinished?.length ? unfinished : checked(await db.from("custom_play_runs").select("id,status").eq("org_id",orgId).eq("play_id",row.id).gte("created_at",since.toISOString()).order("created_at").limit(1));
    const prior = existing?.[0];
    if(prior && prior.status !== "running") continue;
    const input:ExecutionInput = { orgId,playId:row.id,runId:prior?.id ?? crypto.randomUUID(),userId,trigger:"automatic",now };
    const ports=createExecutionPorts(db,crypto.randomUUID());
    let r;
    try {
      r=await executeCustomPlay(ports,input);
    } catch {
      // The coordinator releases the lease before propagating: pause by scoped play id here.
      // An unconfirmed external step must not be replayed by the next hourly run.
      checked(await db.from("custom_plays").update({ status:"pausado",execution_pause:"uncertain" }).eq("org_id",orgId).eq("id",row.id));
      checked(await db.from("custom_play_runs").update({ status:"failed" }).eq("org_id",orgId).eq("id",input.runId));
      total.paused++;break;
    }
    if(r.status === "done" || r.status === "paused" || r.status === "blocked") checked(await db.from("custom_play_runs").update({ status:r.status,updated_at:new Date().toISOString() }).eq("org_id",orgId).eq("id",input.runId));
    total.runs++;total.evidenceCount+=r.evidenceCount;total.suggestionCount+=r.suggestionCount;
    if(r.status === "done") checked(await db.from("custom_plays").update({ updated_at:new Date().toISOString() }).eq("org_id",orgId).eq("id",row.id));
    if(r.status === "paused") { total.paused++;break; }
  }
  return total;
}