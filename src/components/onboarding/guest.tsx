import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { useSetup } from "@/hooks/use-setup";
import { NoticePrefsCard } from "@/components/notice-prefs";
import { ROLES, type Role } from "@/lib/roles";

/** Short onboarding for invited members: their role, how they want to hear from Nokko and the approved strategy. */
export function GuestOnboarding({ onDone }: { onDone: () => void }) {
  const { data: me } = useMe();
  const { data: st } = useSetup();
  const role = (me?.roles[0] ?? "ae") as Role;
  const d = st?.data;
  return (
    <div className="space-y-10">
      <section className="border-t-2 border-hairline-firm pt-4">
        <p className="smallcaps text-ink-mid">Tu rol en {me?.currentOrg?.name}</p>
        <h2 className="mt-1 font-display text-3xl">{ROLES[role]?.label ?? role}</h2>
      </section>
      <section className="border-t-2 border-hairline-firm pt-4">
        <p className="smallcaps text-ink-mid">La estrategia aprobada</p>
        {d?.positioning?.one_liner ? (
          <p className="mt-2 text-lg">{d.positioning.one_liner}</p>
        ) : (
          <p className="mt-2 text-ink-mid">Tu equipo aún está terminando la estrategia.</p>
        )}
        {!!d?.segments.length && (
          <p className="mt-2 text-sm">
            <span className="smallcaps text-ink-mid">Segmentos</span>{" "}
            {d.segments.map((s) => s.name).join(" · ")}
          </p>
        )}
        {!!d?.pillars.length && (
          <p className="mt-1 text-sm">
            <span className="smallcaps text-ink-mid">Mensajes</span>{" "}
            {d.pillars.map((p) => p.title).join(" · ")}
          </p>
        )}
        <Link to="/strategy" className="mt-2 inline-block text-sm underline underline-offset-2">
          Ver la estrategia completa
        </Link>
      </section>
      <section className="border-t-2 border-hairline-firm pt-4">
        <p className="smallcaps text-ink-mid">Tus preferencias</p>
        <div className="mt-3">
          <NoticePrefsCard />
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/connect">Conectar asistentes de IA y Telegram</Link>
        </Button>
        <Button asChild onClick={onDone}>
          <Link to="/home">Ir a Inicio</Link>
        </Button>
      </div>
    </div>
  );
}
