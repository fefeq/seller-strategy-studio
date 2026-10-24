/** Swipe gesture rules for card decks (Sugerencias, Descubiertos). Pure, tested. */
export type SwipeDir = "right" | "left" | "up";

/** Distance (px) or flick speed (px/s) that commits a swipe; below both, the card springs back. */
export const SWIPE_DISTANCE = 110;
export const SWIPE_VELOCITY = 600;

export function swipeDirection(dx: number, dy: number, vx = 0, vy = 0): SwipeDir | null {
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  if (horizontal) {
    if (dx >= SWIPE_DISTANCE || (vx >= SWIPE_VELOCITY && dx > 20)) return "right";
    if (dx <= -SWIPE_DISTANCE || (vx <= -SWIPE_VELOCITY && dx < -20)) return "left";
    return null;
  }
  if (dy <= -SWIPE_DISTANCE || (vy <= -SWIPE_VELOCITY && dy < -20)) return "up";
  return null; // pulling down never decides
}

/** Keyboard: ← discard, → do, ↑ later. */
export function keyDirection(key: string): SwipeDir | null {
  return key === "ArrowRight" ? "right" : key === "ArrowLeft" ? "left" : key === "ArrowUp" ? "up" : null;
}
