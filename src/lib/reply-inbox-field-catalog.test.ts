import { describe, expect, it } from "vitest";
import { bindingOf, conceptById } from "./field-catalog";

const fields = {
  inbox_replies: ["classify_status"],
  inbox_reply_derived: [
    "brake", "category", "confidence", "created_at", "draft", "expires_at", "org_id",
    "proposal", "referred_email", "referred_name", "reply_id", "return_date", "state", "user_id",
  ],
  inbox_reply_receipts: [
    "cost_usd", "created_at", "id", "input_tokens", "operation", "org_id", "outcome", "output_tokens",
  ],
};

describe("Ola 0: los 23 campos autorizados de la bandeja", () => {
  it("registra los 23 con concepto y persistencia, sin ampliar el baseline", () => {
    expect(Object.values(fields).flat()).toHaveLength(23);
    for (const [table, columns] of Object.entries(fields)) {
      for (const column of columns) {
        const binding = bindingOf(table, column);
        expect(binding, `${table}.${column}`).not.toBeNull();
        if (!binding) throw new Error(`Falta ${table}.${column}`);
        expect(conceptById(binding.concept).id).toBe(binding.concept);
        expect(binding.persistence).toBe("permanent");
      }
    }
  });

  it("mantiene el coste medido en USD separado de importes en moneda de empresa", () => {
    expect(bindingOf("inbox_reply_receipts", "cost_usd")).toMatchObject({
      concept: "coste_ia_usd", persistence: "permanent",
    });
  });
});