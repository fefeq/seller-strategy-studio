// Parallel through the Lovable connector gateway (managed connection: LOVABLE_API_KEY + PARALLEL_API_KEY, read
// inside each call). Search, Task runs (create + non-blocking poll) and Responses. Server-only usage.
import { parallelErrorText, searchAsNews } from "@/lib/parallel";

const GATEWAY = "https://connector-gateway.lovable.dev/parallel";

async function call(path: string, init: RequestInit & { okStatus?: number[] } = {}): Promise<Response> {
  const lovable = process.env["LOVABLE_API_KEY"];
  const key = process.env["PARALLEL_API_KEY"];
  if (!lovable || !key) throw new Error("Parallel no está conectado a Nokko.");
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!res.ok && !(init.okStatus ?? []).includes(res.status)) {
    const body = await res.text().catch(() => "");
    console.error(`Parallel ${path.split("?")[0]} [${res.status}]: ${body.slice(0, 500)}`);
    throw new Error(parallelErrorText(res.status, body));
  }
  return res;
}

export async function parallelSearch(objective: string, queries: string[], opts: { max?: number; afterDate?: string | null } = {}) {
  const res = await call("/v1/search", {
    method: "POST",
    body: JSON.stringify({
      objective: objective.slice(0, 1000),
      search_queries: queries.map((q) => q.replace(/site:\S+/g, "").trim().slice(0, 200)).filter(Boolean).slice(0, 5),
      mode: "fast",
      advanced_settings: { max_results: opts.max ?? 8, ...(opts.afterDate ? { source_policy: { after_date: opts.afterDate } } : {}) },
    }),
  });
  const data = (await res.json()) as { results?: unknown[] };
  return searchAsNews(data.results ?? []);
}

export async function createTaskRun(input: string, processor: string, schema: object): Promise<string> {
  const res = await call("/v1/tasks/runs", { method: "POST", body: JSON.stringify({ input, processor, task_spec: { output_schema: { type: "json", json_schema: schema } } }) });
  const data = (await res.json()) as { run_id?: string };
  if (!data.run_id) throw new Error("Parallel no ha devuelto la investigación. Vuelve a probar.");
  return data.run_id;
}

/** Returns at once: running (408), done with its output, or failed. */
export async function pollTaskRun(runId: string): Promise<{ status: "running" } | { status: "done"; output: unknown } | { status: "failed"; error: string }> {
  try {
    const res = await call(`/v1/tasks/runs/${encodeURIComponent(runId)}/result?timeout=1`, { method: "GET", okStatus: [408] });
    if (res.status === 408) return { status: "running" };
    const data = (await res.json()) as { output?: unknown; run?: { status?: string; error?: { message?: string } } };
    if (data.run?.status === "failed") return { status: "failed", error: data.run.error?.message ?? "La investigación ha fallado en Parallel." };
    return { status: "done", output: data.output };
  } catch (e) {
    return /no encuentra/.test((e as Error).message) ? { status: "failed", error: (e as Error).message } : { status: "running" };
  }
}

export async function respond(input: string, schema: object, effort: "low" | "medium" = "medium"): Promise<unknown> {
  const res = await call("/v1/responses", { method: "POST", body: JSON.stringify({ model: "parallel", reasoning: { effort }, input, text: { format: { type: "json_schema", name: "table", schema } } }) });
  const data = (await res.json()) as { output_text?: string; output?: { content?: { type?: string; text?: string }[] }[] };
  const text = data.output_text ?? (data.output ?? []).flatMap((o) => o.content ?? []).find((c) => c.type === "output_text")?.text ?? "";
  try { return JSON.parse(text); } catch { throw new Error("Parallel no ha devuelto la tabla. Vuelve a probar."); }
}
