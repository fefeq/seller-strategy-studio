import { createFileRoute, redirect } from "@tanstack/react-router";
import { setupRedirect } from "@/lib/legacy-redirects";

// B1: Configuración now lives inside Onboarding (tab «Completar»); the old address keeps working.
export const Route = createFileRoute("/_authenticated/setup")({
  beforeLoad: () => {
    throw redirect({ ...setupRedirect(), replace: true });
  },
});
