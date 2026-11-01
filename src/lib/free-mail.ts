/** Webmail domains never identify a company. One list for leads, lead flow, qualification and product usage. */
export const FREE_MAIL_DOMAINS: ReadonlySet<string> = new Set(["gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com", "yahoo.com", "yahoo.es", "icloud.com", "me.com", "proton.me", "protonmail.com", "aol.com", "gmx.com", "msn.com"]);

export function isFreeMail(domain: string | null | undefined): boolean {
  return !!domain && FREE_MAIL_DOMAINS.has(domain.trim().toLowerCase());
}
