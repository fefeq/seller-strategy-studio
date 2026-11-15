// E3: secrets never travel through the chat. A message that looks like an API key, token or password is refused
// before it is stored or sent to the model; the user is sent to Conexiones instead. Pure, tested.

const PATTERNS: RegExp[] = [
  /\bsk-(?:proj-|ant-|or-v1-)?[A-Za-z0-9_-]{20,}/, // OpenAI / Anthropic / OpenRouter
  /\b(?:sb_secret|sk_live|sk_test|rk_live|whsec|phx|phc)_[A-Za-z0-9]{16,}/, // Supabase secret, Stripe, PostHog
  /\bAIza[0-9A-Za-z_-]{30,}/, // Google API key
  /\bya29\.[0-9A-Za-z_-]{20,}/, // Google OAuth access token
  /\b(?:ghp|gho|github_pat|xox[bpas])_[A-Za-z0-9_]{20,}/, // GitHub, Slack
  /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/, // Resend
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:api[_ -]?key|token|secret|contraseña|password|clave)\s*[:=]\s*\S{12,}/i,
];

/** True when the text carries something that looks like a credential. */
export function looksLikeSecret(text: string): boolean {
  return PATTERNS.some((p) => p.test(text));
}

export const SECRET_REFUSAL =
  "No he guardado ese mensaje: parece contener una clave o contraseña, y en el chat nunca deben aparecer secretos. " +
  "Si quieres conectar un servicio, hazlo en Ajustes › Conexiones (/integrations): ahí la clave queda guardada sin pasar por el agente. " +
  "Si la clave era real, te recomiendo cambiarla en el servicio de origen.";
