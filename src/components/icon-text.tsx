import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** NK-0168: an icon is always paired with its visible text. Sizes: 16 px in buttons, 20 px in nav; stroke 1.75. */
export const ICON_SIZE = { button: 16, nav: 20 } as const;
export const ICON_STROKE = 1.75;

export function IconText({
  icon: Icon,
  children,
  size = "button",
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  size?: keyof typeof ICON_SIZE;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <Icon aria-hidden size={ICON_SIZE[size]} strokeWidth={ICON_STROKE} className="shrink-0" />
      <span>{children}</span>
    </span>
  );
}
