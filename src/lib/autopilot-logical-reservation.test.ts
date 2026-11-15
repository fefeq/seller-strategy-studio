// @vitest-environment node
import { expect, it, vi } from "vitest";
import type { ToolCtx } from "@/lib/agent/tool-kit";
const state = vi.hoisted(() => ({ keys: new Set<string>(), calls: 0 }));
vi.mock("@/integrations/supabase/client.server", () => ({supabaseAdmin:{from:()=>({insert:async(row:{name:string})=>{if(state.keys.has(row.name))return {error:{code:"23505"}};state.keys.add(row.name);return {error:null};}})}}));
vi.mock("@/lib/ai-core", () => ({meetingBriefCore:async()=>{state.calls++;return {brief:"Synthetic example.com"};},accountContext:async()=>""}));
import { executeAutopilotAi } from "@/lib/autopilot-ai.server";
it("different confirmed actions for the same company meeting make one paid call",async()=>{
  state.keys.clear();state.calls=0;
  const db={from:()=>{const q={select:()=>q,eq:()=>q,in:()=>q,update:()=>q,maybeSingle:async()=>({data:{id:"meeting",user_id:"u",ai_brief:null},error:null}),then:(resolve:(r:unknown)=>void)=>resolve({error:null})};return q;}} as unknown as ToolCtx["db"];
  const c={db,orgId:"org",userId:"u",roles:["owner"],currency:"EUR"} as ToolCtx;
  const r=await Promise.all([executeAutopilotAi(c,"autopilot_prepare_meeting",{meeting_id:"meeting"}),executeAutopilotAi(c,"autopilot_prepare_meeting",{meeting_id:"meeting"})]);
  expect(state.calls).toBe(1);expect(r.some(x=>x.mensaje.includes("No se ha repetido"))).toBe(true);
});