// NK-0134 CA-3: the label of a Field is tied to its input, so it is found by accessible name.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "@/components/fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

describe("Field", () => {
  it("names its input by the label, for an input and for a textarea", () => {
    render(
      <>
        <Field label="Nombre">
          <Input />
        </Field>
        <Field label="Notas">
          <Textarea />
        </Field>
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Nombre" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Notas" })).toBeInTheDocument();
  });
  it("two fields never share an id", () => {
    render(
      <>
        <Field label="Uno">
          <Input />
        </Field>
        <Field label="Dos">
          <Input />
        </Field>
      </>,
    );
    expect(screen.getByLabelText("Uno").id).not.toBe(screen.getByLabelText("Dos").id);
  });
  it("keeps the explicit name of a child that already has one", () => {
    render(
      <Field label="Etiqueta">
        <Input aria-label="Nombre propio" id="mio" />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "Nombre propio" })).toHaveAttribute("id", "mio");
  });
});
