import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrgCreateForm } from "@/components/org-create";
import { ROLES, type Role } from "@/lib/roles";
import type { Membership } from "@/hooks/use-me";
import { errorText } from "@/lib/errors";

export type { SegmentTemplate } from "@/components/org-create";

export function OrgSwitcher({ memberships, archived, current, userId }: { memberships: Membership[]; archived: Membership[]; current: Membership | null; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  async function switchTo(orgId: string) {
    const { error } = await supabase.from("profiles").update({ current_org_id: orgId }).eq("id", userId);
    if (error) return toast.error(errorText(error));
    setOpen(false);
    await qc.cancelQueries();
    await qc.resetQueries();
  }
  async function restore(m: Membership) {
    const { error } = await supabase.rpc("archive_organization", { _org: m.org_id, _archived: false });
    if (error) return toast.error(errorText(error));
    toast.success(`«${m.name}» recuperada.`);
    await switchTo(m.org_id);
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="mx-3 mb-4 flex w-[calc(100%-1.5rem)] items-center justify-between rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-2 text-left">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-sidebar-accent-foreground">{current?.name ?? "Elige empresa"}</span>
              <span className="block truncate text-xs text-sidebar-foreground/60">{current ? ROLES[current.role as Role]?.label : ""}</span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1">
          <p className="eyebrow px-2 py-1.5">Tus empresas</p>
          {memberships.map((m) => (
            <button key={m.org_id} onClick={() => switchTo(m.org_id)} className="flex w-full items-center justify-between gap-2 rounded px-2 py-2.5 text-left text-sm hover:bg-muted md:py-1.5">
              <span className="min-w-0"><span className="block truncate">{m.name}</span><span className="block text-xs text-muted-foreground">{ROLES[m.role as Role]?.label}</span></span>
              {m.org_id === current?.org_id && <span className="shrink-0 text-signal" aria-label="actual">✓</span>}
            </button>
          ))}
          {archived.length > 0 && (
            <div className="border-t p-1">
              <button onClick={() => setShowArchived((v) => !v)} className="w-full px-1 py-1.5 text-left text-xs text-muted-foreground">Archivadas ({archived.length}) {showArchived ? "−" : "+"}</button>
              {showArchived && archived.map((m) => (
                <div key={m.org_id} className="flex items-center justify-between gap-2 px-1 py-1.5 text-sm">
                  <span className="min-w-0 truncate text-muted-foreground">{m.name}</span>
                  {m.role === "owner" && <button className="shrink-0 text-xs underline" onClick={() => restore(m)}>Recuperar</button>}
                </div>
              ))}
            </div>
          )}
          <div className="mt-1 border-t p-1">
            {current && <Link to="/company" onClick={() => setOpen(false)} className="block rounded px-2 py-2.5 text-sm hover:bg-muted md:py-1.5">Ajustes de esta empresa</Link>}
            <button onClick={() => { setOpen(false); setCreating(true); }} className="block w-full rounded px-2 py-2.5 text-left text-sm hover:bg-muted md:py-1.5">Nueva empresa</button>
          </div>
        </PopoverContent>
      </Popover>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nueva empresa</DialogTitle></DialogHeader>
          <OrgCreateForm orgs={[...memberships, ...archived]} location="switcher" onDone={() => setCreating(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
