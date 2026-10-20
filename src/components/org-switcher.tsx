import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ROLES, type Role } from "@/lib/roles";
import type { Membership } from "@/hooks/use-me";
import { errorText } from "@/lib/errors";
import { track } from "@/lib/analytics";

export function OrgSwitcher({ memberships, current, userId }: { memberships: Membership[]; current: Membership | null; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  async function switchTo(orgId: string) {
    const { error } = await supabase.from("profiles").update({ current_org_id: orgId }).eq("id", userId);
    if (error) return toast.error(errorText(error));
    setOpen(false);
    await qc.cancelQueries();
    await qc.resetQueries();
  }
  async function create() {
    const { error } = await supabase.rpc("create_organization", { _name: name });
    if (error) return toast.error(errorText(error));
    track("org_created", { location: "switcher" });
    setName(""); setCreating(false); setOpen(false);
    await qc.resetQueries();
    toast.success("Empresa creada.");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="mx-3 mb-4 flex w-[calc(100%-1.5rem)] items-center justify-between rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-2 text-left">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-sidebar-accent-foreground">{current?.name ?? "Elige empresa"}</span>
            <span className="block truncate text-[11px] text-sidebar-foreground/60">{current ? ROLES[current.role as Role]?.label : ""}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <p className="eyebrow px-2 py-1.5">Tus empresas</p>
        {memberships.map((m) => (
          <button key={m.org_id} onClick={() => switchTo(m.org_id)} className="flex w-full items-center justify-between gap-2 rounded px-2 py-2.5 text-left text-sm hover:bg-muted md:py-1.5">
            <span className="min-w-0"><span className="block truncate">{m.name}</span><span className="block text-[11px] text-muted-foreground">{ROLES[m.role as Role]?.label}</span></span>
            {m.org_id === current?.org_id && <Check className="size-4 shrink-0 text-signal" />}
          </button>
        ))}
        <div className="mt-1 border-t p-1">
          {creating ? (
            <div className="flex gap-1">
              <Input autoFocus className="h-10 md:h-8" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && create()} />
              <Button size="sm" className="h-10 md:h-6" disabled={!name.trim()} onClick={create}>Crear</Button>
            </div>
          ) : (
            <button onClick={() => setCreating(true)} className="flex w-full items-center gap-2 rounded px-2 py-2.5 text-sm hover:bg-muted md:py-1.5"><Plus className="size-4" /> Nueva empresa</button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
