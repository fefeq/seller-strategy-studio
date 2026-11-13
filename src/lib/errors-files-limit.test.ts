// @vitest-environment node
// NK-0164 CA-3: a too_big on the documents list says the limit instead of the generic «Algún valor es demasiado grande».
import { describe, expect, it } from "vitest";
import { errorText } from "./errors";

const issue = (over: object) =>
  JSON.stringify(
    [
      {
        origin: "array",
        code: "too_big",
        maximum: 3,
        inclusive: true,
        path: ["files"],
        message: "Too big: expected array to have <=3 items",
        ...over,
      },
    ],
    null,
    2,
  );

describe("errorText: too many documents (NK-0164 CA-3)", () => {
  it("names the limit and how to go on", () => {
    expect(errorText(new Error(issue({})))).toBe(
      "Una lectura admite hasta 3 documentos. Para añadir más, súbelos a Drive y elígelos desde ahí, o pega su texto.",
    );
  });
  it("finds the files path when it is nested", () => {
    expect(errorText(new Error(issue({ path: ["input", "files"] })))).toMatch(
      /^Una lectura admite hasta 3 documentos/,
    );
  });
  it("other arrays and other fields keep the generic text", () => {
    expect(errorText(new Error(issue({ path: ["words"] })))).toBe(
      "Algún valor es demasiado grande. Revísalo y vuelve a intentarlo.",
    );
    expect(errorText(new Error(issue({ origin: "string", path: ["files"] })))).toBe(
      "El texto es demasiado largo. Recórtalo y vuelve a intentarlo.",
    );
  });
});
