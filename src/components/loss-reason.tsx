// Why a deal was lost and against whom (SDD-20261027 strategic-suggestions-engine, F0 · H-2). Nothing here is mandatory:
// leaving it empty saves the deal as lost with «sin dato» (CA-10). Rules and the list live in src/lib/loss-reasons.ts.
import { X } from "lucide-react";
import { IconText } from "@/components/icon-text";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field, Pick } from "@/components/fields";
import { errorText } from "@/lib/errors";
import {
  competitorFromMeddpicc,
  LOSS_REASONS,
  lossLabel,
  MAX_COMPETITOR,
  MAX_DETAIL,
  parseLoss,
  type LossPatch,
} from "@/lib/loss-reasons";

type LossDeal = {
  id: string;
  name: string;
  meddpicc?: unknown;
  lost_reason?: string | null;
  lost_reason_detail?: string | null;
  lost_competitor?: string | null;
};
type Form = { reason: string; detail: string; competitor: string };

const REASON_OPTIONS: Record<string, string> = {
  "": "Sin dato",
  ...Object.fromEntries(LOSS_REASONS.map((r) => [r.key, r.label])),
};

const fromDeal = (d: LossDeal, proposeCompetitor: boolean): Form => ({
  reason: d.lost_reason ?? "",
  detail: d.lost_reason_detail ?? "",
  competitor:
    d.lost_competitor ??
    (proposeCompetitor
      ? (competitorFromMeddpicc(d.meddpicc as Record<string, unknown> | null) ?? "")
      : ""),
});

function LossFields({ form, onChange }: { form: Form; onChange: (f: Form) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Motivo de pérdida">
        <Pick
          value={form.reason}
          options={REASON_OPTIONS}
          onChange={(reason) => onChange({ ...form, reason })}
          aria-label="Motivo de pérdida"
        />
      </Field>
      <Field label="Texto libre (opcional)">
        <Textarea
          rows={2}
          maxLength={MAX_DETAIL}
          value={form.detail}
          onChange={(e) => onChange({ ...form, detail: e.target.value })}
          placeholder="Qué pasó, con tus palabras"
        />
      </Field>
      <Field label="Competidor (opcional)">
        <Input
          maxLength={MAX_COMPETITOR}
          value={form.competitor}
          onChange={(e) => onChange({ ...form, competitor: e.target.value })}
          placeholder="Contra quién se perdió"
        />
      </Field>
    </div>
  );
}

/**
 * Opens when a deal moves into «Perdido» (CA-8). «Guardar» stores what was filled in; «Omitir» marks the deal lost without
 * a reason, which counts as «sin dato» (CA-10). «Cancelar» leaves the deal where it was.
 */
export function LossDialog({
  deal,
  onDone,
  onCancel,
}: {
  deal: LossDeal | null;
  onDone: (patch: LossPatch | null) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Form>({ reason: "", detail: "", competitor: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (deal) setForm(fromDeal(deal, true));
  }, [deal?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function submit(skip: boolean) {
    let patch: LossPatch | null = null;
    if (!skip) {
      const parsed = parseLoss({
        reason: form.reason,
        detail: form.detail,
        competitor: form.competitor,
      });
      if (!parsed.ok) return toast.error(parsed.error);
      patch = parsed.patch;
    }
    setBusy(true);
    try {
      await onDone(patch);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AlertDialog
      open={!!deal}
      onOpenChange={(o) => {
        if (!o && !busy) onCancel();
      }}
    >
      {deal && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como perdido: {deal.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Cuéntanos por qué se perdió para que Nokko lo tenga en cuenta. No es obligatorio:
              puedes completarlo más tarde desde el deal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <LossFields form={form} onChange={setForm} />
          <AlertDialogFooter className="flex-wrap gap-2 sm:flex-wrap sm:gap-2">
            <Button variant="ghost" disabled={busy} onClick={onCancel}>
              <IconText icon={X}>Cancelar</IconText>
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void submit(true)}>
              Omitir y marcar como perdido
            </Button>
            <Button disabled={busy} onClick={() => void submit(false)}>
              Guardar y marcar como perdido
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}

/** In the detail of a deal that is already lost: complete or fix the reason and the competitor (CA-9), never forced. */
export function LossSection({ deal, onSaved }: { deal: LossDeal; onSaved: () => void }) {
  const [form, setForm] = useState<Form>(() => fromDeal(deal, true));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setForm(fromDeal(deal, true));
  }, [deal.id, deal.lost_reason, deal.lost_reason_detail, deal.lost_competitor]); // eslint-disable-line react-hooks/exhaustive-deps
  const saved = fromDeal(deal, false);
  const dirty =
    form.reason !== saved.reason ||
    form.detail !== saved.detail ||
    form.competitor !== saved.competitor;
  async function save() {
    const parsed = parseLoss(form);
    if (!parsed.ok) return toast.error(parsed.error);
    setBusy(true);
    const { error } = await supabase.from("deals").update(parsed.patch).eq("id", deal.id);
    setBusy(false);
    if (error) return toast.error(errorText(error));
    toast.success("Motivo de pérdida guardado.");
    onSaved();
  }
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <h3 className="text-2xl">Motivo de pérdida</h3>
        <p className="text-xs text-muted-foreground">
          {deal.lost_reason ? lossLabel(deal.lost_reason) : "Sin dato"}
          {deal.lost_competitor ? ` · ${deal.lost_competitor}` : ""}. Es opcional; completarlo ayuda
          a ver por qué pierdes y contra quién.
        </p>
      </div>
      <LossFields form={form} onChange={setForm} />
      <Button size="sm" disabled={busy || !dirty} onClick={() => void save()}>
        Guardar motivo
      </Button>
    </div>
  );
}
