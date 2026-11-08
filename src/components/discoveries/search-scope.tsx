import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ALL_KINDS, KIND_LABEL, type DiscoveryKind } from "@/lib/discoveries";

/** «Buscar ahora»: choose what to look for (companies, contacts, competitors) and in which ICPs before launching. */
export function SearchScope({
  icps,
  onStart,
}: {
  icps: { id: string; name: string }[];
  onStart: (input: { kinds: DiscoveryKind[]; icpIds?: string[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kinds, setKinds] = useState<DiscoveryKind[]>([...ALL_KINDS]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  const needsIcp = kinds.includes("company") || kinds.includes("contact");
  const chosen = icps.filter((i) => !skipped.includes(i.id)).map((i) => i.id);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button>Buscar ahora</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium">¿Qué quieres buscar?</p>
          {ALL_KINDS.map((k) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
              <Checkbox
                checked={kinds.includes(k)}
                onCheckedChange={() => setKinds((c) => toggle(c, k))}
              />
              {KIND_LABEL[k].many}
            </label>
          ))}
        </div>
        {needsIcp && icps.length > 1 && (
          <div>
            <p className="mb-2 text-sm font-medium">¿En qué ICP?</p>
            {icps.map((i) => (
              <label key={i.id} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                <Checkbox
                  checked={!skipped.includes(i.id)}
                  onCheckedChange={() => setSkipped((c) => toggle(c, i.id))}
                />
                {i.name}
              </label>
            ))}
          </div>
        )}
        {needsIcp && !icps.length && (
          <p className="text-sm text-muted-foreground">
            No tienes ningún ICP: sin él no puedo buscar empresas ni contactos.{" "}
            <Link to="/strategy" search={{ tab: "icp" }} className="underline">
              Crea uno en Estrategia GTM
            </Link>
            .
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          No cambia la fecha de la próxima búsqueda semanal.
        </p>
        <Button
          className="w-full"
          disabled={!kinds.length || (needsIcp && icps.length > 0 && !chosen.length)}
          onClick={() => {
            setOpen(false);
            onStart({
              kinds,
              ...(needsIcp && skipped.length && chosen.length ? { icpIds: chosen } : {}),
            });
          }}
        >
          Buscar
        </Button>
      </PopoverContent>
    </Popover>
  );
}
