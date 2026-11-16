// D3: page the recovery email lands on. Public route; sets the new password with updateUser (no current password on recovery).
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Lockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorText } from "@/lib/errors";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Cambiar contraseña — Nokko" },
      { name: "description", content: "Elige una contraseña nueva para tu cuenta de Nokko." },
      { property: "og:title", content: "Cambiar contraseña — Nokko" },
      {
        property: "og:description",
        content: "Elige una contraseña nueva para tu cuenta de Nokko.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setReady(true);
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(errorText(error));
    toast.success("Contraseña cambiada.");
    navigate({ to: "/home", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <Link to="/" aria-label="Nokko" className="mb-8 inline-block">
          <Lockup />
        </Link>
        <h1 className="lede-m">Cambiar contraseña</h1>
        {!ready ? (
          <p className="text-sm text-muted-foreground">
            Abre esta página desde el enlace del email de recuperación. Si ha caducado, pide otro en{" "}
            <Link to="/auth" className="underline underline-offset-4">
              Entrar
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Contraseña nueva</Label>
              <div className="flex gap-2">
                <Input
                  id="new-password"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 shrink-0"
                  aria-pressed={show}
                  onClick={() => setShow(!show)}
                >
                  {show ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
            </div>
            <Button className="w-full" disabled={busy}>
              Guardar contraseña
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
