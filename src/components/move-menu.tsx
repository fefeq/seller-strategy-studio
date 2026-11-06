// «Mover a…» on every Pipeline card: move a deal to any stage with a tap or the keyboard, no dragging (SDD-20261031-ux-move-without-drag).
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MOVE_COPY, type MoveOption } from "@/lib/board-move";

export function MoveMenu({
  itemLabel,
  options,
  onMove,
}: {
  itemLabel: string;
  options: MoveOption[];
  onMove: (stageKey: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Mover ${itemLabel} a otra etapa`}
        onClick={(e) => e.stopPropagation()}
        className="flex min-h-11 min-w-11 items-center justify-end font-mono text-xs uppercase tracking-wide text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:min-h-0 md:min-w-0"
      >
        {MOVE_COPY.menu}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>{MOVE_COPY.menu}</DropdownMenuLabel>
        {options.map((o) => (
          <DropdownMenuItem
            key={o.key}
            disabled={o.current}
            className="min-h-11 md:min-h-0"
            onSelect={() => onMove(o.key)}
          >
            {o.label}
            {o.current ? " · actual" : ""}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
