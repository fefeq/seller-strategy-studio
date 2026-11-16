import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { json, text } from "../context";

export const listCompanies = defineTool({
  name: "list_companies",
  title: "Listar empresas",
  description: "Lista las empresas a las que pertenece el usuario, su rol y cuál está activa.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_a, ctx) => {
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("No autenticado");
    const db = supabaseForUser(ctx);
    const [{ data: profile }, { data: members }] = await Promise.all([
      db.from("profiles").select("current_org_id").eq("id", userId).maybeSingle(),
      db.from("org_members").select("org_id, role, organizations(name)").eq("user_id", userId),
    ]);
    return json(
      (members ?? []).map((m) => ({
        id: m.org_id,
        name: (m.organizations as { name: string } | null)?.name ?? "",
        role: m.role,
        active: m.org_id === profile?.current_org_id,
      })),
    );
  },
});

export const switchCompany = defineTool({
  name: "switch_company",
  title: "Cambiar de empresa",
  description:
    "Cambia la empresa activa del usuario (también en la app). Usa el id de list_companies.",
  inputSchema: { company_id: z.string().uuid().describe("id de la empresa (de list_companies)") },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ company_id }, ctx) => {
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("No autenticado");
    const db = supabaseForUser(ctx);
    const { data: m } = await db
      .from("org_members")
      .select("org_id, organizations(name)")
      .eq("user_id", userId)
      .eq("org_id", company_id)
      .maybeSingle();
    if (!m) throw new ToolError("No perteneces a esa empresa");
    const { error } = await db
      .from("profiles")
      .update({ current_org_id: company_id })
      .eq("id", userId);
    if (error) throw new ToolError(error.message);
    return text(
      `Empresa activa: ${(m.organizations as { name: string } | null)?.name ?? company_id}`,
    );
  },
});
