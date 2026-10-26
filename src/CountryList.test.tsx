import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "./app-test-setup";
import { country, pageJson, security } from "./app-test-fixtures";
import App from "./App";

describe("CountryList", () => {
  it("persists page sizes separately for securities and countries", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.includes("/countries?"))
          return Promise.resolve(pageJson([country], 1, 500, 1));
        return Promise.resolve(pageJson([security], 1, 25, 1));
      });
    render(<App />);

    expect(await screen.findByText("Apple")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), {
      target: { value: "10" },
    });
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining("page=1&pageSize=10"),
        expect.anything(),
      );
    });
    expect(localStorage.getItem("pyfolio.securities.page-size")).toBe("10");

    fireEvent.click(screen.getByRole("link", { name: /Countries/ }));
    expect(await screen.findByText("Germany")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Rows per page" })).toHaveValue(
      "25",
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), {
      target: { value: "50" },
    });
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining("page=1&pageSize=50"),
        expect.anything(),
      );
    });
    expect(localStorage.getItem("pyfolio.countries.page-size")).toBe("50");
    expect(localStorage.getItem("pyfolio.securities.page-size")).toBe("10");
  });
});
