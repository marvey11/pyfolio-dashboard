import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "./app-test-setup";
import App from "./App";

describe("app routing", () => {
  it("shows a useful fallback for an unknown nested route", () => {
    window.history.replaceState({}, "", "/does-not-exist");
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to securities" }),
    ).toHaveAttribute("href", "/securities");
  });
});
