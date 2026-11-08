// SDD-20261106-ux-metrics-data-state · U-1 · CA-1: a long explanation behind one button, closed by default.
// Radix only sets aria-controls while open and spreads our props after its own, so the trigger gets the content id
// explicitly and the content keeps that same id: the attribute is there closed too. Content opens in the flow, below
// the button (no portal, no absolute/fixed).
import { useId, useState, type ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const LABEL = {
  calculo: { closed: "Cómo se calcula", open: "Ocultar cálculo" },
  metodo: { closed: "Más sobre esto", open: "Ocultar" },
} as const;

export function ExplanationFold({
  kind,
  children,
  className,
}: {
  kind: keyof typeof LABEL;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger
        aria-controls={contentId}
        className="inline-flex min-h-9 items-center text-xs text-signal underline-offset-2 hover:underline md:min-h-0"
      >
        {open ? LABEL[kind].open : LABEL[kind].closed}
      </CollapsibleTrigger>
      <CollapsibleContent id={contentId} className="mt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
