/** CRMs listed in the team's tool plan with no native connection in Nokko yet (today they enter via webhook). */
const NO_NATIVE_CRM = new Set(["hubspot", "pipedrive", "attio", "salesforce"]);

export function comingSoon(name: string): boolean {
  return NO_NATIVE_CRM.has(name.trim().toLowerCase());
}
