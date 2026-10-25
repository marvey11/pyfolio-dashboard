const apiBaseUrl: unknown = import.meta.env.VITE_API_BASE_URL;
const configuredApiBase =
  typeof apiBaseUrl === "string" ? apiBaseUrl.trim().replace(/\/+$/, "") : "";
const API_BASE_URL = configuredApiBase || "/api/v1/pyfolio";

export const INSTRUMENT_TYPES = [
  "stock",
  "etf",
  "bond",
  "certificate",
  "fund",
] as const;
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];
export interface Country {
  code: string;
  name: string;
}
export interface Security {
  id: number;
  isin: string;
  wkn: string;
  name: string;
  instrument_type: InstrumentType;
  country_code: string;
}
export type SortOrder = "asc" | "desc";
export interface Page<T> {
  items: T[];
  hasNext: boolean;
}
export type SecurityInput = Omit<Security, "id">;

export class ApiError extends Error {
  readonly status: number;
  readonly fields: Record<string, string>;

  constructor(
    message: string,
    status: number,
    fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    if (init?.body !== undefined)
      headers.set("Content-Type", "application/json");
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      "Could not reach the Pyfolio API. Check your connection and try again.",
      0,
    );
  }
  if (!response.ok) {
    let message = `The request failed (${String(response.status)}). Please try again.`;
    const fields: Record<string, string> = {};
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "detail" in body) {
        const detail = (body as { detail?: unknown }).detail;
        if (typeof detail === "string") message = detail;
        else if (Array.isArray(detail)) {
          for (const rawItem of detail as unknown[]) {
            if (typeof rawItem !== "object" || rawItem === null) continue;
            const item: { loc?: unknown; msg?: unknown } = rawItem;
            if (!Array.isArray(item.loc)) continue;
            const locations: unknown[] = item.loc as unknown[];
            const key = locations.at(-1);
            if (typeof key === "string" && typeof item.msg === "string")
              fields[key] = item.msg;
          }
          if (Object.keys(fields).length)
            message = "Please correct the highlighted fields.";
        }
      }
    } catch {
      /* use the safe status message */
    }
    throw new ApiError(message, response.status, fields);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function query(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
}

export const api = {
  securities: async (options: {
    offset: number;
    limit: number;
    sort_by: string;
    sort_order: SortOrder;
    instrument_type?: string;
    country_code?: string;
  }): Promise<Page<Security>> => {
    const rows = await request<Security[]>(`/securities?${query(options)}`);
    return { items: rows, hasNext: rows.length === options.limit };
  },
  security: (id: number) => request<Security>(`/securities/${String(id)}`),
  createSecurity: (data: SecurityInput) =>
    request<Security>("/securities", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSecurity: (id: number, data: SecurityInput) =>
    request<Security>(`/securities/${String(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteSecurity: (id: number) =>
    request<undefined>(`/securities/${String(id)}`, { method: "DELETE" }),
  countries: async (options: {
    offset: number;
    limit: number;
    sort_by: string;
    sort_order: SortOrder;
  }): Promise<Page<Country>> => {
    const rows = await request<Country[]>(`/countries?${query(options)}`);
    return { items: rows, hasNext: rows.length === options.limit };
  },
  country: (code: string) =>
    request<Country>(`/countries/${encodeURIComponent(code)}`),
  createCountry: (data: Country) =>
    request<Country>("/countries", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCountry: (code: string, data: Country) =>
    request<Country>(`/countries/${encodeURIComponent(code)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCountry: (code: string) =>
    request<undefined>(`/countries/${encodeURIComponent(code)}`, {
      method: "DELETE",
    }),
};
