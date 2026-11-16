// Encrypts credentials a company pastes into Nokko (its PostHog key) before they reach the database:
// AES-GCM with a key derived from INTEGRATION_KEYS_SECRET, read inside each call. Server-only.
const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key() {
  const secret = process.env["INTEGRATION_KEYS_SECRET"];
  if (!secret) throw new Error("Falta la clave de cifrado del servidor. Avisa al equipo de Nokko.");
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function seal(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), enc.encode(plain)),
  );
  return `v1:${b64(iv)}:${b64(ct)}`;
}

export async function open(sealed: string): Promise<string> {
  const [v, iv, ct] = sealed.split(":");
  if (v !== "v1" || !iv || !ct)
    throw new Error("Clave guardada ilegible. Vuelve a conectar la integración.");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv) },
    await key(),
    unb64(ct),
  );
  return new TextDecoder().decode(pt);
}
