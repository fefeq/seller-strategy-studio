import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// The LinkedIn legal pause is a global server flag (SDD pausa-legal-linkedin-y-gasto): unit tests of unrelated
// behavior run with the pause OFF so they keep meaning what they meant. The pause itself has its own tests
// (linkedin-legal.test.ts, linkedin-legal-server.test.ts) and any file can override this with its own vi.mock.
vi.mock("@/lib/linkedin-legal.server", () => ({
  linkedinExtractionPaused: async () => false,
  assertLinkedinExtractionAllowed: async () => {},
}));

// Tests that opt into the node environment (the Postgres migration tests) have no window.
if (typeof window !== "undefined") {
Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
}

// Tests never reach real external services (AI providers, Apollo, web): a call that no test mocked fails at once
// instead of waiting on the network and spending real credits. Tests that need fetch mock it themselves.
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/^https?:\/\//.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url))
    return Promise.reject(new TypeError(`Network disabled in tests: ${new URL(url).host}`));
  return realFetch(input, init);
}) as typeof fetch;
