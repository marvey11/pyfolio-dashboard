import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
  localStorage.clear();
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const country = { code: "DE", name: "Germany" };
const security = {
  id: 3,
  isin: "US0378331005",
  wkn: "865985",
  name: "Apple",
  instrument_type: "stock",
  country_code: "DE",
};

describe("Pyfolio screens", () => {
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
  it("keeps Previous available when a full page leads to an empty next page", async () => {
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
        if (url.includes("/securities?") && url.includes("offset=25"))
          return Promise.resolve(json([]));
        return Promise.resolve(json(securities));
      });
    render(<App />);

    expect(await screen.findByText("Security 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      await screen.findByText("No securities on this page"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Security 1")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining("offset=0&limit=25"),
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
  });
  it("creates a country and navigates to its overview after confirmation", async () => {
    let countryOverviewRequests = 0;
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        const method = init?.method ?? "";
        if (url.includes("/countries?") && method === "POST") {
          return Promise.resolve(json(country, 201));
        }
        if (
          url.includes("/countries?") &&
          method === "" &&
          url.includes("limit=500")
        ) {
          return Promise.resolve(json([]));
        }
        if (url.includes("/countries?") && method === "") {
          countryOverviewRequests += 1;
          return Promise.resolve(
            json(countryOverviewRequests > 1 ? [country] : []),
          );
        }
        if (method === "POST") return Promise.resolve(json(country, 201));
        return Promise.resolve(json([]));
      });
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: /Countries/ }));
    await screen.findByText("No countries yet");
    fireEvent.click(screen.getByRole("link", { name: /Add country/ }));
    fireEvent.change(screen.getByLabelText("Country code"), {
      target: { value: "GB" },
    });
    fireEvent.change(screen.getByLabelText("Country name"), {
      target: { value: "United Kingdom" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create country" }));
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        "/api/v1/pyfolio/countries",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Country created.",
    );
  });
});

describe("resource forms and destructive actions", () => {
  it("creates a security with the selected country", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.includes("/countries?") && url.includes("limit=500"))
          return Promise.resolve(json([country]));
        if (url.includes("/securities?") && init?.method === undefined)
          return Promise.resolve(json([]));
        if (url.endsWith("/securities") && init?.method === "POST")
          return Promise.resolve(json(security, 201));
        if (url.includes("/countries?"))
          return Promise.resolve(json([country]));
        return Promise.resolve(json([]));
      });
    render(<App />);
    await screen.findByText("No securities yet");
    fireEvent.click(screen.getByRole("link", { name: /Add security/ }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create security" }),
      ).toBeEnabled(),
    );
    fireEvent.change(screen.getByLabelText("ISIN"), {
      target: { value: security.isin },
    });
    fireEvent.change(screen.getByLabelText("WKN"), {
      target: { value: security.wkn },
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: security.name },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create security" }));
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        "/api/v1/pyfolio/securities",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Security created.",
    );
  });

  it("prefills a country edit form and submits a patch", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.includes("/countries/DE") && init?.method === "PATCH")
          return Promise.resolve(json({ code: "DE", name: "Deutschland" }));
        if (url.endsWith("/countries/DE"))
          return Promise.resolve(json(country));
        if (url.includes("/countries?"))
          return Promise.resolve(json([country]));
        if (url.includes("/securities?")) return Promise.resolve(json([]));
        return Promise.resolve(json([]));
      });
    render(<App />);
    await screen.findByText("No securities yet");
    fireEvent.click(screen.getByRole("link", { name: /Countries/ }));
    await screen.findByText("Germany");
    fireEvent.click(screen.getByRole("link", { name: "Edit Germany" }));
    expect(await screen.findByLabelText("Country name")).toHaveValue("Germany");
    fireEvent.change(screen.getByLabelText("Country name"), {
      target: { value: "Deutschland" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        "/api/v1/pyfolio/countries/DE",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Country updated.",
    );
  });

  it("keeps a referenced country when the backend rejects deletion", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes("/countries/DE") && init?.method === "DELETE")
        return Promise.resolve(
          json({ detail: "Country is referenced by a security" }, 409),
        );
      if (url.includes("/countries?")) return Promise.resolve(json([country]));
      if (url.includes("/securities?")) return Promise.resolve(json([]));
      return Promise.resolve(json([]));
    });
    render(<App />);
    await screen.findByText("No securities yet");
    fireEvent.click(screen.getByRole("link", { name: /Countries/ }));
    await screen.findByText("Germany");
    fireEvent.click(screen.getByRole("button", { name: "Delete Germany" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Country is referenced by a security",
    );
    expect(screen.getByText("Germany")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss notification" }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("routing", () => {
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
