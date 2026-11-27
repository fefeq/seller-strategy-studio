import { describe, expect, it } from "vitest";
import {
  BAJADA,
  EJEMPLO,
  MENSAJES,
  PROMESAS,
  TEMAS_NO_LISTOS,
  TITULAR,
  mensajeDelEnvio,
  revisarContacto,
} from "./landing-copy";

const todoElTexto = [
  TITULAR,
  BAJADA,
  ...PROMESAS.flatMap((p) => [p.titulo, p.texto]),
  EJEMPLO.cuenta,
  EJEMPLO.aviso,
  EJEMPLO.aclaracion,
].join(" ");

describe("textos de la página", () => {
  it("no menciona lo que aún no está listo", () => {
    const t = todoElTexto.toLowerCase();
    for (const tema of TEMAS_NO_LISTOS) expect(t).not.toContain(tema);
  });

  it("cada promesa dice dónde se usa dentro de la app", () => {
    for (const p of PROMESAS) expect(p.enLaApp.trim().length).toBeGreaterThan(0);
  });

  it("no muestra cifras", () => {
    expect(todoElTexto).not.toMatch(/\d/);
  });

  it("el titular dice qué hace y para quién", () => {
    expect(TITULAR.toLowerCase()).toContain("estrategia comercial");
    expect(TITULAR.toLowerCase()).toContain("equipo de ventas");
  });
});

describe("revisión del formulario", () => {
  it("rechaza el formulario vacío", () => {
    expect(revisarContacto({})).toEqual({ ok: false, mensaje: MENSAJES.faltaNombre });
  });

  it("rechaza un correo mal escrito", () => {
    expect(revisarContacto({ nombre: "Ana", correo: "ana@correo" })).toEqual({
      ok: false,
      mensaje: MENSAJES.correoInvalido,
    });
  });

  it("rechaza textos muy largos y con enlaces", () => {
    expect(
      revisarContacto({ nombre: "Ana", correo: "ana@ejemplo.com", mensaje: "x".repeat(1001) }),
    ).toEqual({ ok: false, mensaje: MENSAJES.muyLargo });
    expect(
      revisarContacto({ nombre: "Ana", correo: "ana@ejemplo.com", mensaje: "mira https://sitio.com" }),
    ).toEqual({ ok: false, mensaje: MENSAJES.conEnlaces });
  });

  it("acepta un contacto correcto", () => {
    const r = revisarContacto({ nombre: " Ana ", correo: " Ana@Ejemplo.com " });
    expect(r).toEqual({ ok: true, datos: { nombre: "Ana", correo: "ana@ejemplo.com" } });
  });
});

describe("mensajes del envío", () => {
  it("avisa cuando ya se había recibido", () => {
    expect(mensajeDelEnvio({ ok: true, duplicado: true })).toBe(MENSAJES.duplicado);
  });

  it("nunca muestra el error tal cual llega", () => {
    expect(mensajeDelEnvio(new Error("duplicate key value violates constraint"))).toBe(MENSAJES.falla);
    expect(mensajeDelEnvio(undefined)).toBe(MENSAJES.falla);
  });
});
