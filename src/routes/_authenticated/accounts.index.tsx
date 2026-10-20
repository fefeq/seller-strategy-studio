import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/use-me";
import { Page, Empty, HealthDot } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/accounts/")({
  head: () => ({ meta: [{ title: "Cuentas — Nokko" }, { name: "description", content: "Todas las cuentas con su plan y stakeholders." }, { property: "og:title", content: "Cuentas — Nokko" }, { property: "og:description", content: "Todas las cuentas con su plan y stakeholders." }] }),
  component: Accounts,
});

function Accounts() {
  const { money: eur } = useCurrency();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await supabase.from("accounts").select("*, deals(amount,stage), stakeholders(id)").order("name")).data ?? [],
  });
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  async function create() {
    const { data: a, error } = await supabase.from("accounts").insert({ name, domain }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("account_plans").insert({ account_id: a.id });
    navigate({ to: "/accounts/$id", params: { id: a.id } });
  }
  const list = data.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page eyebrow="Account management" title="Cuentas" actions={
      <Dialog>
        <DialogTrigger asChild><Button>+ Nueva cuenta</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva cuenta</DialogTitle></DialogHeader>
          <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Dominio (acme.com)" value={domain} onChange={(e) => setDomain(e.target.value)} />
          <Button disabled={!name} onClick={create}>Crear</Button>
        </DialogContent>
      </Dialog>
    }>
      <Input placeholder="Buscar cuenta…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-xs" />
      {list.length === 0 ? <Empty>Crea tu primera cuenta para empezar su Account Plan.</Empty> : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left"><tr>{["Cuenta", "Tier", "Salud", "Stakeholders", "Pipeline"].map((h) => <th key={h} className={`eyebrow px-3 py-3 sm:px-4 ${h === "Tier" || h === "Stakeholders" ? "hidden sm:table-cell" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-3 sm:px-4"><Link to="/accounts/$id" params={{ id: a.id }} className="font-medium hover:text-signal">{a.name}</Link><span className="block break-all text-xs text-muted-foreground sm:ml-2 sm:inline">{a.domain}</span></td>
                  <td className="hidden px-4 py-3 font-mono sm:table-cell">{a.tier}</td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4"><HealthDot value={a.health} /></td>
                  <td className="hidden px-4 py-3 sm:table-cell">{a.stakeholders?.length ?? 0}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono sm:px-4">{eur((a.deals ?? []).filter((d) => d.stage !== "won" && d.stage !== "lost").reduce((s, d) => s + Number(d.amount ?? 0), 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
