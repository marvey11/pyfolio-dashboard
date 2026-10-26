import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
  localStorage.clear();
});
