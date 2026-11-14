// Ola 0.1: the Gmail card says what the code really reads, keeps, for how long, and what disconnecting does.
import { describe, expect, it } from "vitest";
import { CONNECTED_TEXT, DISCONNECT_TEXT } from "./mailbox-copy";
import { DERIVED_TTL_DAYS } from "@/lib/reply-inbox/classification";

describe("Gmail card copy", () => {
  it("no longer promises it reads only sender and date", () => {
    expect(CONNECTED_TEXT("a@b.com")).not.toMatch(/solo lee remitente y fecha/i);
  });
  it("says the body is read and not stored", () => {
    expect(CONNECTED_TEXT("a@b.com")).toMatch(/texto/);
    expect(CONNECTED_TEXT("a@b.com")).toMatch(/no se guarda/);
  });
  it("states the real retention of what is kept", () => {
    expect(DERIVED_TTL_DAYS).toBe(30);
    expect(CONNECTED_TEXT("a@b.com")).toContain(`${DERIVED_TTL_DAYS} días`);
  });
  it("disconnect deletes what was read and keeps marks and counter", () => {
    expect(DISCONNECT_TEXT).toMatch(/borra/);
    expect(DISCONNECT_TEXT).toMatch(/contador/);
    expect(DISCONNECT_TEXT).toMatch(/respondió/);
  });
});
