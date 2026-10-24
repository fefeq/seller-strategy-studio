import { TOOLS } from "@/lib/agent/tools";
console.log(JSON.stringify(TOOLS.map((t) => [t.name, t.kind, t.description, (t.roles ?? []).join(","), JSON.stringify((t.input as any)._def?.shape?.() ? Object.keys((t.input as any)._def.shape()) : [])])));
