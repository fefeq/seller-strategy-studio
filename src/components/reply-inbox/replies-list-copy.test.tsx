import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RepliesList } from "./replies-list";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("Aviso de privacidad de Respuestas", () => {
  it("explica la lectura de respuestas humanas sin guardar su texto", () => {
    render(<RepliesList rows={[]} />);
    expect(screen.getByText(/La IA lee el texto de las respuestas humanas/).textContent).toContain(
      "solo para clasificarlas y proponerte un borrador; ese texto no se guarda",
    );
  });

  it("declara 30 días para categoría, borrador y datos deducidos", () => {
    render(<RepliesList rows={[]} />);
    expect(screen.getByText(/La IA lee el texto de las respuestas humanas/).textContent).toContain(
      "la categoría, el borrador y los datos que deduce (persona referida, fecha de vuelta), que se borran a los 30 días",
    );
  });
});