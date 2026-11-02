// @vitest-environment node
// SDD-20261031-ux-palette-graphite: values, contrast and hand-written colors of the «Grafito e índigo» palette.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const css = read("src/styles.css");

function block(start: string, end: string) {
  const a = css.indexOf(start);
  const b = css.indexOf(end, a);
  return css.slice(a, b);
}
function tokens(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/^\s*--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/gm)) out[m[1]] = m[2].toLowerCase();
  return out;
}
const light = tokens(block("/* Tema claro */", "/* Tema oscuro */"));
const darkOnly = tokens(block("/* Tema oscuro */", "@layer base"));
const dark = { ...light, ...darkOnly };

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const dist = (a: string, b: string) => Math.hypot(...[1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)));

const THEMES = { claro: light, oscuro: dark } as const;
const BGS = ["paper", "paper-raised", "paper-sunk"] as const;

describe("CA-1 values of the palette", () => {
  const expected = {
    claro: { paper: "#f6f6f4", "paper-raised": "#ffffff", "paper-sunk": "#ebebe7", ink: "#14161a", "ink-mid": "#4b5058", "ink-faint": "#646a74", hairline: "#dddcd6", lime: "#3b45d6", "lime-foreground": "#ffffff", "lime-soft": "#e8eaff", blue: "#3b45d6", focus: "#3b45d6", "state-ok": "#0f7a46", "state-watch": "#8f5200", "state-alarm": "#c4261b", "series-1": "#14161a", "series-2": "#3b45d6", "series-3": "#0e7490", "series-4": "#c2410c", "series-5": "#7a7f89" },
    oscuro: { paper: "#101216", "paper-raised": "#171a20", "paper-sunk": "#0b0c0f", ink: "#eef0f3", "ink-mid": "#aab0bb", "ink-faint": "#8b919c", hairline: "#272b33", lime: "#8e97ff", "lime-foreground": "#101216", "lime-soft": "#232852", blue: "#8e97ff", focus: "#8e97ff", "state-ok": "#4ade80", "state-watch": "#fbbf24", "state-alarm": "#f87171", "series-1": "#eef0f3", "series-2": "#8e97ff", "series-3": "#22d3ee", "series-4": "#fb923c", "series-5": "#8b919c" },
  } as const;
  for (const [name, values] of Object.entries(expected)) {
    it(`tema ${name}`, () => {
      const theme = THEMES[name as keyof typeof THEMES];
      for (const [k, v] of Object.entries(values)) expect(theme[k], `--${k}`).toBe(v);
    });
  }
});

