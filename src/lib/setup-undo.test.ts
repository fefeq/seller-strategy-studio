import { describe, expect, it } from "vitest";
import { isUndoRef, undoRefFor } from "./setup-undo";

const id = "4f6c2a1e-1111-4222-8333-444455556666";
describe("setup undo", () => {
  it("keeps what the batch created and nothing it updated", () => {
    expect(undoRefFor("create_icp", {}, { id })).toEqual({ table: "icp_profiles", id });
    expect(undoRefFor("upsert_segment", { name: "Agencias" }, { id })).toEqual({
      table: "segments",
      id,
    });
    expect(undoRefFor("upsert_segment", { segment_id: id, name: "Agencias" }, { id })).toBeNull();
    expect(undoRefFor("update_positioning", {}, { id })).toBeNull();
    expect(undoRefFor("create_account", {}, null)).toBeNull();
  });
  it("accepts only known tables and uuids from the client", () => {
    expect(isUndoRef({ table: "accounts", id })).toBe(true);
    expect(isUndoRef({ table: "organizations", id })).toBe(false);
    expect(isUndoRef({ table: "accounts", id: "1; drop" })).toBe(false);
  });
});
