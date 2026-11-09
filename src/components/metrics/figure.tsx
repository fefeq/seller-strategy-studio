// A Figure on screen (SDD-20261109-metrics-strategy-no-estimates CA-6, CA-7, CA-13): the number when there is one,
// otherwise «Sin dato · motivo» as a DataMark; never «—», Infinity or a negative payback.
import type { ReactNode } from "react";
import { DataMark } from "@/components/metrics/data-mark";
import { caveatMark, figureMark } from "@/components/metrics/mark-text";

type Fig = { value: number | null; state: string; reason: string | null };

/** The value formatted, or its «Sin dato» mark. */
export function FigureValue({
  f,
  show,
  className,
}: {
  f: Fig;
  show: (n: number) => ReactNode;
  className?: string;
}) {
  if (f.value == null || f.state === "sin_dato") {
    const m = figureMark(f);
    return m ? <DataMark {...m} className={className} /> : null;
  }
  return <span className={className}>{show(f.value)}</span>;
}

/** The «Estimado · …» mark of a figure that has a value (nothing for real, planned or missing ones). */
export function FigureNote({ f, className }: { f: Fig; className?: string }) {
  const m = f.value != null && f.state === "estimado" ? caveatMark(f) : null;
  return m ? <DataMark {...m} className={className} /> : null;
}

/** A planned figure: the value; «sin plan» when nobody typed the plan; otherwise its «Sin dato» mark (margin, ACV). */
export function PlanValue({ f, show }: { f: Fig; show: (n: number) => ReactNode }) {
  if (f.value == null && /^sin (plan|clientes presupuestados)/.test(f.reason ?? ""))
    return <span>sin plan</span>;
  return <FigureValue f={f} show={show} />;
}

/** The value and, beside it, its full mark: «Real», «Estimado · …» or «Sin dato · …» (board figures). */
export function FigureWithMark({ f, show }: { f: Fig; show: (n: number) => ReactNode }) {
  const m = figureMark(f);
  if (f.value == null || f.state === "sin_dato") return m ? <DataMark {...m} /> : null;
  return (
    <>
      {show(f.value)}
      {m && <DataMark {...m} className="block text-xs font-normal" />}
    </>
  );
}
