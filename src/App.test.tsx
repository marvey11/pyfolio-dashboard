import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
  localStorage.clear();
});
const json = (body: unknown, status = 200) =>
  new Response(
    JSON.stringify(
      Array.isArray(body)
        ? {
            items: body,
            pagination: {
              page: 1,
              pageSize: 25,
              totalItems: body.length,
              totalPages: body.length === 0 ? 0 : 1,
              hasPreviousPage: false,
              hasNextPage: false,
            },
          }
        : body,
    ),
    { status, headers: { "Content-Type": "application/json" } },
  );
const pageJson = (
  items: unknown[],
  page: number,
  pageSize: number,
  totalItems: number,
) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  return json({
    items,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: page > 1 && page <= totalPages,
      hasNextPage: page < totalPages,
    },
  });
};
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
          url.includes("pageSize=500")
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
        if (url.includes("/countries?") && url.includes("pageSize=500"))
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
