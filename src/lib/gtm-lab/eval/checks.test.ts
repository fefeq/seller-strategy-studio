// From gtm-lab@44f385b scripts/eval-checks.test.mjs, typed for TypeScript; same cases (NK-0048 CA-13).
import { beforeAll, describe, expect, it } from "vitest";
import { validateDeliverable } from "../core";
import { framework } from "../methodology";
import {
  checkNotes,
  finished,
  inventedNumbers,
  isRefusalOrCut,
  languageIssues,
  optionsText,
  runChecks,
  slopIssues,
  type Validate,
} from "./checks";

// Oracle and null cases for the free checks of the eval (SDD usuarios-reales, CA-6).
const SOURCE = [
  "- ¿Qué quieres haber conseguido en 12 meses?: 15 clínicas de pago",
  "- Tamaño de empresa: 8-25 personas",
  "- Qué le hace buscar una solución: guardias de 24 h y piloto de 3 meses",
].join("\n");

const GOOD = {
  for_whom: "Clínicas veterinarias con urgencias de 8-25 personas",
  problem: "Cuadrar las guardias de 24 h a mano genera conflictos y horas extra.",
  how: "Turnos y guardias automáticos con reglas de descanso pensadas para urgencias.",
  result:
    "El cuadrante se cierra sin discusiones y tú dejas de rehacerlo cada mes [comprueba el ahorro con el piloto].",
};

let validate: Validate;
beforeAll(() => {
  validate = (output) => validateDeliverable(framework, "value-proposition", output, "done");
});

const ok = (output: unknown) => ({ stopReason: "end_turn", output });

describe("runChecks (CA-6)", () => {
  it("a good, grounded answer in Spanish with «tú» passes every check (oracle)", () => {
    const report = runChecks({ validate, source: SOURCE, result: ok(GOOD) });
    expect(report.checks).toEqual({
      finished: [],
      valid: [],
      numbers: [],
      language: [],
      slop: [],
      notes: [],
    });
    expect(report.pass).toBe(true);
  });

  it("an empty answer fails (null)", () => {
    const report = runChecks({ validate, source: SOURCE, result: ok({}) });
    expect(report.checks.valid.length).toBeGreaterThan(0);
    expect(report.pass).toBe(false);
  });

  it("an answer with invented figures fails and names them", () => {
    const report = runChecks({
      validate,
      source: SOURCE,
      result: ok({
        ...GOOD,
        result: "Ahorras un 30 % de horas extra, como 120 clínicas antes que tú.",
      }),
    });
    expect(report.checks.numbers).toEqual(["30", "120"]);
    expect(report.pass).toBe(false);
  });

  it("an answer with AI filler fails (Fede, 2026-11-01: no «AI slop»)", () => {
    const report = runChecks({
      validate,
      source: SOURCE,
      result: ok({ ...GOOD, how: "Una solución integral e innovadora que potencia a tu equipo." }),
    });
    expect(report.checks.slop).toEqual(["«solución integral»", "«innovadora»", "«potencia»"]);
    expect(report.pass).toBe(false);
  });

  it("a refused, truncated or unparsed answer fails without running the other checks", () => {
    for (const result of [
      { stopReason: "refusal", output: null },
      { stopReason: "max_tokens", output: null },
      { stopReason: "end_turn", output: null },
    ]) {
      const report = runChecks({ validate, source: SOURCE, result });
      expect(report.checks.finished).toHaveLength(1);
      expect(report.pass).toBe(false);
    }
  });
});

describe("finished", () => {
  it("passes only a normal end with parsed output", () => {
    expect(finished(ok(GOOD))).toEqual([]);
    expect(finished({ stopReason: "max_tokens", output: GOOD })).toEqual([
      "stop_reason: max_tokens",
    ]);
  });
});

describe("optionsText (SDD plan: a fixed option of the form is not an invented figure)", () => {
  const schema = {
    type: "object",
    properties: {
      when: { type: "string", enum: ["Semanas 1 a 4", "Semanas 9 a 13"] },
      items: {
        type: "array",
        items: { type: "object", properties: { kind: { enum: ["Cada mes"] } } },
      },
    },
  };

  it("collects the options of every select in the schema, nested ones included", () => {
    expect(optionsText(schema)).toBe("Semanas 1 a 4\nSemanas 9 a 13\nCada mes");
  });
  it("an option the model had in its schema does not count as invented", () => {
    const source = `contexto\n${optionsText(schema)}`;
    expect(inventedNumbers({ when: "Semanas 9 a 13" }, source)).toEqual([]);
  });
  it("a figure that is not an option still counts", () => {
    expect(
      inventedNumbers(
        { when: "Semanas 9 a 13", other: "Semanas 20 a 30" },
        `contexto\n${optionsText(schema)}`,
      ),
    ).toEqual(["20", "30"]);
  });
  it("a schema without options adds nothing", () => {
    expect(optionsText({ type: "object", properties: { a: { type: "string" } } })).toBe("");
  });
});

