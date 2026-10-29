import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useOpenDocFromUrl } from "@/hooks/use-open-doc-from-url";

const doc = (id: string) => ({ id });

describe("useOpenDocFromUrl (SDD-20261028 H-3)", () => {
  it("CA-11: opens the document of the URL once and ignores a missing one", () => {
    const onOpen = vi.fn();
    const { rerender } = renderHook(({ id, docs }) => useOpenDocFromUrl(id, docs, onOpen), {
      initialProps: { id: "a" as string | undefined, docs: [doc("a"), doc("b")] },
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(doc("a"));
    rerender({ id: "zzz", docs: [doc("a"), doc("b")] });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("CA-12: a created, deleted or imported document does not reopen the URL document", () => {
    const onOpen = vi.fn();
    const { rerender } = renderHook(({ docs }) => useOpenDocFromUrl("a", docs, onOpen), {
      initialProps: { docs: [doc("a"), doc("b")] },
    });
    rerender({ docs: [doc("a"), doc("b"), doc("c")] });
    rerender({ docs: [doc("a"), doc("c")] });
    rerender({ docs: [doc("a"), doc("c"), doc("d")] });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("CA-13: a new value of the parameter opens the new document", () => {
    const onOpen = vi.fn();
    const docs = [doc("a"), doc("b")];
    const { rerender } = renderHook(({ id }) => useOpenDocFromUrl(id, docs, onOpen), {
      initialProps: { id: "a" },
    });
    rerender({ id: "b" });
    expect(onOpen.mock.calls.map((c) => c[0].id)).toEqual(["a", "b"]);
  });

  it("CA-14: when the list arrives late, the document opens on arrival and then stays put", () => {
    const onOpen = vi.fn();
    const { rerender } = renderHook(({ docs }) => useOpenDocFromUrl("a", docs, onOpen), {
      initialProps: { docs: [] as { id: string }[] },
    });
    expect(onOpen).not.toHaveBeenCalled();
    rerender({ docs: [doc("a")] });
    expect(onOpen).toHaveBeenCalledTimes(1);
    rerender({ docs: [doc("a"), doc("b")] });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