describe("CA-2 text contrast ≥ 4,5:1", () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    for (const bg of BGS) {
      for (const fg of ["ink", "ink-mid", "ink-faint", "blue", "state-ok", "state-watch", "state-alarm"]) {
        it(`${name}: ${fg} sobre ${bg}`, () => {
          expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
    it(`${name}: texto del botón sobre el acento`, () => {
      expect(contrast(theme["lime-foreground"], theme.lime)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: tinta sobre el fondo suave del acento`, () => {
      expect(contrast(theme.ink, theme["lime-soft"])).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("texto del botón destructivo sobre el estado «en riesgo», en claro y oscuro", () => {
    const fgLight = light["destructive-foreground"] ?? "#ffffff";
    expect(contrast(fgLight, light["state-alarm"])).toBeGreaterThanOrEqual(4.5);
    const m = css.slice(css.indexOf(".dark {"), css.indexOf("@layer base")).match(/--destructive-foreground:\s*(#[0-9a-fA-F]{6})/);
    const fgDark = (m?.[1] ?? "#ffffff").toLowerCase();
    expect(contrast(fgDark, dark["state-alarm"])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("CA-3 accent contrast ≥ 3:1 (focus ring, active items)", () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    for (const bg of ["paper", "paper-raised"] as const) {
      it(`${name}: acento y enfoque sobre ${bg}`, () => {
        expect(contrast(theme.lime, theme[bg])).toBeGreaterThanOrEqual(3);
        expect(contrast(theme.focus, theme[bg])).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

function walk(dir: string, out: string[] = []) {
  for (const f of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, f);
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) walk(rel, out);
    else if (/\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.endsWith(".gen.ts")) out.push(rel);
  }
  return out;
}
const files = walk("src");

describe("CA-4 the old lime is gone", () => {
  const OLD = [/c6f432/i, /8fbf00/i, /eefbc4/i, /26300b/i, /198,\s*244,\s*50/];
  for (const f of files) {
    it(f, () => {
      const src = readFileSync(join(ROOT, f), "utf8");
      for (const re of OLD) expect(re.test(src), `${f} ${re}`).toBe(false);
    });
  }
});

describe("CA-5 chart series", () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    const series = [1, 2, 3, 4, 5].map((n) => theme[`series-${n}`]);
    it(`${name}: contraste ≥ 3:1 sobre los tres fondos`, () => {
      for (const s of series) for (const bg of BGS) expect(contrast(s, theme[bg]), `${s} sobre ${bg}`).toBeGreaterThanOrEqual(3);
    });
    it(`${name}: series distinguibles entre sí (distancia mínima de color)`, () => {
      for (let i = 0; i < series.length; i++) for (let j = i + 1; j < series.length; j++) expect(dist(series[i], series[j]), `${series[i]} vs ${series[j]}`).toBeGreaterThanOrEqual(60);
    });
  }
});

// Hand-written colors are only allowed where CSS variables cannot reach (server HTML, browser metadata).
const ALLOWED_HAND_COLORS: Record<string, string> = {
  "src/lib/email.server.ts": "correo transaccional: los clientes de correo no leen variables CSS",
  "src/lib/daily-email.ts": "correo diario: los clientes de correo no leen variables CSS",
  "src/lib/error-page.ts": "página de error servida como HTML fijo, sin la hoja de estilos",
  "src/routes/__root.tsx": "color del navegador (meta theme-color)",
  "src/components/theme-toggle.tsx": "color de la barra del navegador al cambiar de tema",
  "src/components/ui/chart.tsx": "selectores de Recharts que apuntan a atributos de la librería, no a colores propios",
};

describe("CA-6 / CA-7 hand-written colors", () => {
  const HAND = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(/;
  for (const f of files.filter((x) => !x.endsWith("styles.css"))) {
    if (ALLOWED_HAND_COLORS[f]) continue;
    it(`${f} no escribe colores a mano`, () => {
      const lines = readFileSync(join(ROOT, f), "utf8").split("\n").filter((l) => HAND.test(l));
      expect(lines, relative(ROOT, f)).toEqual([]);
    });
  }
  it("la lista de excepciones solo contiene archivos que existen", () => {
    for (const f of Object.keys(ALLOWED_HAND_COLORS)) expect(() => statSync(join(ROOT, f))).not.toThrow();
  });
  it("correos, página de error, color del navegador y manifiesto usan la paleta nueva", () => {
    const OLD_HEX = /#fafaf7|#fafafa|#0f1115|#1a1a1a|#c8102e|#6b6b6b|#f3f2ee|#262320|#111\b/i;
    for (const f of ["src/lib/email.server.ts", "src/lib/daily-email.ts", "src/lib/error-page.ts", "src/routes/__root.tsx", "src/components/theme-toggle.tsx", "public/manifest.webmanifest", "public/favicon.svg"]) {
      const src = read(f);
      const withoutFaviconBg = f === "public/favicon.svg" ? src.replace(/<rect[^>]*fill="#0f1115"[^>]*>/, "") : src;
      expect(OLD_HEX.test(withoutFaviconBg), f).toBe(false);
    }
    expect(read("src/routes/__root.tsx")).toContain('"#f6f6f4"');
    expect(read("src/routes/__root.tsx")).toContain('"#101216"');
    expect(read("public/manifest.webmanifest")).toContain("#f6f6f4");
    expect(read("public/favicon.svg")).toContain('stroke="#8e97ff"');
  });
});
