import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/hooks/use-me";
import { useSetup } from "@/hooks/use-setup";
import {
  diagnose,
  type DiagnosisInput,
  type Diagnosis,
  type Friction,
  type Model,
  type Stage,
} from "@/lib/gtm-diagnosis";

import type { Depth } from "@/lib/onboarding";
export type { Depth };
export const DEPTHS: { id: Depth; label: string; time: string; what: string }[] = [
  {
    id: "express",
    label: "Exprés",
    time: "5 min",
    what: "Con la web, una estrategia base con los supuestos marcados.",
  },
  {
    id: "standard",
    label: "Estándar",
    time: "15 min",
    what: "Web y documentos, y unas cinco preguntas.",
  },
  {
    id: "deep",
    label: "A fondo",
    time: "30 min o más",
    what: "Todas tus fuentes, mercado y competidores, y el debate de los C-Levels.",
  },
];

export function DepthStep({ value, onPick }: { value: Depth | null; onPick: (d: Depth) => void }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {DEPTHS.map((d) => (
        <button
          key={d.id}
          onClick={() => onPick(d.id)}
          className={`border-t-2 pt-4 text-left ${value === d.id ? "border-ink" : "border-hairline"} hover:border-ink`}
        >
          <span className="smallcaps text-ink-mid">{d.time}</span>
          <span className="mt-1 block font-display text-3xl">{d.label}</span>
          <span className="mt-2 block text-sm text-ink-mid">{d.what}</span>
        </button>
      ))}
    </div>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="smallcaps text-ink-mid">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(([k, l]) => (
          <Button
            key={k}
            size="sm"
            variant={value === k ? "default" : "outline"}
            onClick={() => onChange(k)}
          >
            {l}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function DiagnosisStep({
  initial,
  onDone,
}: {
  initial: DiagnosisInput;
  onDone: (input: DiagnosisInput, d: Diagnosis) => void;
}) {
  const { money, symbol } = useCurrency();
  const [i, setI] = useState<DiagnosisInput>(initial);
  const d = diagnose(i, (n) => money(n));
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-6">
        <Choice<Model>
          label="Modelo"
          value={i.model}
          options={[
            ["b2b", "Vendo a empresas"],
            ["b2c", "Vendo a consumidores"],
            ["marketplace", "Conecto oferta y demanda"],
          ]}
          onChange={(model) => setI({ ...i, model })}
        />
        <div>
          <p className="smallcaps text-ink-mid">Ticket anual por cliente ({symbol})</p>
          <Input
            className="mt-2 max-w-48 tabular-nums"
            inputMode="numeric"
            value={i.acv || ""}
            onChange={(e) => setI({ ...i, acv: Number(e.target.value.replace(/\D/g, "")) || 0 })}
          />
        </div>
        <Choice<Friction>
          label="Adopción"
          value={i.friction}
          options={[
            ["self_serve", "Lo prueba solo en minutos"],
            ["committee", "Necesita integración o un comité"],
          ]}
          onChange={(friction) => setI({ ...i, friction })}
        />
        <Choice<Stage>
          label="Etapa"
          value={i.stage}
          options={[
            ["idea", "Idea o pre-MVP"],
            ["early", "Primeros clientes"],
            ["scale", "Escalando"],
          ]}
          onChange={(stage) => setI({ ...i, stage })}
        />
      </div>
      <div className="border-t-2 border-hairline-firm pt-4">
        <p className="smallcaps text-signal">Tu diagnóstico GTM · arquetipo {d.archetype}</p>
        <h2 className="mt-1 font-display text-4xl">{d.name}</h2>
        <p className="mt-3 text-sm">
          <span className="smallcaps text-ink-mid">Se activa</span>{" "}
          {[...d.forced, ...d.active].join(" · ")}
        </p>
        <p className="mt-2 text-sm">
          <span className="smallcaps text-ink-mid">Entregable estrella</span> {d.star}
        </p>
        <p className="mt-2 text-sm">
          <span className="smallcaps text-ink-mid">Siguiente paso</span> {d.nextStep}
        </p>
        {d.discarded.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-hairline pt-3 text-sm">
            {d.discarded.map((x) => (
              <li key={x.framework}>
                <span className="font-medium">Descartado: {x.framework}.</span>{" "}
                <span className="text-ink-mid">{x.reason}</span>
              </li>
            ))}
          </ul>
        )}
        <Button className="mt-6" onClick={() => onDone(i, d)}>
          Usar este diagnóstico
        </Button>
      </div>
    </div>
  );
}

export function RoadmapStep({ diagnosis }: { diagnosis: Diagnosis | null }) {
  const { data: st } = useSetup();
  const mine: [string, string, string][] = [
    ["Completar lo que falta de la estrategia", "/setup", `${st?.status.pct ?? 0} % hecho`],
    ["Importar leads o cuentas", "/leads/entrada", ""],
    ["Conectar herramientas", "/integrations", ""],
    ["Conectar asistentes de IA y Telegram", "/connect", ""],
    ["Invitar al equipo", "/team", ""],
  ];
  const nokko = [
    "Buscar empresas que encajan con tu ICP cada semana (Descubiertos)",
    "Investigar cada cuenta nueva y completar sus datos",
    "Preparar tus reuniones el día anterior",
    "Avisarte de cuentas que se enfrían y deals en riesgo",
  ];
  return (
    <div className="space-y-8">
      {diagnosis && (
        <p className="text-lg">
          Arquetipo {diagnosis.archetype}, {diagnosis.name}. Primero:{" "}
          {diagnosis.nextStep.toLowerCase()}.
        </p>
      )}
      <div className="grid gap-10 md:grid-cols-2">
        <div className="border-t-2 border-hairline-firm pt-4">
          <p className="smallcaps">Nokko hará solo</p>
          <ul className="mt-3 space-y-2 text-sm">
            {nokko.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/accounts">Buscar empresas por ICP ahora</Link>
          </Button>
        </div>
        <div className="border-t-2 border-hairline-firm pt-4">
          <p className="smallcaps">Te toca a ti</p>
          <ul className="mt-3 space-y-2 text-sm">
            {mine.map(([l, to, note]) => (
              <li key={to} className="flex justify-between gap-3">
                <Link to={to} className="underline underline-offset-2">
                  {l}
                </Link>
                <span className="text-ink-faint">{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Button asChild>
        <Link to="/home">Ir a Inicio</Link>
      </Button>
    </div>
  );
}
