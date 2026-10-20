import { describe, expect, it } from "vitest";
import { errorText } from "./errors";

describe("errorText", () => {
  it("translates Postgres codes", () => {
    expect(errorText({ code: "23505", message: 'duplicate key value violates unique constraint "x"' })).toMatch(/^Ya existe/);
    expect(errorText({ code: "23503", message: "violates foreign key constraint" })).toMatch(/dependen/);
    expect(errorText({ code: "42501", message: "new row violates row-level security policy" })).toMatch(/Tu rol/);
  });
  it("translates RLS by message too", () => expect(errorText({ message: 'new row violates row-level security policy for table "deals"' })).toMatch(/Tu rol/));
  it("translates auth errors", () => {
    expect(errorText({ message: "Invalid login credentials", status: 400 })).toMatch(/contraseña no son correctos/);
    expect(errorText({ message: "JWT expired", code: "PGRST301" })).toMatch(/sesión ha caducado/);
  });
  it("translates network errors", () => expect(errorText(new TypeError("Failed to fetch"))).toMatch(/conexión/));
  it("keeps our own Spanish messages", () => {
    expect(errorText(new Error("Selecciona una empresa"))).toBe("Selecciona una empresa");
    expect(errorText(new Error("No he podido leer esa web. Prueba a pegar el texto."))).toBe("No he podido leer esa web. Prueba a pegar el texto.");
    expect(errorText("La fecha no puede ser anterior al alta")).toBe("La fecha no puede ser anterior al alta");
  });
  it("hides unknown English messages behind a generic Spanish one", () => {
    expect(errorText(new Error("Something unexpected happened in the pipeline"))).toMatch(/^Algo ha fallado/);
    expect(errorText(null)).toMatch(/^Algo ha fallado/);
    expect(errorText(undefined, "No se ha podido guardar.")).toBe("No se ha podido guardar.");
  });
});
