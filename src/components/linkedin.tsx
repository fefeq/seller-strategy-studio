import { NativeSelect } from "@/components/native-select";
// Apify on the screens: open job offers of an account and battlecards written from competitors' G2 reviews.
import { useState } from "react";
import { BackgroundButton } from "@/components/background";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AiText } from "@/components/ai-text";
import { errorText } from "@/lib/errors";
import { ageText } from "@/lib/web-research";
import { accountJobs, battlecardFromReviews } from "@/lib/apify.functions";
import { useLinkedinLegalPause } from "@/hooks/use-linkedin-legal";
import { LINKEDIN_PAUSE_TEXT } from "@/lib/linkedin-legal";

type Jobs = Awaited<ReturnType<typeof accountJobs>>;

/** All open job offers of the account on LinkedIn (last 30 days), on request: each look spends Apify balance. */
export function AccountJobs({ accountId }: { accountId: string }) {
  const run = useServerFn(accountJobs);
  const { paused } = useLinkedinLegalPause();
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Jobs | null>(null);
  async function go() {
    setBusy(true);
    try {
      setR(await run({ data: { accountId } }));
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Ofertas de empleo en LinkedIn</p>
        {paused ? (
          <span className="rounded bg-warning/25 px-1.5 font-mono text-xs uppercase">En pausa</span>
        ) : (
          <Button size="sm" variant="outline" onClick={go} disabled={busy}>
            {busy ? "Buscando ofertas…" : r ? "Volver a buscar" : "Ver ofertas abiertas"}
          </Button>
        )}
      </div>
      {paused && (
        <p className="text-sm text-muted-foreground">
          {LINKEDIN_PAUSE_TEXT}. La extracción de LinkedIn está detenida hasta completar la revisión
          legal; las fuentes ya guardadas se conservan.
        </p>
      )}
      {r &&
        (r.jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin ofertas publicadas en LinkedIn en los últimos 30 días.
          </p>
        ) : (
          <ul className="divide-y border-t">
            {r.jobs.map((j) => (
              <li key={j.url} className="py-2.5 text-sm">
                <a href={j.url} target="_blank" rel="noreferrer" className="font-medium underline">
                  {j.title}
                </a>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {[j.location, j.level, j.date ? ageText(j.date) : ""].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

type Card = Awaited<ReturnType<typeof battlecardFromReviews>>;

/** Hub › Objeciones: reads a competitor's recent G2 reviews and drafts a battlecard to review and save. */
export function BattlecardFromReviews({ onSaved }: { onSaved: (docId: string) => void }) {
  const run = useServerFn(battlecardFromReviews);
  const [open, setOpen] = useState(false);
  const [competitor, setCompetitor] = useState("");
  const [max, setMax] = useState(20);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  async function go() {
    setBusy(true);
    setCard(null);
    try {
      setCard(await run({ data: { competitor: competitor.trim(), max } }));
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!card) return;
    const { data, error } = await supabase
      .from("knowledge_docs")
      .insert({ section: "objections", title: card.title, body: card.markdown, scope: "team" })
      .select("id")
      .single();
    if (error) return toast.error(errorText(error));
    toast.success(`«${card.title}» guardada en Objeciones y battlecards.`);
    setOpen(false);
    setCard(null);
    setCompetitor("");
    onSaved(data.id);
  }
  return (
    <>
      <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        Battlecard desde reseñas de G2
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!busy) setOpen(o);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader className="text-left">
            <DialogTitle>Battlecard desde reseñas de G2</DialogTitle>
            <DialogDescription>
              Nokko lee las reseñas más recientes del competidor en G2 y redacta la battlecard con
              citas y enlaces, usando tu posicionamiento. Revísala antes de guardarla.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (competitor.trim().length >= 2) go();
            }}
          >
            <Input
              className="min-w-0 flex-1"
              placeholder="Competidor (p. ej. Pipedrive) o su enlace de G2"
              value={competitor}
              onChange={(e) => setCompetitor(e.target.value)}
            />
            <NativeSelect
              aria-label="Reseñas a leer"
              value={max}
              onChange={(e) => setMax(Number(e.target.value))}
            >
              {[10, 20, 40].map((n) => (
                <option key={n} value={n}>
                  {n} reseñas
                </option>
              ))}
            </NativeSelect>
            <Button type="submit" disabled={busy || competitor.trim().length < 2}>
              {busy ? "Leyendo reseñas…" : "Leer y redactar"}
            </Button>
            <BackgroundButton
              disabled={busy || competitor.trim().length < 2}
              label="En segundo plano (se guarda sola)"
              job={() => ({
                kind: "battlecard",
                input: { competitor: competitor.trim(), max },
                label: `Battlecard de ${competitor.trim()}`,
              })}
              onStarted={() => {
                setOpen(false);
                setCompetitor("");
              }}
            />
          </form>
          <p className="text-xs text-muted-foreground">
            Gasta saldo de Apify: unos 0,06 $ por cada 10 reseñas. Tarda menos de un minuto.
          </p>
          {card && (
            <div className="space-y-3 border-t pt-4">
              <p className="eyebrow">
                {card.product.name} · {card.count} reseñas
                {card.average !== null ? ` · ${card.average.toLocaleString("es-ES")}/5` : ""}
              </p>
              <AiText>{card.markdown}</AiText>
              <div className="flex flex-wrap gap-2">
                <Button onClick={save}>Guardar en Objeciones y battlecards</Button>
                <Button variant="ghost" onClick={() => setCard(null)}>
                  Descartar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
