// How a segment acquires customers (segments.acquisition_motion). Not the sales model by ACV (segments.motion, src/lib/metrics.ts):
// the two are different questions and the calculator keeps reading the second one. Null = «sin definir»; nothing is inferred.
export const ACQUISITION_MOTIONS = ["plg", "slg", "marketing", "partner"] as const;
export type AcquisitionMotion = (typeof ACQUISITION_MOTIONS)[number];

export const ACQUISITION_MOTION_LABEL: Record<AcquisitionMotion, string> = {
  plg: "PLG (producto)",
  slg: "SLG (venta asistida)",
  marketing: "Marketing",
  partner: "Partners",
};

export const NO_ACQUISITION_MOTION = "sin definir";

/** Reads a stored value; anything outside the closed set counts as undefined, never as another motion. */
export function readAcquisitionMotion(v: unknown): AcquisitionMotion | null {
  return typeof v === "string" && (ACQUISITION_MOTIONS as readonly string[]).includes(v) ? (v as AcquisitionMotion) : null;
}

export function acquisitionMotionText(v: unknown): string {
  const m = readAcquisitionMotion(v);
  return m ? ACQUISITION_MOTION_LABEL[m] : NO_ACQUISITION_MOTION;
}
