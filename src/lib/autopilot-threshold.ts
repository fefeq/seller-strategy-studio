/** A zero, invalid or unknown estimate always requires a person's decision. */
export function autopilotDecision(cost: number | null, threshold: number): "execute" | "propose" {
  return cost !== null &&
    Number.isFinite(cost) &&
    cost >= 0 &&
    Number.isFinite(threshold) &&
    threshold > 0 &&
    cost <= threshold
    ? "execute"
    : "propose";
}
export const canChangeThreshold = (roles: string[]) =>
  roles.some((r) => r === "owner" || r === "sales_leader");

/** Reserve first, including pending work; only a newly reserved allowed action may run. */
export async function runAutopilotAction(
  cost: number | null,
  threshold: number,
  ports: {
    propose: () => Promise<string | null>;
    execute: (id: string) => Promise<unknown>;
  },
) {
  const id = await ports.propose();
  if (!id) return "existing";
  if (autopilotDecision(cost, threshold) === "propose") return "pending";
  await ports.execute(id);
  return "executed";
}