describe("inventedNumbers with prices (SDD precio, CA-9)", () => {
  const source = "- Precios de las alternativas: sin dato";
  it("accepts a price marked as a proposal", () => {
    expect(
      inventedNumbers({ price: "[propuesta: 49 € al mes]", includes: "Recordatorios" }, source),
    ).toEqual([]);
  });
  it("flags a price shown as fact, and a competitor price the context does not carry", () => {
    expect(inventedNumbers({ price: "49 € al mes" }, source)).toEqual(["49"]);
    expect(
      inventedNumbers({ reference: "El software genérico cobra 30 € al mes" }, source),
    ).toEqual(["30"]);
  });
  it("accepts a competitor price that is in the context, as is", () => {
    expect(
      inventedNumbers(
        { reference: "El software genérico cobra 30 € al mes" },
        "- Precios: 30 € al mes",
      ),
    ).toEqual([]);
  });
});

describe("inventedNumbers", () => {
  it("accepts figures that appear in the context, including both ends of a range and decimals with comma", () => {
    expect(
      inventedNumbers(
        { a: "Llegar a 15 clínicas en 12 meses", b: ["equipos de 8 a 25 personas"] },
        SOURCE,
      ),
    ).toEqual([]);
    expect(inventedNumbers({ a: "Un ratio de 2,5" }, "ratio 2.5")).toEqual([]);
  });

  it("flags each invented figure once, in reading order, inside nested lists", () => {
    const output = {
      segments: [{ who: "Unos 40 talleres" }, { who: "40 o 7 por zona" }],
      note: "sin dato",
    };
    expect(inventedNumbers(output, SOURCE)).toEqual(["40", "7"]);
  });

  it("ignores enumeration markers such as «(1)» or «2)», but not a figure in parentheses", () => {
    expect(
      inventedNumbers(
        { a: "Cumplen a la vez: (1) cuadrante publicado y (2) personal que lo consulta." },
        "",
      ),
    ).toEqual([]);
    expect(
      inventedNumbers({ a: "Tres condiciones: 1) pagado, 2) recogido y 3) entregado." }, ""),
    ).toEqual([]);
    expect(inventedNumbers({ a: "Prueba gratis (30 días) y luego 2) nada más" }, "")).toEqual([
      "30",
    ]);
  });

  it("does not count figures marked as a proposal, but still flags unmarked ones (SDD instrucciones-ia, CA-4)", () => {
    expect(
      inventedNumbers({ a: "Al menos [propuesta: 80 %] del equipo ficha cada semana" }, ""),
    ).toEqual([]);
    expect(inventedNumbers({ a: "Al menos el 80 % del equipo ficha cada semana" }, "")).toEqual([
      "80",
    ]);
    expect(inventedNumbers({ a: "[Comprueba: si 6 meses es realista]" }, "")).toEqual(["6"]);
  });

  it("flags a figure that closes a parenthesis (review finding 3)", () => {
    expect(inventedNumbers({ a: "Muestra mínima (30)", b: "(objetivo: llegar a 40)" }, "")).toEqual(
      ["30", "40"],
    );
  });

  it("reads Spanish thousands separators and compares the whole number (review finding 4)", () => {
    expect(inventedNumbers({ a: "Unas 1.500 altas" }, "1500 altas")).toEqual([]);
    expect(inventedNumbers({ a: "Hasta 2.000.500 €" }, "2.000.000 €")).toEqual(["2000500"]);
  });

  it("does not read digits inside a word such as «B2B» as a figure (review finding 4)", () => {
    expect(inventedNumbers({ a: "Grupos de 2 a 5 talleres" }, "Founders B2B")).toEqual(["2", "5"]);
  });

  it("does not take digits inside a longer number as a match", () => {
    expect(inventedNumbers({ a: "150 clínicas" }, SOURCE)).toEqual(["150"]);
  });
});

describe("languageIssues", () => {
  it("passes Spanish with «tú» (control)", () => {
    expect(
      languageIssues({
        a: "Elige tu segmento y escribe a tus clientes; puedes empezar esta semana.",
      }),
    ).toEqual([]);
  });

  it("flags «usted»", () => {
    expect(languageIssues({ a: "Usted puede empezar con su segmento." })).toEqual([
      "usted: «Usted»",
    ]);
  });

  it("flags voseo", () => {
    expect(
      languageIssues({ a: "Elegí un segmento", b: ["Si podés, hablá con 5 clientes"] }),
    ).toEqual(["voseo: «Elegí»", "voseo: «podés»", "voseo: «hablá»"]);
  });

  it("does not take ordinary accented Spanish words for voseo (control)", () => {
    expect(
      languageIssues({
        a: "Más clientes después de la prueba, a través del país; ya sabes qué elegir.",
      }),
    ).toEqual([]);
  });

  it("flags «vos» and a single field in English inside a Spanish answer (review finding 5)", () => {
    expect(languageIssues({ a: "Esto lo decidís vos" })).toEqual(["voseo: «vos»"]);
    expect(
      languageIssues({
        a: "Turnos y guardias con reglas de descanso para tu clínica y para el equipo de la clínica.",
        b: "Help your team close the schedule with fewer conflicts.",
      }),
    ).toEqual(["idioma: parece inglés"]);
  });

  it("flags an answer in English", () => {
    expect(
      languageIssues({
        a: "Help your team close the schedule with fewer conflicts and more rest for the vets.",
      }),
    ).toEqual(["idioma: parece inglés"]);
  });
});

