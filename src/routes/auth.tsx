import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — GTM Brain" },
      { name: "description", content: "Accede al sistema comercial de tu equipo." },
      { property: "og:title", content: "Entrar — GTM Brain" },
      { property: "og:description", content: "Accede al sistema comercial de tu equipo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/home", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) toast.success("Revisa tu email para confirmar la cuenta.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("No se pudo entrar con Google");
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground md:flex">
        <Link to="/" className="font-display text-2xl">GTM Brain</Link>
        <p className="font-display text-5xl leading-tight">“Primero el sistema, luego el equipo, luego los agentes.”</p>
        <p className="eyebrow text-sidebar-foreground/60">Una sola fuente de verdad</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <h1 className="text-4xl">{mode === "in" ? "Entrar" : "Crear cuenta"}</h1>
          {mode === "up" && (
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          )}
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>Contraseña</Label><Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <Button className="w-full" disabled={busy}>{mode === "in" ? "Entrar" : "Crear cuenta"}</Button>
          <Button type="button" variant="outline" className="w-full" onClick={google}>Continuar con Google</Button>
          <button type="button" className="w-full text-sm text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "¿No tienes cuenta? Créala" : "¿Ya tienes cuenta? Entra"}
          </button>
          <p className="text-xs text-muted-foreground">La primera persona que se registra será la responsable (GTM Owner).</p>
        </form>
      </div>
    </div>
  );
}
