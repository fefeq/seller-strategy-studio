import { Link, useRouterState } from "@tanstack/react-router";
import { flowFor } from "@/lib/flow";

/** «Dónde estás»: the sales flow with the current place marked and one line on what happens here. */
export function FlowStrip() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const pos = flowFor(path);
  if (!pos) return null;
  return (
    <nav aria-label="Flujo de venta" className="mb-5 text-xs text-ink-mid">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {pos.steps.map((s, i) => (
          <li key={s.to} className="flex min-h-11 items-center gap-2 md:min-h-0">
            {i > 0 && <span aria-hidden>→</span>}
            {i === pos.index ? (
              <span aria-current="step" className="font-semibold text-ink">
                {s.label}
              </span>
            ) : (
              <Link
                to={s.to as never}
                className="inline-flex min-h-11 items-center hover:text-ink md:min-h-0"
              >
                {s.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-1">
        {pos.current.what}
        {pos.next && (
          <>
            {" "}
            Después:{" "}
            <Link
              to={pos.next.to as never}
              className="inline-flex min-h-11 items-center underline md:min-h-0"
            >
              {pos.next.label}
            </Link>
            .
          </>
        )}
      </p>
    </nav>
  );
}
