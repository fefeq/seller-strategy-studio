import { useQuery, useQueryClient } from "@tanstack/react-query";
import { primaryLine } from "@/lib/business-lines";
import { supabase } from "@/integrations/supabase/client";
import type { EditableLine, LineEditorPorts } from "@/lib/business-lines-editor";
import type { DiagnosisInput, Diagnosis } from "@/lib/gtm-diagnosis";

const COLS = "id,model,acv,friction,stage,name,is_primary,position";

async function readLines(): Promise<EditableLine[]> {
  // RLS limits rows to the active company; no org_id is passed.
  const { data, error } = await supabase.from("business_lines").select(COLS).order("position");
  if (error) throw error;
  return data ?? [];
}

/** Member-client lines of the active company plus the editor ports (SDD-20261114 U-2). */
export function useBusinessLines(
  orgId: string | null,
  saveDiagnosis: (p: { input: DiagnosisInput; result: Diagnosis }) => Promise<void>,
) {
  const qc = useQueryClient();
  const key = ["business-lines", orgId];
  const q = useQuery({ queryKey: key, queryFn: readLines, enabled: !!orgId });
  const ports: LineEditorPorts = {
    read: readLines,
    write: async (id, a) => {
      const row = {
        model: a.model,
        acv: a.acv,
        friction: a.friction,
        stage: a.stage,
        name: a.name,
        position: a.position,
      };
      const res = id
        ? await supabase.from("business_lines").update(row).eq("id", id).select(COLS).maybeSingle()
        : await supabase
            .from("business_lines")
            .insert({ ...row, is_primary: (q.data?.length ?? 0) === 0 })
            .select(COLS)
            .maybeSingle();
      if (res.error) throw res.error;
      return res.data;
    },
    makePrimary: async (id) => {
      const { data, error } = await supabase.rpc("set_primary_business_line", { _line: id });
      if (error) throw error;
      return data;
    },
    remove: async (id) => {
      const { data, error } = await supabase.rpc("remove_business_line", { _line: id });
      if (error) throw error;
      return data;
    },
    saveDiagnosis,
  };
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  return { ...q, ports, refresh };
}

/** Read-only lines of the active company plus its primary-line diagnosis (Inicio, Estrategia, Métricas, Segmentos). */
export function usePrimaryLine(orgId: string | null | undefined) {
  const q = useQuery({
    queryKey: ["business-lines", orgId ?? null],
    queryFn: readLines,
    enabled: !!orgId,
  });
  return { ...q, lines: q.data ?? [], primary: primaryLine(q.data ?? []) };
}
