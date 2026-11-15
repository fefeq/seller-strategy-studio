// NK-0185: the error text of a note a person reads later (autopilot, discoveries).
import { expect, it } from "vitest";
import { NOTE_FALLBACK, noteErrorText } from "@/lib/errors";

const withStatus = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

it("a message we wrote in Spanish stays as it is, whatever its status", () => {
  for (const [msg, status] of [
    ["La clave de Gemini no es válida. Revísala en Conexiones.", 401],
    ["Sin saldo en OpenRouter. Recárgalo para seguir.", 402],
    ["Se ha agotado la cuota de la clave de Gemini.", 429],
  ] as const)
    expect(noteErrorText(withStatus(msg, status))).toBe(msg);
});

it("an English, technical or empty error never shows its text", () => {
  for (const e of [
    new TypeError("Cannot read properties of undefined (reading 'id')"),
    new Error('relation "accounts" does not exist'),
    new Error(""),
    null,
    undefined,
    { message: 42 },
  ]) {
    const text = noteErrorText(e);
    expect(text).not.toMatch(/undefined|relation|accounts/);
    expect(text.length).toBeGreaterThan(10);
  }
  expect(noteErrorText(new TypeError("x is not a function"))).toBe(NOTE_FALLBACK);
});

it("the fallback does not ask to reload a page: the note is read in a background job", () => {
  expect(NOTE_FALLBACK).not.toMatch(/recarga/i);
});
