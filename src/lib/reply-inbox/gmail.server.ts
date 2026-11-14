// NK-0174 SDD 1 R-3: the only module that talks to Gmail. Read-only, closed operation list.
// Uses the builder's Gmail connection (Fede's mailbox) through the connector gateway; no tokens stored.
import { chunkIds, type GmailOperation } from "./rules";

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

export function gmailConfigured(): boolean {
  return !!process.env["LOVABLE_API_KEY"] && !!process.env["GOOGLE_MAIL_API_KEY"];
}

async function call<T>(op: GmailOperation, path: string): Promise<T> {
  if (!gmailConfigured()) throw new Error("Gmail no está conectado en este proyecto.");
  const res = await fetch(`${GATEWAY}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
      "X-Connection-Api-Key": process.env["GOOGLE_MAIL_API_KEY"]!,
    },
  });
  if (!res.ok) {
    console.error(`gmail ${op} failed [${res.status}]`);
    throw new Error(`Gmail no respondió (${res.status}). Prueba de nuevo en unos minutos.`);
  }
  return (await res.json()) as T;
}

export const gmail = {
  profile: () => call<{ emailAddress: string }>("profile", "/users/me/profile"),
  listMessages: (q: string, max = 50) =>
    call<{ messages?: { id: string; threadId: string }[] }>(
      "listMessages",
      `/users/me/messages?maxResults=${Math.min(max, 100)}&q=${encodeURIComponent(q)}`,
    ),
  async getMetadata(ids: string[]) {
    const out: unknown[] = [];
    // SDD 2 may swap this for multipart batch; kept sequential and capped for phase 1 volumes.
    for (const chunk of chunkIds(ids))
      for (const id of chunk)
        out.push(
          await call(
            "getMetadata",
            `/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=In-Reply-To&metadataHeaders=Auto-Submitted`,
          ),
        );
    return out;
  },
  getBody: (id: string) => call("getBody", `/users/me/messages/${encodeURIComponent(id)}?format=full`),
};
