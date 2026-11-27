import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CORE_SECTIONS, type CoreSectionKey } from "@/lib/strategy-core";

interface StrategyCoreViewProps {
  /** Renders the editor of one of the five core sections. */
  renderSection: (key: CoreSectionKey) => ReactNode;
  /** Renders every other section of the strategy (own company only, already filtered by access rules). */
  renderAllSections: () => ReactNode;
  missing?: readonly CoreSectionKey[];
  startExpanded?: boolean;
}

export function StrategyCoreView({ renderSection, renderAllSections, missing = [], startExpanded = false }: StrategyCoreViewProps) {
  const [showAll, setShowAll] = useState(startExpanded);

  return (
    <div className="space-y-6">
      {CORE_SECTIONS.map((section) => (
        <section key={section.key} aria-labelledby={`core-${section.key}`} className="space-y-2">
          <h2 id={`core-${section.key}`} className="text-base font-semibold text-foreground">
            {section.label}
          </h2>
          <p className="text-sm text-muted-foreground">{section.hint}</p>
          {missing.includes(section.key) ? (
            <p className="text-sm text-destructive">Completa esta sección para aprobar tu estrategia.</p>
          ) : null}
          {renderSection(section.key)}
        </section>
      ))}

      <div>
        <Button type="button" variant="outline" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
          {showAll ? "Ver solo las cinco secciones" : "Ver todas las secciones"}
        </Button>
      </div>

      {showAll ? <div className="space-y-6">{renderAllSections()}</div> : null}
    </div>
  );
}
