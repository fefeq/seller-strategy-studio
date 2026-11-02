// @vitest-environment node
// SDD-20261031-ux-legibility-contrast CA-9/10: one figure card and one panel, shared by every screen.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Kpi, Panel } from "@/components/page";

const ROOT = process.cwd();
function walk(dir: string, out: string[] = []) {
  for (const f of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, f);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.tsx$/.test(f) && !/\.test\.tsx$/.test(f)) out.push(rel);
  }
  return out;
}

describe("CA-9 sin copias locales", () => {
  it("ninguna pantalla ni componente define su propio Kpi, Stat o Panel", () => {
    const offenders = walk("src").filter((f) => f !== "src/components/page.tsx" && /^(?:export )?function (Kpi|Stat|Panel)\(/m.test(readFileSync(join(ROOT, f), "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("CA-10 densidades de la tarjeta de cifra", () => {
  const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(Kpi, { label: "Etiqueta", value: "1.234", ...props } as never));
  it("hero: la cifra grande de Inicio y Pipeline", () => {
    const h = render({ size: "hero" });
    expect(h).toContain("text-4xl");
    expect(h).toContain("p-5");
  });
  it("normal: Métricas, finanzas y self-service", () => {
    const h = render({ size: "normal" });
    expect(h).toContain("md:text-3xl");
    expect(h).toContain("break-words");
  });
  it("compact: Leads y presupuesto", () => {
    const h = render({ size: "compact" });
    expect(h).toContain("px-4 py-3");
    expect(h).toContain("text-2xl");
  });
  it("inline: sin tarjeta", () => {
    const h = render({ size: "inline" });
    expect(h).not.toContain("border");
    expect(h).toContain("font-mono");
  });
  it("pista opcional: solo se pinta si existe", () => {
    expect(render({ hint: "de 10" })).toContain("de 10");
    expect(render({})).not.toContain("text-muted-foreground");
  });
  it("tono de alerta: color de la cifra o de la pista", () => {
    expect(render({ tone: "signal" })).toContain("text-signal");
    expect(render({ hint: "x", hintTone: "alarm" })).toContain("text-state-alarm");
    expect(render({ hint: "x", hintTone: "signal" })).toContain("text-signal");
  });
});

describe("Panel", () => {
  it("pinta título, acción y contenido", () => {
    const h = renderToStaticMarkup(createElement(Panel, { title: "Título", action: createElement("a", { href: "#" }, "Ver"), children: "Cuerpo" }));
    expect(h).toContain("Título");
    expect(h).toContain("Ver");
    expect(h).toContain("Cuerpo");
  });
});
