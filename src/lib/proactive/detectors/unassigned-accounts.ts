import type { Detector } from "../types";
import { isEligible } from "@/lib/assignment";

/**
 * Accounts without owner while at least two people could take them → propose the assignment. The key
 * follows the newest unowned account, so a dismissed reminder comes back only when new ones arrive.
 * Addressed to the Owner (Sales Leader if there is none): they approve it.
 */
export const unassignedAccounts: Detector = (s) => {
  const members = s.members ?? [];
  if (members.filter((m) => isEligible(m.role)).length < 2) return [];
  const unowned = s.accounts.filter((a) => !a.owner_id);
  if (!unowned.length) return [];
  const newest = [...unowned].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "") || b.id.localeCompare(a.id))[0];
  const approver = members.find((m) => m.role === "owner") ?? members.find((m) => m.role === "sales_leader");
  const n = unowned.length;
  return [{
    detector: "unassigned_accounts",
    dedupe_key: `unassigned_accounts:${newest.id}`,
    priority: 2,
    title: n === 1 ? "1 cuenta sin responsable" : `${n} cuentas sin responsable`,
    body: "Nadie las trabaja. Propón el reparto: aplico tus reglas, equilibro la carga por tier y tú apruebas quién lleva cada una.",
    link: "/accounts/assignment",
    action: null,
    user_id: approver?.user_id ?? null,
  }];
};
