import { X } from "lucide-react";
import { IconText } from "@/components/icon-text";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Page, Empty } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pick } from "@/components/fields";
import { errorText } from "@/lib/errors";
import { KIND_LABEL, SOURCE_LABEL, canEditMemory, type MemKind, type MemScope } from "@/lib/memory";

const TITLE = "Memoria — Nokko";
const DESC =
  "Lo que Nokko recuerda de la empresa, de ti y de cada cuenta. Revísalo, corrígelo o pídele que lo olvide.";

export const Route = createFileRoute("/_authenticated/memory")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MemoryPage,
});

type Row = {
  id: string;
  scope: MemScope;
  kind: MemKind;
  content: string;
  user_id: string | null;
  account_id: string | null;
  pinned: boolean;
  learned: boolean;
  source: string;
  updated_at: string;
  accounts: { name: string } | null;
};
const KINDS_BY_SCOPE: Record<MemScope, MemKind[]> = {
  company: ["business", "outcome", "task"],
  user: ["preference", "task"],
  account: ["account", "outcome", "task"],
};
const date = (s: string) =>
  new Date(s).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

function MemoryPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data: rows = [] } = useQuery({
    queryKey: ["memories"],
    queryFn: async () =>
      ((
        await supabase
          .from("memories")
          .select(
            "id,scope,kind,content,user_id,account_id,pinned,learned,source,updated_at,accounts(name)",
          )
          .eq("active", true)
          .order("pinned", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(500)
      ).data ?? []) as Row[],
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["memory-accounts"],
    queryFn: async () =>
      (await supabase.from("accounts").select("id,name").order("name").limit(1000)).data ?? [],
  });
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t
      ? rows.filter(
          (r) => r.content.toLowerCase().includes(t) || r.accounts?.name.toLowerCase().includes(t),
        )
      : rows;
  }, [rows, q]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["memories"] });
  const by = (s: MemScope) =>
    filtered.filter((r) => r.scope === s && (s !== "user" || r.user_id === me?.user.id));
  const learned = rows.filter((r) => r.learned).length;

  return (
    <Page
      eyebrow="Conocimiento"
      title={
        rows.length
          ? `${rows.length} ${rows.length === 1 ? "cosa" : "cosas"} que Nokko recuerda`
          : "Memoria"
      }
    >
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Nokko aprende solo de tus chats con el agente, de las notas de cada reunión y de las
        sugerencias que apruebas o descartas, y lo usa antes de responder o proponer algo.{" "}
        {learned > 0 && `${learned} ${learned === 1 ? "lo aprendió" : "las aprendió"} solo. `}Si
        algo está mal, corrígelo; si sobra, olvídalo.
      </p>
      <Input
        className="mb-6 max-w-md"
        placeholder="Buscar en la memoria…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Buscar en la memoria"
      />
      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Empresa ({by("company").length})</TabsTrigger>
          <TabsTrigger value="user">Mío ({by("user").length})</TabsTrigger>
          <TabsTrigger value="account">Cuentas ({by("account").length})</TabsTrigger>
        </TabsList>
        {(["company", "user", "account"] as MemScope[]).map((s) => (
          <TabsContent key={s} value={s} className="space-y-6 pt-4">
            <p className="text-xs text-muted-foreground">
              {s === "company"
                ? "Lo ve todo el equipo. Lo editan su autor, el Owner y el Sales Leader."
                : s === "user"
                  ? "Solo lo ves tú: cómo te gusta trabajar."
                  : "Lo ve todo el equipo, junto a cada cuenta."}
            </p>
            <AddMemory scope={s} accounts={accounts} onSaved={refresh} />
            {by(s).length ? (
              <ul className="divide-y border-t">
                {by(s).map((r) => (
                  <MemoryRow
                    key={r.id}
                    r={r}
                    editable={!!me && canEditMemory(r, me.user.id, me.roles)}
                    onChange={refresh}
                  />
                ))}
              </ul>
            ) : (
              <Empty>
                {q
                  ? "Nada coincide con la búsqueda."
                  : s === "user"
                    ? "Aún no recuerda nada tuyo. Dile al agente cómo te gusta trabajar, por ejemplo «respóndeme siempre con tres puntos»."
                    : "Aún no hay recuerdos aquí. Se irán guardando solos con el uso."}
              </Empty>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </Page>
  );
}

function AddMemory({
  scope,
  accounts,
  onSaved,
}: {
  scope: MemScope;
  accounts: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<MemKind>(KINDS_BY_SCOPE[scope][0]);
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (text.trim().length < 3) return;
    if (scope === "account" && !account) return toast.error("Elige la cuenta.");
    setBusy(true);
    const { error } = await supabase.from("memories").insert({
      scope,
      kind,
      content: text.trim(),
      account_id: scope === "account" ? account : null,
      source: "manual",
      learned: false,
    });
    setBusy(false);
    if (error) return toast.error(errorText(error));
    setText("");
    toast.success("Guardado en la memoria.");
    onSaved();
  }
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-start">
      <Input
        value={text}
        maxLength={600}
        placeholder={
          scope === "user"
            ? "Prefiero respuestas cortas y en tabla"
            : scope === "account"
              ? "El CFO decide; el presupuesto se aprueba en enero"
              : "No vendemos a agencias de marketing"
        }
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        aria-label="Nuevo recuerdo"
      />
      {scope === "account" && (
        <Pick
          aria-label="Cuenta"
          value={account}
          options={{ "": "Cuenta…", ...Object.fromEntries(accounts.map((a) => [a.id, a.name])) }}
          onChange={setAccount}
        />
      )}
      <Pick
        aria-label="Tipo"
        value={kind}
        options={Object.fromEntries(KINDS_BY_SCOPE[scope].map((k) => [k, KIND_LABEL[k]]))}
        onChange={(v) => setKind(v as MemKind)}
      />
      <Button onClick={save} disabled={busy || text.trim().length < 3}>
        Recordar
      </Button>
    </div>
  );
}

function MemoryRow({ r, editable, onChange }: { r: Row; editable: boolean; onChange: () => void }) {
  const [edit, setEdit] = useState<string | null>(null);
  async function update(patch: Record<string, unknown>, msg: string) {
    const { error } = await supabase
      .from("memories")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) return toast.error(errorText(error));
    toast.success(msg);
    setEdit(null);
    onChange();
  }
  return (
    <li className="py-3 text-sm">
      {edit !== null ? (
        <div className="space-y-2">
          <Textarea
            value={edit}
            maxLength={600}
            rows={2}
            onChange={(e) => setEdit(e.target.value)}
            aria-label="Corregir recuerdo"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={edit.trim().length < 3}
              onClick={() => update({ content: edit.trim(), learned: false }, "Corregido.")}
            >
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>
              <IconText icon={X}>Cancelar</IconText>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p>
              {r.pinned && <span className="mr-2 font-mono text-xs uppercase">Fijado</span>}
              {r.content}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {KIND_LABEL[r.kind]}
              {r.account_id && r.accounts && (
                <>
                  {" "}
                  ·{" "}
                  <Link to="/accounts/$id" params={{ id: r.account_id }} className="underline">
                    {r.accounts.name}
                  </Link>
                </>
              )}
              {" · "}
              {r.learned
                ? `aprendido de ${SOURCE_LABEL[r.source] ?? r.source}`
                : (SOURCE_LABEL[r.source] ?? r.source)}{" "}
              · {date(r.updated_at)}
            </p>
          </div>
          {editable && (
            <div className="flex shrink-0 gap-3 text-xs">
              <button className="underline" onClick={() => setEdit(r.content)}>
                Corregir
              </button>
              <button
                className="underline"
                onClick={() =>
                  update(
                    { pinned: !r.pinned },
                    r.pinned ? "Ya no está fijado." : "Fijado: Nokko lo tendrá siempre en cuenta.",
                  )
                }
              >
                {r.pinned ? "Quitar fijado" : "Fijar"}
              </button>
              <button className="underline" onClick={() => update({ active: false }, "Olvidado.")}>
                Olvidar
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