describe("slopIssues", () => {
  it("passes plain, specific Spanish (control)", () => {
    expect(
      slopIssues({
        headline: "Cuadra las guardias de tu clínica sin hojas de cálculo",
        message:
          "Turnos y guardias con reglas de descanso. Tu equipo sabe con antelación cuándo le toca.",
        proofs: [{ proof: "Piloto de 3 meses en 2 clínicas; ambas lo siguen usando." }],
      }),
    ).toEqual([]);
  });

  it("flags buzzwords and stock phrases, each once, in reading order", () => {
    const output = {
      a: "Revolucionamos la gestión con una plataforma de vanguardia que lleva tu clínica al siguiente nivel.",
      b: [
        "Desbloquea sinergias y empodera a tu equipo.",
        "Una experiencia fluida y sin fisuras, revolucionaria.",
      ],
    };
    expect(slopIssues(output)).toEqual([
      "«Revolucionamos»",
      "«de vanguardia»",
      "«al siguiente nivel»",
      "«Desbloquea»",
      "«sinergias»",
      "«empodera»",
      "«experiencia fluida»",
      "«sin fisuras»",
    ]);
  });

  it("flags filler openers and «no solo… sino también»", () => {
    expect(
      slopIssues({
        a: "En el mundo actual, no solo ahorras tiempo, sino también dinero. Cabe destacar que es clave.",
      }),
    ).toEqual(["«En el mundo actual»", "«no solo… sino también»", "«Cabe destacar»"]);
  });

  it("flags em dashes, exclamations and emojis as AI smell", () => {
    expect(
      slopIssues({ a: "Tu agenda — siempre llena", b: "¡Empieza hoy!", c: "Listo 🚀" }),
    ).toEqual(["raya «—»", "exclamación «¡»", "emoji «🚀»"]);
  });

  it("does not take ©, ® or ™ for emojis (review finding 5)", () => {
    expect(slopIssues({ a: "Compatible con Excel® y WhatsApp™ ©" })).toEqual([]);
  });

  it("does not flag ordinary words that contain a buzzword stem (control)", () => {
    expect(
      slopIssues({
        a: "Potencial cliente: una potencia de 5 kW no aplica; innovación no es lo mismo.",
      }),
    ).toEqual([]);
  });
});

describe("checkNotes (SDD instrucciones-ia, CA-4)", () => {
  it("passes one check note and proposals in an ordinary field (oracle)", () => {
    expect(
      checkNotes({
        definition:
          "Citas atendidas por taller y semana, con [propuesta: 4] semanas de media. [Comprueba: si el taller marca las citas atendidas.]",
      }),
    ).toEqual([]);
  });

  it("flags more than one check note per suggestion", () => {
    expect(checkNotes({ a: "Uno. [Comprueba: esto.]", b: ["Dos. [Comprueba: aquello.]"] })).toEqual(
      ["2 avisos «[Comprueba…]» (máximo 1)"],
    );
  });

  it("counts any other bracket as a check note, so old-style notes do not slip through", () => {
    expect(checkNotes({ a: "Uno [verifica con 3 dueños]", b: "Dos [sin dato todavía]" })).toEqual([
      "2 avisos «[Comprueba…]» (máximo 1)",
    ]);
  });

  it("flags any bracket inside a headline or message, proposals included", () => {
    expect(
      checkNotes({
        headline: "Agenda llena [Comprueba: el dato]",
        message: "Ficha en [propuesta: 2] segundos.",
      }),
    ).toEqual(["corchetes en «headline»", "corchetes en «message»"]);
  });

  it("passes a suggestion without brackets (null case for the check)", () => {
    expect(
      checkNotes({
        headline: "Agenda llena sin coger el teléfono",
        message: "Reservas por WhatsApp.",
      }),
    ).toEqual([]);
  });
});

describe("isRefusalOrCut (counted apart for criterio.md §5)", () => {
  it("refusals and cut answers count apart; a normal end does not", () => {
    expect(isRefusalOrCut("refusal")).toBe(true);
    expect(isRefusalOrCut("max_tokens")).toBe(true);
    expect(isRefusalOrCut(null)).toBe(true);
    expect(isRefusalOrCut("end_turn")).toBe(false);
  });
});
