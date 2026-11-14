import { Link } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { usePrimaryLine } from "@/hooks/use-business-lines";

/** One line naming the primary business line and its archetype; screens read the archetype from here. */
export function PrimaryLineNote({ className = "" }: { className?: string }) {
  const { data: me } = useMe();
  const leader = !!me?.roles.some((r) => r === "owner" || r === "sales_leader");
  const { primary, isLoading, error } = usePrimaryLine(me?.currentOrg?.org_id);
  if (isLoading || error) return null;
  if (!primary)
    return leader ? (
      <p className={`text-sm text-ink-mid ${className}`}>
        Aún no hay línea de negocio principal.{" "}
        <Link to="/onboarding" className="underline underline-offset-2">Defínela</Link> para adaptar la estrategia a tu arquetipo.
      </p>
    ) : null;
  return (
    <p className={`text-sm text-ink-mid ${className}`}>
      <span className="smallcaps">Línea principal</span> {primary.label} · arquetipo {primary.result.archetype}, {primary.result.name}
      {primary.extra > 0 && <> · {primary.extra === 1 ? "1 línea más" : `${primary.extra} líneas más`}</>}
      {leader && <> · <Link to="/onboarding" className="underline underline-offset-2">Editar líneas</Link></>}
    </p>
  );
}
