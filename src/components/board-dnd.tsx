// Drag and drop for the Pipeline and Leads boards with mouse, touch (long press) and keyboard
// (SDD-20261031-ux-move-without-drag). The menu «Mover a…» stays the plain way; this is the quick one.
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import {
  BOARD_INSTRUCTIONS,
  adjacentColumn,
  boardAnnouncements,
  type ColumnRect,
} from "@/lib/board-move";

/** ← → jump to the neighbouring stage; Space/Escape are handled by the sensor. */
const columnKeyboard: KeyboardCoordinateGetter = (
  event,
  { context: { droppableRects, droppableContainers, collisionRect, over } },
) => {
  if (!collisionRect || (event.code !== "ArrowLeft" && event.code !== "ArrowRight"))
    return undefined;
  event.preventDefault();
  const cols: ColumnRect[] = [];
  for (const c of droppableContainers.getEnabled()) {
    const r = droppableRects.get(c.id);
    if (r) cols.push({ id: String(c.id), left: r.left, width: r.width });
  }
  const currentId = over
    ? String(over.id)
    : (cols.sort(
        (a, b) =>
          Math.abs(a.left + a.width / 2 - (collisionRect.left + collisionRect.width / 2)) -
          Math.abs(b.left + b.width / 2 - (collisionRect.left + collisionRect.width / 2)),
      )[0]?.id ?? "");
  const target = droppableRects.get(
    adjacentColumn(cols, currentId, event.code === "ArrowRight" ? 1 : -1),
  );
  if (!target) return undefined;
  return { x: target.left + (target.width - collisionRect.width) / 2, y: collisionRect.top };
};

const OverlayLabel = createContext<(id: string) => ReactNode>(() => null);

export function BoardDnd({
  cardLabel,
  columnLabel,
  onMove,
  children,
}: {
  cardLabel: (id: string) => string;
  columnLabel: (id: string) => string;
  /** Called only when the card lands on a different stage. */
  onMove: (cardId: string, toColumn: string) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: columnKeyboard,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
  function onDragEnd(e: DragEndEvent) {
    const from = e.active.data.current?.column as string | undefined;
    if (e.over && String(e.over.id) !== from) onMove(String(e.active.id), String(e.over.id));
  }
  return (
    <OverlayLabel.Provider value={cardLabel}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements: boardAnnouncements(cardLabel, columnLabel) as never,
          screenReaderInstructions: { draggable: BOARD_INSTRUCTIONS },
        }}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          <ActiveCard />
        </DragOverlay>
      </DndContext>
    </OverlayLabel.Provider>
  );
}

function ActiveCard() {
  const { active } = useDndContext();
  const label = useContext(OverlayLabel);
  if (!active) return null;
  return (
    <div className="rounded-md border bg-card p-3 text-sm font-medium shadow-md">
      {label(String(active.id))}
    </div>
  );
}

type DragProps = { ref: (el: HTMLElement | null) => void; style?: CSSProperties } & Record<
  string,
  unknown
>;

/** A draggable card: `children` gets the props to spread on its focusable element (the card button). */
export function DragCard({
  id,
  column,
  children,
}: {
  id: string;
  column: string;
  children: (drag: DragProps & { dragging: boolean }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { column } });
  return (
    <>
      {children({
        ref: setNodeRef,
        ...attributes,
        ...listeners,
        dragging: isDragging,
      } as DragProps & { dragging: boolean })}
    </>
  );
}

/** A stage column: highlights while a card is over it. */
export function DropColumn({
  id,
  className,
  overClassName = "ring-2 ring-signal",
  children,
}: {
  id: string;
  className?: string;
  overClassName?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      data-column={id}
      className={`${className ?? ""} ${isOver ? overClassName : ""}`}
    >
      {children}
    </div>
  );
}
