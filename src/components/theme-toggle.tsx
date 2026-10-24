import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark";
const KEY = "nokko-theme";
// Color of the top band (paper-edge) per theme, for the browser/status bar.
const BAND: Record<Theme, string> = { light: "#f3f2ee", dark: "#262320" };

/**
 * Runs in <head> before first paint: the saved choice, else the system preference.
 * Kept as a string so it can be inlined without a flash of the wrong theme.
 */
export const THEME_BOOT = `(function(){try{var t=localStorage.getItem("${KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}})();`;

function apply(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute("content", BAND[t]);
    m.removeAttribute("media");
  });
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    // Follow the system while the person hasn't chosen.
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem(KEY); } catch { /* blocked storage */ }
      if (saved === "light" || saved === "dark") return;
      const t: Theme = mq.matches ? "dark" : "light";
      apply(t);
      setTheme(t);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const set = (t: Theme) => {
    apply(t);
    setTheme(t);
    try { localStorage.setItem(KEY, t); } catch { /* blocked storage */ }
  };
  return { theme, setTheme: set, toggle: () => set(theme === "dark" ? "light" : "dark") };
}

/** Light/dark switch. `compact` = icon only (collapsed sidebar, tight headers). */
export function ThemeToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  if (compact) {
    return (
      <button onClick={toggle} aria-label={label} title={label} className={cn("flex size-9 items-center justify-center text-ink-mid hover:text-ink", className)}>
        {dark ? : <Moon className="size-4" />}
      </button>
    );
  }
  return (
    <button
      role="switch"
      aria-checked={dark}
      aria-label="Modo oscuro"
      onClick={toggle}
      className={cn("group flex w-full items-center justify-between gap-3 py-2 text-xs text-ink-mid hover:text-ink md:py-1", className)}
    >
      <span className="flex items-center gap-2">
        {dark ? : <Sun className="size-3.5" />}
        {dark ? "Modo oscuro" : "Modo claro"}
      </span>
      {/* The switch: a hairline track with a square knob, no radius (design system). */}
      <span className="relative h-4 w-8 shrink-0 border border-hairline-firm">
        <span className={cn("absolute top-0.5 size-2.5 bg-ink transition-[left] duration-150", dark ? "left-[17px]" : "left-0.5")} />
      </span>
    </button>
  );
}
