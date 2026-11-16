import { expect, it, vi } from "vitest";
import { controlCustomPlay, type ControlPorts } from "./controls-core";
import type { Tables } from "@/integrations/supabase/types";
const row: Tables<"custom_plays"> = {
  id: "test",
  org_id: "org",
  key: "custom:test",
  name: "Prueba sintética",
  definition: {},
  verified_only: false,
  created_at: "now",
  updated_at: "now",
  status: "pausado",
  execution_pause: null,
  lease_token: null,
  lease_until: null,
  first_activated_at: null,
  test_sample: null,
  test_successes: null,
  test_recorded_at: null,
};
const ports = (): ControlPorts => ({
  load: vi.fn().mockResolvedValue(row),
  activationCheck: vi.fn(),
  save: vi.fn(),
});
it("CA-2 refuses a non-leader before reading or writing", async () => {
  const p = ports();
  await expect(
    controlCustomPlay(p, ["ae"], { kind: "toggle", enabled: true }, "now"),
  ).rejects.toThrow();
  expect(p.load).not.toHaveBeenCalled();
  expect(p.save).not.toHaveBeenCalled();
});
it("CA-3 failed activation validation never writes or bypasses sources", async () => {
  const p = ports();
  p.activationCheck = vi.fn().mockRejectedValue(new Error("Fuente no disponible"));
  await expect(
    controlCustomPlay(p, ["owner"], { kind: "toggle", enabled: true }, "now"),
  ).rejects.toThrow("Fuente");
  expect(p.save).not.toHaveBeenCalled();
});
it("CA-3 pause does not validate sources, clear safety pause or lease", async () => {
  const p = ports();
  p.load = vi.fn().mockResolvedValue({ ...row, execution_pause: "uncertain" });
  await controlCustomPlay(p, ["sales_leader"], { kind: "toggle", enabled: false }, "now");
  expect(p.activationCheck).not.toHaveBeenCalled();
  expect(p.save).toHaveBeenCalledWith(expect.objectContaining({ execution_pause: "uncertain" }), {
    status: "pausado",
    first_activated_at: null,
    updated_at: "now",
  });
});
it("CA-4 records observed result without activating or making provider calls", async () => {
  const p = ports();
  await controlCustomPlay(
    p,
    ["owner"],
    { kind: "result", sample: 20, successes: 0 },
    "2026-11-14T00:00:00Z",
  );
  expect(p.activationCheck).not.toHaveBeenCalled();
  expect(p.save).toHaveBeenCalledWith(
    row,
    expect.objectContaining({
      test_sample: 20,
      test_successes: 0,
      test_recorded_at: "2026-11-14T00:00:00Z",
    }),
  );
});
