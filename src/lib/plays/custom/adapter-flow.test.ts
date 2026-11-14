// @vitest-environment node
import { expect,it,vi } from "vitest";
import type { Db } from "@/lib/org-data";
import type { Proposal } from "./propose";
const fake=vi.hoisted(() => ({ source:vi.fn(),ai:vi.fn() }));
vi.mock("./sources.server",() => ({ runtimeServices:() => ["firecrawl"],readStepSource:fake.source }));
vi.mock("./measured-ai.server",() => ({ selectSignals:fake.ai }));
vi.mock("@/lib/knowledge-rules",() => ({ loadAgentRules:async() => ({ ok:true,rules:[] }),rulesBlock:() => "" }));
import { createExecutionPorts } from "./adapters.server";
import { executeCustomPlay } from "./execution";
it("CA-1/CA-2/CA-4 real adapters read a source, commit evidence/suggestion/cost and never call it again after checkpoint",async() => {
 const p:Proposal={ name:"Sintético",trigger:"Retirada",window:{backDays:60,forwardDays:0},steps:[{n:1,source:"news",question:"Retirada",returns:["event_date"]}],message:{claims:[{text:"Retirada",step:1}],built:"Comparación",ask:"¿Lo vemos?"},test:{n:20,k:2,base:20},verifiedOnly:false };
 let stored:Record<string,unknown>|null=null;
 let commits=0;
 let evidence=0,suggestions=0,costs=0;
 const results:Record<string,unknown>={custom_plays:{id:"play",status:"activo",name:p.name,verified_only:false,definition:p},organizations:{archived_at:null},org_members:[{user_id:"user"}],drive_folders:null,posthog_connections:null,job_locks:null,org_budgets:null,integration_usage:[],positioning:null,accounts:[],deals:[],account_plans:[]};
 const raw={ from:(table:string) => {
  const q={select:()=>q,eq:()=>q,is:()=>q,in:()=>q,order:()=>q,limit:()=>q,range:()=>q,gte:()=>q,maybeSingle:()=>q,update:()=>q,upsert:()=>q,then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:table==="custom_play_steps" ? (stored ? [stored] : []):results[table],error:null}).then(resolve)};
  return q;
 },rpc:async(name:string,args:Record<string,unknown>) => {
   if(name==="claim_custom_play") return {data:true,error:null};
   if(name==="reserve_custom_play_step") {if(stored)return {data:false,error:null};stored={step_number:1,status:"reserved"};return {data:true,error:null};}
   if(name==="commit_custom_play_step") {
    const payload=args.p_payload as {evidence:unknown[];suggestions:unknown[];costs:unknown[]};
    commits++;evidence+=payload.evidence.length;suggestions+=payload.suggestions.length;costs+=payload.costs.length;
    stored={step_number:1,status:"committed",payload,evidence_count:payload.evidence.length,suggestion_count:payload.suggestions.length};
    return {data:{step:1,evidenceCount:payload.evidence.length,suggestionCount:payload.suggestions.length},error:null};
   }
   throw new Error("Unexpected RPC");
 }};
 // Narrow test boundary: recording fake implements the fluent methods used by adapters, not the entire SDK.
 const db=raw as unknown as Db;
 fake.source.mockResolvedValue({signals:[{title:"Aviso",url:"https://example.com/news",snippet:"Retirada publicada el 13 de noviembre de 2026",date:"2026-11-13",source:"web",provider:"firecrawl"}],usage:[{service:"firecrawl",need:"news_signals",trigger:"automatic",cost:0.02}]});
 fake.ai.mockResolvedValue({selected:[0],cost:{provider:"synthetic",amount:0.12,cost_kind:"ai_measured",currency:"USD",input_tokens:10,output_tokens:2}});
 const input={orgId:"org",playId:"play",runId:"run",userId:"user",trigger:"automatic" as const,now:new Date("2026-11-13T12:00:00Z")};
 const r=await executeCustomPlay(createExecutionPorts(db,"lease"),input);
 expect(r).toEqual({status:"done",completedSteps:1,evidenceCount:1,suggestionCount:1});
 expect({commits,evidence,suggestions,costs}).toEqual({commits:1,evidence:1,suggestions:1,costs:2});
 await executeCustomPlay(createExecutionPorts(db,"lease2"),input);
 expect(fake.source).toHaveBeenCalledTimes(1);
 expect(fake.ai).toHaveBeenCalledTimes(1);
 expect(commits).toBe(1);
});