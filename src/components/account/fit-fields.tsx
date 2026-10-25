import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Field, Pick } from "@/components/fields";
import { CountryPick } from "@/components/country-pick";
import { readSources, sourceText, personEdit } from "@/lib/provenance";
import type { Json } from "@/integrations/supabase/types";
import { errorText } from "@/lib/errors";
import { normalizeForSave } from "@/lib/field-normalize";
import { CompleteAccount } from "@/components/orchestrator";
import { linkedinCompanyUrl } from "@/lib/apify";

/** Segment, sector and size: what the ICP fit is measured against. Saved on blur. */
export function FitFields({ account, segNames, onSaved }: { account: { id: string; domain: string | null; segment_id: string | null; industry: string | null; size: string | null; country?: string | null; linkedin_url?: string | null; field_sources?: unknown }; segNames: Map<string, string>; onSaved: () => void }) {
  const [f, setF] = useState({ segment_id: account.segment_id ?? "", industry: account.industry ?? "", size: account.size ?? "" });
  useEffect(() => setF({ segment_id: account.segment_id ?? "", industry: account.industry ?? "", size: account.size ?? "" }), [account.segment_id, account.industry, account.size]);
  const [linkedin, setLinkedin] = useState(account.linkedin_url ?? "");
  useEffect(() => setLinkedin(account.linkedin_url ?? ""), [account.linkedin_url]);
  // The company's LinkedIn page: its posts and job offers feed Señales (found automatically when empty).
  async function saveLinkedin() {
    const raw = linkedin.trim();
    const url = raw ? linkedinCompanyUrl(raw) : null;
    if (raw && !url) return toast.error("Pega el enlace de la página de empresa: linkedin.com/company/…");
    if (url === (account.linkedin_url ?? null)) return;
    const { error } = await supabase.from("accounts").update({ linkedin_url: url }).eq("id", account.id);
    if (error) return toast.error(errorText(error));
    setLinkedin(url ?? "");
    onSaved();
  }
  // Country decides the region for the account assignment rules (Cuentas → Reparto).
  async function saveCountry(country: string | null) {
    const field_sources = personEdit(account.field_sources, { country }, new Date().toISOString());
    const { error } = await supabase.from("accounts").update({ country, field_sources: field_sources as unknown as Json }).eq("id", account.id);
    if (error) return toast.error(errorText(error));
    onSaved();
  }
  async function save(patch: Partial<typeof f>) {
    const next = { ...f, ...patch };
    setF(next);
    if (next.segment_id === (account.segment_id ?? "") && next.industry === (account.industry ?? "") && next.size === (account.size ?? "")) return;
    const size = normalizeForSave("accounts", "size", next.size).value as string | null;
    const edits: Record<string, string | null> = {};
    if (next.industry !== (account.industry ?? "")) edits.industry = next.industry;
    if ((size ?? "") !== (account.size ?? "")) edits.size = size;
    const field_sources = personEdit(account.field_sources, edits, new Date().toISOString());
    const { error } = await supabase.from("accounts").update({ segment_id: next.segment_id || null, industry: next.industry || null, size: size || null, field_sources: field_sources as unknown as Json }).eq("id", account.id);
    if (error) return toast.error(errorText(error));
    onSaved();
  }
  const marks = readSources(account.field_sources);
  const mark = (k: string) => { const t = sourceText(marks[k]); return t ? <p className="mt-1 font-mono text-xs text-muted-foreground" title={marks[k]?.quote ? `«${marks[k]!.quote}»` : undefined}>{t}</p> : null; };
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <p className="eyebrow">Datos para el encaje</p>
      <Field label="Segmento"><Pick value={f.segment_id} options={{ "": "Sin segmento", ...Object.fromEntries(segNames) }} onChange={(v) => save({ segment_id: v })} /></Field>
      <Field label="Sector"><Input value={f.industry} placeholder="Fintech, logística…" onChange={(e) => setF({ ...f, industry: e.target.value })} onBlur={() => save({})} /></Field>{mark("industry")}
      <Field label="Tamaño"><Input value={f.size} placeholder="Empleados: 200" onChange={(e) => setF({ ...f, size: e.target.value })} onBlur={() => save({})} /></Field>{mark("size")}
      <Field label="País"><CountryPick aria-label="País" value={account.country ?? null} onChange={saveCountry} /></Field>{mark("country")}
      <Field label="LinkedIn de la empresa"><Input value={linkedin} placeholder="linkedin.com/company/…" onChange={(e) => setLinkedin(e.target.value)} onBlur={saveLinkedin} /></Field>{mark("linkedin_url")}
      <div className="space-y-2">
        <CompleteAccount account={account} onSaved={onSaved} />
      </div>
    </div>
  );
}
