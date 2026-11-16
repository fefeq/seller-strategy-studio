import { diagnose, type Diagnosis, type DiagnosisInput } from "./gtm-diagnosis";
import { readLineInput } from "./business-lines";
import type { Tables } from "@/integrations/supabase/types";

export type EditableLine = Pick<
  Tables<"business_lines">,
  "id" | "model" | "acv" | "friction" | "stage" | "name" | "is_primary" | "position"
>;
export type LineAnswers = DiagnosisInput & { name: string | null; position: number };
export type LineEditorPorts = {
  read: () => Promise<EditableLine[]>;
  write: (id: string | undefined, answers: LineAnswers) => Promise<EditableLine | null>;
  makePrimary: (id: string) => Promise<string | null>;
  remove: (id: string) => Promise<string | null>;
  saveDiagnosis: (payload: { input: DiagnosisInput; result: Diagnosis }) => Promise<void>;
};
export type LineEdit =
  | { kind: "save"; id?: string; input: unknown; name: string }
  | { kind: "primary" | "remove"; id: string };
export type LineEditResult = { committed: boolean; diagnosisSynced: boolean; syncError?: unknown };

/** Retrying this operation never repeats a line write or RPC. */
export async function syncPrimaryDiagnosis(ports: LineEditorPorts): Promise<LineEditResult> {
  try {
    const lines = await ports.read();
    const primary = lines.filter((x) => x.is_primary);
    const input = primary.length === 1 ? readLineInput(primary[0]) : null;
    if (!input)
      throw new Error("No se pudo leer la línea principal. Recarga e inténtalo de nuevo.");
    await ports.saveDiagnosis({ input, result: diagnose(input) });
    return { committed: false, diagnosisSynced: true };
  } catch (syncError) {
    return { committed: false, diagnosisSynced: false, syncError };
  }
}

/** DB is authoritative; preflight rejects obvious invalid writes, post-commit failures are explicit. */
export async function editBusinessLine(
  ports: LineEditorPorts,
  roles: readonly string[],
  action: LineEdit,
): Promise<LineEditResult> {
  if (!roles.some((x) => x === "owner" || x === "sales_leader"))
    throw new Error("Solo Owner y Sales Leader pueden editar líneas.");
  if (action.kind === "remove" && !roles.includes("owner"))
    throw new Error("Solo el Owner puede quitar líneas.");
  const lines = await ports.read();
  if (action.id && !lines.some((x) => x.id === action.id))
    throw new Error("No se encuentra esta línea en tu empresa.");
  let written: EditableLine | string | null;
  if (action.kind === "save") {
    const input = readLineInput(action.input);
    if (!input) throw new Error("Completa las cuatro respuestas y un ticket mayor que cero.");
    const name = action.name.trim();
    if (name.length > 200) throw new Error("El nombre puede tener hasta 200 caracteres.");
    if (!action.id && lines.length >= 4) throw new Error("Puedes guardar hasta cuatro líneas.");
    const position = action.id
      ? (lines.find((x) => x.id === action.id)?.position ?? 0)
      : Math.max(-1, ...lines.map((x) => x.position)) + 1;
    written = await ports.write(action.id, { ...input, name: name || null, position });
  } else if (action.kind === "primary") {
    written = await ports.makePrimary(action.id);
  } else {
    if (lines.length <= 1) throw new Error("No puedes quitar la última línea.");
    written = await ports.remove(action.id);
  }
  if (!written) throw new Error("No se guardó el cambio. Recarga e inténtalo de nuevo.");
  const sync = await syncPrimaryDiagnosis(ports);
  return { ...sync, committed: true };
}
