import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

afterEach(() => vi.restoreAllMocks());
const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("API client", () => {
  it("constructs filtered, sorted, paginated security requests and infers next pages", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      ok(
        Array.from({ length: 2 }, (_, id) => ({
          id,
          isin: "US0378331005",
          wkn: "865985",
          name: "Apple",
          instrument_type: "stock",
          country_code: "DE",
        })),
      ),
    );
    const page = await api.securities({
      offset: 25,
      limit: 2,
      sort_by: "country",
      sort_order: "desc",
      instrument_type: "stock",
      country_code: "DE",
    });
    const firstUrl = fetcher.mock.calls.at(0)?.at(0);
    expect(firstUrl).toBe(
      "/securities?offset=25&limit=2&sort_by=country&sort_order=desc&instrument_type=stock&country_code=DE",
    );
    expect(page.items).toHaveLength(2);
    expect(page.hasNext).toBe(true);
  });
  it("creates, updates and deletes resources using backend methods", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(ok({ code: "DE", name: "Germany" }, 201))
      .mockResolvedValueOnce(ok({ code: "DE", name: "Deutschland" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await api.createCountry({ code: "DE", name: "Germany" });
    await api.updateCountry("DE", { code: "DE", name: "Deutschland" });
    await api.deleteCountry("DE");
    expect(fetcher.mock.calls.map((call) => call[1]?.method ?? "GET")).toEqual([
      "POST",
      "PATCH",
      "DELETE",
    ]);
    const secondUrl = fetcher.mock.calls.at(1)?.at(0);
    expect(secondUrl).toBe("/countries/DE");
  });
  it("maps backend field validation into field errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      ok(
        { detail: [{ loc: ["body", "isin"], msg: "must be a valid ISIN" }] },
        422,
      ),
    );
    await expect(
      api.createSecurity({
        isin: "bad",
        wkn: "123456",
        name: "A",
        instrument_type: "stock",
        country_code: "DE",
      }),
    ).rejects.toMatchObject({
      status: 422,
      fields: { isin: "must be a valid ISIN" },
      message: "Please correct the highlighted fields.",
    });
  });
  it("uses safe status messages and translates network failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      ok({ detail: "Country is referenced by a security" }, 409),
    );
    await expect(api.deleteCountry("DE")).rejects.toMatchObject({
      message: "Country is referenced by a security",
      status: 409,
    });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("sensitive transport internals"),
    );
    await expect(
      api.countries({
        offset: 0,
        limit: 5,
        sort_by: "code",
        sort_order: "asc",
      }),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      api.countries({
        offset: 0,
        limit: 5,
        sort_by: "code",
        sort_order: "asc",
      }),
    ).rejects.toMatchObject({
      message:
        "Could not reach the Pyfolio API. Check your connection and try again.",
    });
  });
});
