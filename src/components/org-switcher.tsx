import { Link } from "@tanstack/react-router";
import { ROLES, type Role } from "@/lib/roles";
import type { Membership } from "@/hooks/use-me";

/** Sidebar header: Nokko is internal and runs on one company, so this only names it and links to its settings. */
export function OrgSwitcher({ current }: { current: Membership | null }) {
  return (
    <Link to="/company" className="mx-3 mb-4 block w-[calc(100%-1.5rem)] rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-2 text-left">
      <span className="block truncate text-sm font-medium text-sidebar-accent-foreground">{current?.name}</span>
      <span className="block truncate text-[11px] text-sidebar-foreground/60">{current ? ROLES[current.role as Role]?.label : ""}</span>
    </Link>
  );
}
