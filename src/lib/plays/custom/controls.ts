import { canTogglePlays } from "../status";

export function checkCustomControl(
  roles: string[],
  status: string,
  pause: string | null,
  enable: boolean,
) {
  const role = canTogglePlays(roles);
  if (!role.ok)
    return { ok: false as const, reason: role.reason ?? "No puedes modificar este play." };
  if (status === "archivado") return { ok: false as const, reason: "Este play está archivado." };
  if (enable && pause)
    return {
      ok: false as const,
      reason:
        "Hay una pausa de seguridad. Revisa la ejecución y resuelve el bloqueo antes de activar.",
    };
  return { ok: true as const };
}

export function activationPatch(enabled: boolean, first: string | null, now: string) {
  return {
    status: enabled ? "activo" : "pausado",
    first_activated_at: enabled ? (first ?? now) : first,
    updated_at: now,
  };
}

export function resultPatch(sample: number, successes: number, now: string) {
  if (!Number.isInteger(sample) || sample <= 0)
    throw new Error("La muestra debe ser un entero mayor que cero.");
  if (!Number.isInteger(successes) || successes < 0 || successes > sample)
    throw new Error("Los éxitos deben ser un entero entre cero y la muestra.");
  return { test_sample: sample, test_successes: successes, test_recorded_at: now, updated_at: now };
}
