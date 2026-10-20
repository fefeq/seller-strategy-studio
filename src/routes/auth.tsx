import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Lockup } from "@/components/brand";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { errorText } from "@/lib/errors";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => (typeof s.next === "string" ? { next: s.next } : {}),
  head: () => ({
    meta: [
      { title: "Entrar — Nokko" },
      { name: "description", content: "Accede al sistema comercial de tu equipo." },
      { property: "og:title", content: "Entrar — Nokko" },
      { property: "og:description", content: "Accede al sistema comercial de tu equipo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next: rawNext } = Route.useSearch();
  // Validated once; external assistants send users back to the consent page through this.
  const next = rawNext ? oauthReturnPath(rawNext) : null;
  const goOn = () => (next ? window.location.assign(next) : navigate({ to: "/home", replace: true }));
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goOn();
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) goOn();
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: next ? new URL(next, window.location.origin).href : window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) toast.success("Revisa tu email para confirmar la cuenta.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(errorText(err, "No se ha podido continuar. Inténtalo de nuevo."));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" + (next ? `?next=${encodeURIComponent(next)}` : "") });
    if (r.error) toast.error("No se pudo entrar con Google.");
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between border-r-2 border-hairline-firm bg-paper-edge p-12 md:flex">
        <Link to="/" aria-label="Nokko"><Lockup /></Link>
        <div>
          <div className="rule-major mb-6 w-24" />
          <p className="lede-l measure-lede">Primero el sistema, luego el equipo, luego los agentes.</p>
        </div>
        <p className="kicker">Una sola fuente de verdad</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <Link to="/" aria-label="Nokko" className="mb-8 inline-block md:hidden"><Lockup /></Link>
          <h1 className="lede-m">{mode === "in" ? "Entrar" : "Crear cuenta"}</h1>
          {mode === "up" && (
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          )}
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>Contraseña</Label><Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <Button className="w-full" disabled={busy}>{mode === "in" ? "Entrar" : "Crear cuenta"}</Button>
          <Button type="button" variant="outline" className="w-full" onClick={google}>Continuar con Google</Button>
          <button type="button" className="w-full py-2 text-sm text-ink underline decoration-hairline-firm underline-offset-4" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "¿No tienes cuenta? Créala" : "¿Ya tienes cuenta? Entra"}
          </button>
          <p className="note">Al entrar podrás crear tu empresa o unirte a las que te hayan invitado.</p>
        </form>
      </div>
    </div>
  );
}
