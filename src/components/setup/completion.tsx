import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useSetup } from "@/hooks/use-setup";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type SetupProposal } from "@/lib/setup-extraction";
import { AiFill } from "@/components/setup/ai-fill";
import { Interview, Wizard } from "@/components/setup/wizard";
import { GuideProgress } from "@/components/setup/guide";

/** B1: Configuración (IA, entrevista, paso a paso) shown inside Onboarding › Completar. */
export function SetupCompletion() {
  const { data: setup } = useSetup();
  const [proposal, setProposal] = useState<SetupProposal | null>(null);
  const [tab, setTab] = useState("ai");
  const st = setup?.status;
  return (
    <>
      <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <p className="max-w-2xl text-muted-foreground">Elige cómo quieres hacerlo. Puedes combinar las tres vías: todas guardan en el mismo sitio y el progreso se actualiza solo.</p>
          <dl className="mt-4 grid max-w-3xl gap-3 text-sm sm:grid-cols-3">
            <div className="border-t border-hairline pt-2"><dt className="font-medium">Lo rellena la IA · 1-2 min</dt><dd className="text-muted-foreground">Si ya tienes web, deck o documentos. Propone todo de una vez y revisas punto por punto antes de guardar.</dd></div>
            <div className="border-t border-hairline pt-2"><dt className="font-medium">Entrevista · 10-15 min</dt><dd className="text-muted-foreground">Si lo tienes en la cabeza y no escrito. El agente te pregunta lo que falta, de uno en uno.</dd></div>
            <div className="border-t border-hairline pt-2"><dt className="font-medium">Paso a paso · 15-20 min</dt><dd className="text-muted-foreground">Si quieres controlar cada campo. Un formulario por hito.</dd></div>
          </dl>
          <p className="mt-3 max-w-3xl text-xs text-muted-foreground">Al combinarlas no se borra nada sin que lo veas: la IA actualiza los campos que tú aceptas (segmentos con el mismo nombre se actualizan; ICP, pilares y cuentas se añaden), y en Paso a paso partes de lo que ya está guardado.</p>
          <Tabs value={tab} onValueChange={setTab} className="mt-6">
            <TabsList>
              <TabsTrigger value="ai">Lo rellena la IA</TabsTrigger>
              <TabsTrigger value="interview">Entrevista</TabsTrigger>
              <TabsTrigger value="wizard">Paso a paso</TabsTrigger>
            </TabsList>
            <TabsContent value="ai" className="mt-6"><AiFill proposal={proposal} setProposal={setProposal} onWizard={() => setTab("wizard")} /></TabsContent>
            <TabsContent value="interview" className="mt-6"><Interview /></TabsContent>
            <TabsContent value="wizard" className="mt-6"><Wizard proposal={proposal} /></TabsContent>
          </Tabs>
        </div>
        <aside className="h-fit rounded-lg border bg-card p-5">
          <p className="eyebrow">Progreso</p>
          <p className="mt-1 font-display text-5xl">{st?.pct ?? 0}%</p>
          <div className="mt-2 h-2 rounded bg-muted"><div className="h-full rounded bg-primary transition-all" style={{ width: `${st?.pct ?? 0}%` }} /></div>
          <GuideProgress />
          <div className="mt-5 border-t border-hairline pt-4 text-sm">
            <p className="font-medium">Trabaja con Nokko desde Claude, ChatGPT o Codex</p>
            <p className="mt-1 text-xs text-muted-foreground">Conecta tu asistente por MCP: consulta pipeline, leads y estrategia sin salir de él. Lo que quiera cambiar te llega aquí para confirmar.</p>
            <Link to="/team" hash="mcp" className="mt-2 inline-block text-xs underline">Conectar mi asistente</Link>
          </div>
        </aside>
      </div>
    </>
  );
}

