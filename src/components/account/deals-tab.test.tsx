// SDD-20261109-new-deal-source U-4 (NK-0123) CA-6: the Deals tab of an account has a visible «Fuente» next to «+ Nuevo deal»
// and its insert always carries `source` (null for «Sin origen») and the validated user as owner. Fictional data; supabase mocked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({ insert: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert: hoisted.insert }) },
}));
vi.mock("@/lib/session", () => ({ validatedUser: async () => ({ id: "user-1" }) }));
vi.mock("@/hooks/use-me", () => ({ useCurrency: () => ({ money: (n: number) => `${n} €` }) }));
vi.mock("@/components/stage-settings", () => ({
  useStages: () => ({
    stages: [{ key: "discovery", label: "Discovery", probability: 10, kind: "open", position: 1 }],
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/deals">{children}</a>,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { DealsTab } from "@/components/account/calls-deals-tabs";

const onChange = vi.fn();
const source = () => screen.getByRole("combobox", { name: "Fuente" }) as HTMLSelectElement;
const add = async () => {
  fireEvent.click(screen.getByRole("button", { name: "+ Nuevo deal" }));
  await waitFor(() => expect(hoisted.insert).toHaveBeenCalledTimes(1));
  return hoisted.insert.mock.calls[0]![0] as Record<string, unknown>;
};

beforeEach(() => {
  hoisted.insert.mockReset();
  hoisted.insert.mockResolvedValue({ error: null });
  onChange.mockReset();
  render(<DealsTab accountId="acc-1" list={[]} onChange={onChange} />);
});
afterEach(cleanup);

describe("DealsTab «Fuente»", () => {
  it("shows a visible «Fuente» label and the selector on «Sin origen»", () => {
    expect(screen.getByText("Fuente")).toBeTruthy();
    expect(source().selectedOptions[0]!.textContent).toBe("Sin origen");
  });
  it("inserts source null, with the validated user as owner, when nobody touches it", async () => {
    const row = await add();
    expect(row).toHaveProperty("source", null);
    expect(row.owner_id).toBe("user-1");
    expect(row.account_id).toBe("acc-1");
  });
  it("inserts the chosen source, still with the validated user as owner", async () => {
    fireEvent.change(source(), { target: { value: "event" } });
    const row = await add();
    expect(row.source).toBe("event");
    expect(row.owner_id).toBe("user-1");
  });
  it("goes back to «Sin origen» after creating", async () => {
    fireEvent.change(source(), { target: { value: "event" } });
    await add();
    await waitFor(() => expect(source().selectedOptions[0]!.textContent).toBe("Sin origen"));
  });
});
