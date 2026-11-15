// E2: app renderer of the neutral conversation blocks (src/lib/conversation.ts). Telegram uses toTelegram().
import { Link } from "@tanstack/react-router";
import type { ConvBlock } from "@/lib/conversation";
import { Button } from "@/components/ui/button";

export function ConvBlocks({ blocks, onChip, busy }: { blocks: ConvBlock[]; onChip?: (value: string) => void; busy?: boolean }) {
  return (
    <div className="space-y-2 text-sm">
      {blocks.map((b, i) =>
        b.kind === "list" ? (
          <div key={i}>
            {b.title && <p className="text-muted-foreground">{b.title}</p>}
            <ul className="list-disc pl-5">
              {b.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
        ) : b.kind === "link" ? (
          <Link key={i} to={b.path} className="inline-block text-signal underline underline-offset-4">
            {b.label}
          </Link>
        ) : (
          <div key={i}>
            {b.prompt && <p className="mb-1.5">{b.prompt}</p>}
            <div role="radiogroup" aria-label={b.prompt ?? "Opciones"} className="flex flex-wrap gap-2">
              {b.chips.map((c) => (
                <Button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={!!c.selected}
                  disabled={busy}
                  onClick={() => onChip?.(c.value)}
                  className={`min-h-11 rounded-full border px-4 ${c.selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-signal"}`}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}
