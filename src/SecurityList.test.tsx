import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "./app-test-setup";
import { country, json, pageJson, security } from "./app-test-fixtures";
import App from "./App";

describe("SecurityList", () => {
  it("renders securities and applies a sort action", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json([security]))
      .mockResolvedValueOnce(json([country]));
    render(<App />);
    expect(await screen.findByText("Apple")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Name/ }));
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining("sort_by=name&sort_order=asc"),
        expect.anything(),
      );
    });
  });
  it("uses pagination metadata instead of inferring a next page from a full page", async () => {
    const securities = Array.from({ length: 25 }, (_, index) => ({
      ...security,
      id: index + 1,
      name: `Security ${String(index + 1)}`,
    }));
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.includes("/countries?")) return Promise.resolve(json([]));
        if (url.includes("/securities?") && url.includes("page=2"))
          return Promise.resolve(json([]));
        return Promise.resolve(json(securities));
      });
    render(<App />);

    expect(await screen.findByText("Security 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining("page=1&pageSize=25"),
        expect.anything(),
      );
    });
  });
  it("falls back to the default page size when stored data is invalid", async () => {
    localStorage.setItem("pyfolio.securities.page-size", "15");
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
          return Promise.resolve(pageJson([], 1, 500, 0));
        return Promise.resolve(pageJson([security], 1, 25, 1));
      });
    render(<App />);

    expect(await screen.findByText("Apple")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Rows per page" })).toHaveValue(
      "25",
    );
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("page=1&pageSize=25"),
      expect.anything(),
    );
  });
  it("resets to page one when filters or sorting change", async () => {
    const securities = Array.from({ length: 25 }, (_, index) => ({
      ...security,
      id: index + 1,
      name: `Security ${String(index + 1)}`,
    }));
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
        const requestUrl = new URL(url, "http://localhost");
        const requestPage = Number(requestUrl.searchParams.get("page"));
        const filtered = requestUrl.searchParams.has("instrument_type");
        const items =
          requestPage === 1
            ? securities
            : [{ ...security, id: 26, name: "Security 26" }];
        return Promise.resolve(
          pageJson(items, requestPage, 25, filtered ? 26 : 26),
        );
      });
    render(<App />);

    expect(await screen.findByText("Security 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Security 26")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Instrument type"), {
      target: { value: "stock" },
    });
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining("page=1&pageSize=25"),
        expect.anything(),
      );
    });
    expect(await screen.findByText("Security 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Name/ }));
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining(
          "page=1&pageSize=25&sort_by=name&sort_order=asc&instrument_type=stock",
        ),
        expect.anything(),
      );
    });
  });
  it("moves to the last valid page after deleting the only row on a stale page", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let securities = Array.from({ length: 26 }, (_, index) => ({
      ...security,
      id: index + 1,
      name: `Security ${String(index + 1)}`,
    }));
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.includes("/countries?"))
          return Promise.resolve(pageJson([], 1, 500, 0));
        if (url.endsWith("/securities/26") && init?.method === "DELETE") {
          securities = securities.filter((item) => item.id !== 26);
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        const requestUrl = new URL(url, "http://localhost");
        const requestPage = Number(requestUrl.searchParams.get("page"));
        const items = securities.slice(
          (requestPage - 1) * 25,
          requestPage * 25,
        );
        return Promise.resolve(
          pageJson(items, requestPage, 25, securities.length),
        );
      });
    render(<App />);

    expect(await screen.findByText("Security 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Security 26")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete Security 26" }));

    expect(await screen.findByText("Security 1")).toBeInTheDocument();
    expect(screen.queryByText("No securities on this page")).toBeNull();
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining("page=2&pageSize=25"),
        expect.anything(),
      );
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining("page=1&pageSize=25"),
        expect.anything(),
      );
    });
  });
  it("shows backend errors distinctly from an empty list", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ detail: "Service unavailable" }, 503))
      .mockResolvedValueOnce(json([]));
    render(<App />);
    expect(
      await screen.findByText("We couldn’t load this data"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass("cs-alert");
  });
});
