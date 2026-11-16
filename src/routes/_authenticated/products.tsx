import { createFileRoute } from "@tanstack/react-router";
import { duplicateOf } from "@/lib/match";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, useMe } from "@/hooks/use-me";
import { Page } from "@/components/page";
import { Field, Pick } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { errorText } from "@/lib/errors";
import { confirmed } from "@/lib/save";
import { useProducts } from "@/components/deal-lines";
import {
  BILLING_LABELS,
  BILLING_SUFFIX,
  checkLineField,
  productMarginPct,
  type Billing,
  type Product,
} from "@/lib/deal-lines";
import { askConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Productos — Nokko" },
      {
        name: "description",
        content: "Catálogo de productos con precio, coste y margen para las líneas de cada deal.",
      },
      { property: "og:title", content: "Productos — Nokko" },
      {
        property: "og:description",
        content: "Catálogo de productos con precio, coste y margen para las líneas de cada deal.",
      },
    ],
  }),
  component: Products,
});

const EMPTY = { name: "", price: "", cost: "", billing: "annual" as Billing };

function Products() {
  const qc = useQueryClient();
  const { money, symbol } = useCurrency();
  const { data: me } = useMe();
  const canEdit = (me?.roles ?? []).some(
    (r) => r === "owner" || r === "sales_leader" || r === "deal_desk",
  );
  const { data: products = [], isLoading } = useProducts();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  // Bumped when a save fails, so the fields go back to what the server has.
  const [rev, setRev] = useState(0);

  async function save(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["products"] });
      return true;
    } catch (e) {
      toast.error(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!f.name.trim()) return toast.error("El producto necesita un nombre.");
    const dup = duplicateOf(
      { name: f.name },
      products.map((p) => ({ id: p.id, name: p.name })),
    );
    if (
      dup &&
      !(await askConfirm(`Ya existe «${dup.item.name}» en el catálogo`, {
        body: "¿Añadir otro producto igualmente?",
        confirmLabel: "Añadir igualmente",
      }))
    )
      return;
    const price = checkLineField("price", f.price);
    const cost = checkLineField("cost", f.cost);
    if (!price.ok) return toast.error(price.error);
    if (!cost.ok) return toast.error(cost.error);
    const ok = await save(
      () =>
        confirmed(
          supabase
            .from("products")
            .insert({
              name: f.name.trim(),
              price: price.value ?? 0,
              cost: cost.value,
              billing: f.billing,
            })
            .select("id"),
        ),
      `«${f.name.trim()}» añadido al catálogo.`,
    );
    if (ok) setF(EMPTY);
  }

  async function update(
    p: Product,
    patch: Partial<Record<"name" | "price" | "cost" | "billing" | "active", unknown>>,
  ) {
    if (
      !(await save(() =>
        confirmed(
          supabase
            .from("products")
            .update(patch as never)
            .eq("id", p.id)
            .select("id"),
        ),
      ))
    )
      setRev((r) => r + 1);
  }
  function numField(p: Product, field: "price" | "cost", input: HTMLInputElement) {
    const cur = p[field] == null ? null : Number(p[field]);
    const r = checkLineField(field, input.value);
    if (!r.ok) {
      input.value = cur == null ? "" : String(cur);
      return toast.error(r.error);
    }
    if (r.value !== cur) void update(p, { [field]: r.value });
  }

  return (
    <Page
      eyebrow="Pipeline"
      title={
        products.length
          ? `${products.filter((p) => p.active).length} productos a la venta`
          : "Qué vendes"
      }
    >
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Cada producto lleva su precio y su coste por periodo, en {symbol}. Al añadirlo a un deal, la
        línea copia el precio y el coste de ese momento: cambiar el catálogo no reescribe deals ya
        negociados. El importe del deal (ACV) pasa a ser la suma de sus líneas recurrentes en un año
        (un plan mensual cuenta doce veces); los pagos únicos, como una puesta en marcha, se suman
        aparte y no cuentan en el ACV ni en el margen. El margen de los deals ganados con líneas
        alimenta el payback de Métricas.
      </p>

      {canEdit && (
        <div className="mb-8 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] sm:items-end">
          <Field label="Producto">
            <Input
              value={f.name}
              maxLength={120}
              placeholder="Plan Pro"
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </Field>
          <Field label={`Precio (${symbol})`}>
            <Input
              inputMode="decimal"
              value={f.price}
              onChange={(e) => setF({ ...f, price: e.target.value })}
            />
          </Field>
          <Field label={`Coste (${symbol}, opcional)`}>
            <Input
              inputMode="decimal"
              value={f.cost}
              onChange={(e) => setF({ ...f, cost: e.target.value })}
            />
          </Field>
          <Field label="Cobro">
            <Pick
              value={f.billing}
              options={BILLING_LABELS}
              onChange={(v) => setF({ ...f, billing: v as Billing })}
            />
          </Field>
          <Button disabled={busy || !f.name.trim()} onClick={create}>
            Añadir
          </Button>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Cargando el catálogo…</p>}
      {!isLoading && products.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "Aún no hay productos. Añade el primero arriba: nombre, precio y, si lo sabes, el coste para ver el margen."
            : "Aún no hay productos. El Owner, el Sales Leader o Deal Desk pueden crearlos."}
        </p>
      )}

      <ul className="divide-y divide-hairline border-y border-hairline">
        {products.map((p) => {
          const m = productMarginPct(p);
          return (
            <li
              key={`${p.id}-${p.name}-${p.price}-${p.cost}-${p.billing}-${rev}`}
              className={`grid gap-3 py-3 text-sm sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_7rem] sm:items-center ${p.active ? "" : "opacity-60"}`}
            >
              {canEdit ? (
                <Input
                  aria-label={`Nombre de ${p.name}`}
                  defaultValue={p.name}
                  maxLength={120}
                  onBlur={(e) => {
                    const v = e.currentTarget.value.trim();
                    if (!v) {
                      e.currentTarget.value = p.name;
                      return;
                    }
                    if (v !== p.name) void update(p, { name: v });
                  }}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
              ) : (
                <span className="font-medium">{p.name}</span>
              )}
              {canEdit ? (
                <Input
                  aria-label={`Precio de ${p.name}`}
                  inputMode="decimal"
                  defaultValue={String(p.price)}
                  onBlur={(e) => numField(p, "price", e.currentTarget)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
              ) : (
                <span className="font-mono">
                  {money(Number(p.price))}
                  {BILLING_SUFFIX[p.billing as Billing]}
                </span>
              )}
              {canEdit ? (
                <Input
                  aria-label={`Coste de ${p.name}`}
                  inputMode="decimal"
                  placeholder="sin coste"
                  defaultValue={p.cost == null ? "" : String(p.cost)}
                  onBlur={(e) => numField(p, "cost", e.currentTarget)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
              ) : (
                <span className="font-mono">
                  {p.cost == null ? "sin coste" : money(Number(p.cost))}
                </span>
              )}
              {canEdit ? (
                <Pick
                  aria-label={`Cobro de ${p.name}`}
                  value={String(p.billing)}
                  options={BILLING_LABELS}
                  onChange={(v) => update(p, { billing: v })}
                />
              ) : (
                <span>{BILLING_LABELS[p.billing as Billing]}</span>
              )}
              <span className="flex items-center justify-between gap-2 sm:justify-end">
                <span className="font-mono text-xs text-muted-foreground">
                  {m == null ? "margen —" : `margen ${Math.round(m)} %`}
                </span>
                {canEdit && (
                  <label className="flex items-center gap-1 text-xs">
                    <Checkbox
                      checked={p.active}
                      onCheckedChange={(v) => update(p, { active: !!v })}
                      aria-label={`${p.name} a la venta`}
                    />{" "}
                    A la venta
                  </label>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Un producto que ya no vendes se desmarca de «A la venta»: deja de salir al añadir líneas y
        los deals que lo llevan no cambian.
      </p>
    </Page>
  );
}
