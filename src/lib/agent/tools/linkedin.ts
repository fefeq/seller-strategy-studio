// Apify: LinkedIn posts (companies and people), job offers and competitor reviews on G2.
// Same cores as the screens and the signal refresh (apify-core.ts). Each run spends the Apify balance.
// Legal pause (SDD pieza A): while it lasts, the LinkedIn tools explain the block instead of running;
// G2 reviews keep working.
import { z } from "zod";
import { def, mustFind, type AgentTool } from "../tool-kit";
import { linkedinPauseExplanation } from "@/lib/linkedin-legal";

const scope = (c: { orgId: string; userId: string }) => ({ orgId: c.orgId, userId: c.userId });
const post = (p: { url: string; text: string; date: string | null; repost: boolean; likes: number }) => ({ fecha: p.date, texto: p.text, url: p.url, compartida: p.repost, me_gusta: p.likes });

/** The pause explanation when the legal pause is on, else null. The agent relays it and prepares nothing. */
async function pausedMessage(): Promise<{ mensaje: string; pausado: true } | null> {
  const { linkedinExtractionPaused } = await import("@/lib/linkedin-legal.server");
  return (await linkedinExtractionPaused()) ? { mensaje: linkedinPauseExplanation(), pausado: true } : null;
}

export const LINKEDIN_TOOLS: AgentTool[] = [
  def({
    name: "linkedin_company_posts", kind: "read",
    description: "Publicaciones recientes (3 meses) de la página de LinkedIn de una cuenta. Si la cuenta no tiene su LinkedIn guardado, lo busca y lo guarda. Gasta saldo de Apify.",
    input: z.object({ account_id: z.string().uuid() }),
    run: async (c, a) => {
      const paused = await pausedMessage();
      if (paused) return paused;
      await mustFind(c, "accounts", a.account_id, "esa cuenta");
      const { accountPostsCore } = await import("@/lib/apify-core");
      const r = await accountPostsCore(c.db, a.account_id, scope(c));
      return { linkedin: r.linkedin, publicaciones: r.posts.map(post), engagement: r.engagement };
    },
  }),
  def({
    name: "linkedin_profile_posts", kind: "read",
    description: "Publicaciones recientes en LinkedIn de un stakeholder (necesita su LinkedIn en la ficha): de qué habla y qué comparte. Gasta saldo de Apify.",
    input: z.object({ stakeholder_id: z.string().uuid() }),
    run: async (c, a) => {
      const paused = await pausedMessage();
      if (paused) return paused;
      await mustFind(c, "stakeholders", a.stakeholder_id, "esa persona");
      const { stakeholderPostsCore } = await import("@/lib/apify-core");
      const r = await stakeholderPostsCore(c.db, a.stakeholder_id, scope(c));
      return { persona: r.name, linkedin: r.linkedin, publicaciones: r.posts.map(post) };
    },
  }),
  def({
    name: "company_job_postings", kind: "read",
    description: "Ofertas de empleo abiertas de una cuenta en LinkedIn (últimos 30 días): qué puestos contrata, dónde y con qué nivel. Útil como señal de compra. Gasta saldo de Apify.",
    input: z.object({ account_id: z.string().uuid() }),
    run: async (c, a) => {
      const paused = await pausedMessage();
      if (paused) return paused;
      await mustFind(c, "accounts", a.account_id, "esa cuenta");
      const { accountJobsCore } = await import("@/lib/apify-core");
      const r = await accountJobsCore(c.db, a.account_id, scope(c));
      return { linkedin: r.linkedin, ofertas: r.jobs.map((j) => ({ puesto: j.title, ubicacion: j.location, nivel: j.level, publicada: j.date, url: j.url, extracto: j.description })) };
    },
  }),
  def({
    name: "competitor_reviews", kind: "read",
    description: "Reseñas recientes de un competidor en G2 (por nombre del producto o enlace de G2): nota, qué valoran, qué critican y por qué se cambian. Gasta saldo de Apify (unos 0,06 $ por cada 10 reseñas).",
    input: z.object({ competitor: z.string().min(2).max(200), max: z.number().int().min(5).max(40).optional().describe("Reseñas a leer (20 por defecto)") }),
    run: async (c, a) => {
      const { competitorReviewsCore } = await import("@/lib/apify-core");
      const r = await competitorReviewsCore(a.competitor, a.max ?? 20, { db: c.db, orgId: c.orgId, userId: c.userId, trigger: "manual", tool: "competitor_reviews" });
      return { producto: r.product.name, g2: r.product.url, nota_media: r.average, resenas: r.reviews.map((x) => ({ titulo: x.title, estrellas: x.rating, fecha: x.date, texto: x.text.slice(0, 700), motivo_cambio: x.switchedReason || undefined, url: x.url })) };
    },
  }),
  def({
    name: "create_battlecard_from_reviews", kind: "write",
    description: "Lee reseñas recientes de un competidor en G2, redacta una battlecard (fortalezas, críticas, por qué se cambian, objeciones y respuestas, preguntas de discovery) y la guarda en el hub, sección Objeciones y battlecards. Gasta saldo de Apify.",
    input: z.object({ competitor: z.string().min(2).max(200), max: z.number().int().min(5).max(40).optional() }),
    summarize: (a) => `Crear una battlecard de ${a.competitor} con sus reseñas de G2`,
    run: async (c, a) => {
      const { battlecardCore } = await import("@/lib/apify-core");
      const b = await battlecardCore(c.db, a.competitor, a.max ?? 20, scope(c));
      const { data, error } = await c.db.from("knowledge_docs").insert({ org_id: c.orgId, section: "objections", title: b.title, body: b.markdown, scope: "team", created_by: c.userId, updated_by: c.userId }).select("id").single();
      if (error) throw new Error(error.message);
      return { mensaje: `«${b.title}» guardada en Conocimiento › Objeciones y battlecards (${b.count} reseñas de G2).`, doc_id: data.id };
    },
  }),
];
