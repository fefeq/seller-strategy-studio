// «Tu ICP» on Descubiertos: each current ICP, what Nokko searches with it each week, what it is missing,
// and how many companies and contacts it brought that are waiting for a decision. Clicking one filters the list.
import { Link } from "@tanstack/react-router";
import { employeesText, icpReadiness, LEVEL_LABEL, type Icp, type Level } from "@/lib/icp";
import { PER_ICP } from "@/lib/discoveries";

export type IcpRow = Icp & { id: string; name: string };

export function IcpPanel({ icps, tally, selected, onSelect }: {
  icps: IcpRow[];
  tally: Map<string, { company: number; contact: number }>;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (!icps.length) {
    return (
      <section className="mb-8 border-t pt-4">
        <p className="eyebrow">Tu ICP</p>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Aún no tienes ningún ICP. Sin él, Nokko no sabe qué empresas ni qué personas buscar cada semana.{" "}
          <Link to="/strategy" search={{ tab: "icp" }} className="text-signal">Definir mi ICP</Link>
        </p>
      </section>
    );
  }
  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">Tu ICP · cada semana, hasta {PER_ICP.company} empresas y {PER_ICP.contact} contactos por perfil</p>
        <div className="flex gap-4 text-sm">
          {selected && <button type="button" className="text-signal" onClick={() => onSelect(null)}>Ver todos</button>}
          <Link to="/strategy" search={{ tab: "icp" }} className="text-signal">Editar ICP</Link>
        </div>
      </div>
      <ul className="mt-2 grid gap-x-8 md:grid-cols-2 xl:grid-cols-3">
        {icps.map((icp) => {
          const t = tally.get(icp.id) ?? { company: 0, contact: 0 };
          const checks = icpReadiness(icp);
          const search = checks.find((c) => c.id === "search");
          const people = checks.find((c) => c.id === "people");
          const titles = (icp.target_titles ?? []).filter(Boolean);
          const levels = (icp.seniorities ?? []).map((l) => LEVEL_LABEL[l as Level] ?? l);
          const facts = [icp.industries?.trim(), employeesText(icp.min_employees, icp.max_employees) ?? icp.company_size?.trim(), (icp.countries ?? []).join(", ") || icp.geography?.trim()].filter(Boolean);
          const on = selected === icp.id;
          return (
            <li key={icp.id} className="border-t py-4">
              <button type="button" onClick={() => onSelect(on ? null : icp.id)} className="w-full text-left" aria-pressed={on}>
                <p className="text-lg font-medium">{icp.name}{on && <span className="ml-2 font-mono text-[11px] text-muted-foreground">FILTRANDO</span>}</p>
                <p className="break-words text-sm text-muted-foreground">{facts.join(" · ") || "Sin sector, tamaño ni países todavía"}</p>
                <p className="mt-1 text-sm">Contactos: {titles.length ? titles.slice(0, 4).join(", ") : levels.length ? levels.join(", ") : "niveles de decisión por defecto"}</p>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  POR REVISAR · {t.company} {t.company === 1 ? "empresa" : "empresas"} · {t.contact} {t.contact === 1 ? "contacto" : "contactos"}
                </p>
              </button>
              {(search && !search.ready) || (people && !people.ready) ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Para buscar mejor le falta: {[search && !search.ready && search.missing, people && !people.ready && "cargos a contactar"].filter(Boolean).join(", ")}.{" "}
                  <Link to="/strategy" search={{ tab: "icp" }} className="text-signal">Completar</Link>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
