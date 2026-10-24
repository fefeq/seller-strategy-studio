// «Buscar o crear»: a text field that suggests what already exists (accounts, people, partners…) while you type,
// links the one you pick and warns about a near-duplicate before creating a new one. Matching rules: src/lib/match.ts.
import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { CompanyLogo } from "@/components/company-logo";
import { duplicateOf, searchList, type Candidate } from "@/lib/match";

type Props<C extends Candidate> = {
  items: C[];
  /** Text in the field (the name). */
  value: string;
  /** Id of the linked record, or null when the text is a new one. */
  selectedId: string | null;
  onChange: (text: string, picked: C | null) => void;
  placeholder?: string;
  /** «cuenta», «persona»… for «Crear "X" como … nueva». */
  noun?: string;
  logos?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
};

export function EntityCombobox<C extends Candidate>({ items, value, selectedId, onChange, placeholder, noun = "nueva", logos, autoFocus, ariaLabel }: Props<C>) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const shown = useMemo(() => searchList(value, items, 8), [value, items]);
  const dup = !selectedId && value.trim() ? duplicateOf({ name: value }, items) : null;
  const picked = selectedId ? items.find((i) => i.id === selectedId) : null;

  return (
    <div className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { onChange(e.target.value, null); setOpen(true); }}
      />
      {open && (shown.length > 0 || value.trim()) && (
        <ul id={listId} role="listbox" className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto border bg-popover text-sm shadow-none">
          {shown.map((c) => (
            <li key={c.id} role="option" aria-selected={c.id === selectedId}>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(c.name, c); setOpen(false); }}>
                {logos && <CompanyLogo domain={c.domain ?? null} size={16} />}
                <span className="min-w-0 flex-1 truncate"><span className="font-medium">{c.name}</span>{(c.sub || c.domain) && <span className="text-muted-foreground"> · {c.sub ?? c.domain}</span>}</span>
              </button>
            </li>
          ))}
          {value.trim() && !shown.some((c) => c.name.trim().toLowerCase() === value.trim().toLowerCase()) && (
            <li role="option" aria-selected={false} className="border-t px-3 py-2 text-muted-foreground">Crear «{value.trim()}» como {noun}</li>
          )}
        </ul>
      )}
      {picked && <p className="mt-1 text-xs text-muted-foreground">Enlazado a la existente{picked.domain ? ` · ${picked.domain}` : ""}.</p>}
      {dup && (
        <p className="mt-1 text-xs">
          Ya existe <strong>{dup.item.name}</strong>{dup.item.domain ? ` (${dup.item.domain})` : ""}.{" "}
          <button type="button" className="underline underline-offset-4" onClick={() => onChange(dup.item.name, dup.item)}>Usar esa</button>
        </p>
      )}
    </div>
  );
}

export type AccountOption = Candidate & { domain: string | null };

/** Accounts of the active company (RLS) for «Buscar o crear». */
export function useAccountOptions(enabled = true) {
  return useQuery({
    queryKey: ["account-options"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => ((await supabase.from("accounts").select("id,name,domain").order("name").limit(2000)).data ?? []) as AccountOption[],
  });
}

/** People (Personas) of the active company for «Buscar o crear». */
export function usePeopleOptions(enabled = true) {
  return useQuery({
    queryKey: ["people-options"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => ((await supabase.from("people").select("id,full_name,email,company,title,linkedin_url").order("full_name").limit(3000)).data ?? []).map((p) => ({ id: p.id, name: p.full_name, email: p.email, sub: [p.title, p.company].filter(Boolean).join(" · ") || null, title: p.title, linkedin_url: p.linkedin_url, company: p.company })),
  });
}
