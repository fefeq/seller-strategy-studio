// AES-256-GCM with WebCrypto (works on workerd). Key: APP_USER_CONNECTION_KEY_SECRET (base64, 32 bytes),
// provisioned by Lovable when an App User Connector client is linked. Stored value: base64(iv|ciphertext+tag).
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key(): Promise<CryptoKey> {
  const raw = process.env["APP_USER_CONNECTION_KEY_SECRET"];
  if (!raw) throw new Error("APP_USER_CONNECTION_KEY_SECRET is not set");
  return crypto.subtle.importKey("raw", unb64(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptConnectionKey(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await key(),
      new TextEncoder().encode(plain),
    ),
  );
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return b64(out);
}

export async function decryptConnectionKey(stored: string): Promise<string> {
  const buf = unb64(stored);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: buf.subarray(0, 12) },
    await key(),
    buf.subarray(12),
  );
  return new TextDecoder().decode(pt);
}
