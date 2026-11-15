import { Link } from "@tanstack/react-router";

/** B1: two views of one place — the guided onboarding and «Completar» (the former Configuración, /setup). */
export function OnboardingViews({ completar = false }: { completar?: boolean }) {
  const cls = (on: boolean) =>
    `rounded-md border px-3 py-1.5 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`;
  return (
    <nav aria-label="Vistas de onboarding" className="mb-6 flex flex-wrap gap-2">
      <Link to="/onboarding" className={cls(!completar)}>
        Onboarding guiado
      </Link>
      <Link to="/onboarding/completar" className={cls(completar)}>
        Completar con IA, entrevista o formulario
      </Link>
    </nav>
  );
}
