// From gtm-lab@44f385b packages/core/src/ice.ts
export interface IceInput {
  impact: number;
  confidence: number;
  ease: number;
}

export interface BacklogItem extends IceInput {
  /** ISO date; breaks ties, oldest first. */
  createdAt: string;
}

const MIN = 1;
const MAX = 10;

export function iceScore(input: IceInput): number {
  for (const key of ["impact", "confidence", "ease"] as const) {
    const value = input[key];
    if (!Number.isInteger(value) || value < MIN || value > MAX) {
      throw new RangeError(`${key} debe ser un entero entre ${MIN} y ${MAX}; recibido ${value}`);
    }
  }
  return (input.impact + input.confidence + input.ease) / 3;
}

export function rankBacklog<T extends BacklogItem>(items: readonly T[]): T[] {
  return items
    .map((item) => ({ item, score: iceScore(item) }))
    .sort(
      (a, b) => b.score - a.score || Date.parse(a.item.createdAt) - Date.parse(b.item.createdAt),
    )
    .map(({ item }) => item);
}
