// Ola 0.6: a jargon word with its definition from the help catalogue. A popover, not a hover tooltip, so it also opens with a tap or the keyboard.
import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { resolveHelp } from "@/lib/field-help";

export function JargonTerm({ term, children }: { term: string; children?: ReactNode }) {
  const h = resolveHelp(term);
  return (
    <Popover>
      <PopoverTrigger
        className="cursor-help underline decoration-dotted underline-offset-4"
        aria-label={`Qué es ${term}`}
      >
        {children ?? term}
      </PopoverTrigger>
      <PopoverContent className="max-w-sm space-y-2 text-sm">
        <p className="font-medium">{term}</p>
        <p>{h.description}</p>
        <p className="text-ink-mid">{h.goal}</p>
      </PopoverContent>
    </Popover>
  );
}
