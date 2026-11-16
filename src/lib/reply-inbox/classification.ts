import { z } from "zod";

export const REPLY_CLASSES = [
  "interested",
  "more_information",
  "out_of_office",
  "wrong_person",
  "not_interested",
  "unsubscribe",
  "other",
] as const;
export type ReplyClass = (typeof REPLY_CLASSES)[number];
export const CLASSIFICATION_SCHEMA = z
  .object({
    category: z.enum(REPLY_CLASSES),
    confidence: z.number().min(0).max(1),
    returnDate: z.string().nullable(),
    referredName: z.string().nullable(),
    referredEmail: z.string().nullable(),
  })
  .strict();
export const CLASSIFICATION_JSON_SCHEMA = z.toJSONSchema(CLASSIFICATION_SCHEMA);
export const MAX_REPLY_TEXT = 12000;
export const DERIVED_TTL_DAYS = 30;
const normalized = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Best-effort removal of quoted history and signatures, never a full email parser. */
export function replyText(text: string): string {
  return (
    text
      .split(
        /\r?\n(?:-- ?\r?\n|On .{1,250}wrote:|El .{1,250}escribi[oó]:|De: |From: |_{5,}|-{5,}Original Message)/i,
      )[0]
      ?.split(/\r?\n/)
      .filter((line) => !/^\s*>/.test(line))
      .join("\n")
      .trim()
      .slice(0, MAX_REPLY_TEXT) ?? ""
  );
}

export type SafetyBrake = "unsubscribe" | "privacy" | "legal" | "pricing" | "contract";
export function sensitiveReply(text: string, category: ReplyClass): SafetyBrake | null {
  const value = normalized(text);
  if (
    category === "unsubscribe" ||
    /\b(unsubscribe|remove me|stop emailing|do not contact|don't contact|no me contactes|no contactar|no me escribas|darme de baja|dame de baja|dejad de escribir|deja de escribirme)\b/.test(
      value,
    )
  )
    return "unsubscribe";
  if (
    /\b(delete my|erase my|personal data|borra mis datos|borrar mis datos|elimina mis datos|datos personales|gdpr|rgpd)\b/.test(
      value,
    )
  )
    return "privacy";
  if (/\b(lawyer|legal|lawsuit|complaint|queja|reclamacion|abogado|demanda)\b/.test(value))
    return "legal";
  if (/\b(price|pricing|discount|precio|precios|descuento|condiciones|payment terms)\b/.test(value))
    return "pricing";
  if (/\b(contract|agreement|contrato|acuerdo contractual)\b/.test(value)) return "contract";
  return null;
}

export function classificationResult(output: unknown, text: string, now: Date) {
  const parsed = CLASSIFICATION_SCHEMA.safeParse(output);
  if (!parsed.success) return null;
  const result = parsed.data;
  const clean = replyText(text);
  if (sensitiveReply(clean, result.category) === "unsubscribe") result.category = "unsubscribe";
  const date =
    result.returnDate && /^\d{4}-\d{2}-\d{2}$/.test(result.returnDate)
      ? new Date(`${result.returnDate}T00:00:00Z`)
      : null;
  if (
    result.category !== "out_of_office" ||
    !date ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== result.returnDate ||
    date <= now ||
    date.getTime() > now.getTime() + 365 * 86400000
  )
    result.returnDate = null;
  const emails =
    clean
      .match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)
      ?.map((e) => e.toLowerCase()) ?? [];
  const name = result.referredName?.trim();
  const email = result.referredEmail?.trim().toLowerCase();
  result.referredName =
    result.category === "wrong_person" &&
    name &&
    name.length <= 120 &&
    normalized(clean).includes(normalized(name))
      ? name
      : null;
  result.referredEmail =
    result.category === "wrong_person" && email && emails.includes(email) ? email : null;
  return result;
}

export const PUBLIC_POSITIONING_FIELDS = [
  "product_name",
  "one_liner",
  "tagline",
  "short_pitch",
  "elevator_pitch",
  "key_benefit",
] as const;
type RecordValue = Record<string, unknown>;
const textValue = (value: unknown) => (typeof value === "string" ? value.slice(0, 4000) : "");
export function publicReplyContext(
  positioning: RecordValue,
  pillars: RecordValue[],
  lead: RecordValue,
) {
  return {
    positioning: Object.fromEntries(
      PUBLIC_POSITIONING_FIELDS.flatMap((key) =>
        typeof positioning[key] === "string" ? [[key, textValue(positioning[key])]] : [],
      ),
    ),
    pillars: pillars.map((p) => ({ title: textValue(p.title), message: textValue(p.message) })),
    contact: {
      firstName: textValue(lead.contact_name).trim().split(/\s+/)[0] ?? "",
      role: textValue(lead.role),
      company: textValue(lead.company_name),
    },
  };
}

/** Rejects normalized 24-character overlaps. Comparisons never enter the model prompt. */
export function draftReview(draft: string, publicContext: unknown, forbidden: string[]) {
  const candidate = normalized(draft);
  const rejected = forbidden.some((value) => {
    const secret = normalized(value);
    if (secret.length < 24) return false;
    for (let i = 0; i <= secret.length - 24; i++)
      if (candidate.includes(secret.slice(i, i + 24))) return true;
    return false;
  });
  if (rejected) return { accepted: false, warnings: [] as string[] };
  const context = normalized(JSON.stringify(publicContext));
  const claims =
    draft.match(
      /https?:\/\/[^\s<>]+|[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b\d+(?:[.,]\d+)*\b/gi,
    ) ?? [];
  return {
    accepted: true,
    warnings: [...new Set(claims.filter((claim) => !context.includes(normalized(claim))))],
  };
}

export function clearExpiredDerived<
  T extends {
    draft: string | null;
    referredName: string | null;
    referredEmail: string | null;
    returnDate: string | null;
  },
>(value: T, createdAt: string, decided: boolean, now: Date): T {
  const created = Date.parse(createdAt);
  if (
    decided ||
    !Number.isFinite(created) ||
    now.getTime() >= created + DERIVED_TTL_DAYS * 86400000
  )
    return { ...value, draft: null, referredName: null, referredEmail: null, returnDate: null };
  return value;
}
