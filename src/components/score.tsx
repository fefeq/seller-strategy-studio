import { BAND_LABEL, fitText, type Score } from "@/lib/scoring";

const TONE: Record<Score["band"], string> = {
  alto: "bg-signal/15 text-signal",
  medio: "bg-muted text-ink",
  bajo: "bg-muted text-muted-foreground",
  sin_datos: "border border-dashed text-muted-foreground",
};

/** Compact total (fit 70 % + activity 30 %) for lists and cards. */
export function ScoreBadge({ score, className = "" }: { score: Score; className?: string }) {
  const title = `${BAND_LABEL[score.band]} · encaje ${score.fit.score ?? "—"} · actividad ${score.activity}`;
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs ${TONE[score.band]} ${className}`}>
      {score.total == null ? "—" : score.total}
    </span>
  );
}

/** The score with its reasons, for detail views. */
export function ScoreDetail({ score }: { score: Score }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Puntuación</p>
        <p className="font-display text-3xl">{score.total ?? "—"}<span className="ml-2 text-sm text-muted-foreground">{BAND_LABEL[score.band]}</span></p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Encaje con el ICP {score.fit.score ?? "—"} (70 %) · actividad {score.activity} (30 %)</p>
      <p className="mt-2 text-sm">{fitText(score.fit)}</p>
      {score.fit.criteria.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {score.fit.criteria.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span className={`w-4 shrink-0 font-mono ${c.status === "match" ? "text-signal" : "text-muted-foreground"}`}>{c.status === "match" ? "✓" : c.status === "miss" ? "✗" : "·"}</span>
              <span><span className="font-medium">{c.label}</span> <span className="text-muted-foreground">{c.note}</span></span>
            </li>
          ))}
        </ul>
      )}
      {score.fit.score == null && <p className="mt-2 text-xs text-muted-foreground">Define el ICP en Estrategia y el segmento, sector y tamaño de la cuenta para medir el encaje.</p>}
    </div>
  );
}
