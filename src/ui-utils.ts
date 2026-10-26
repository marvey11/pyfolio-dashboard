import type { SortOrder } from "./api";

export interface Sort {
  column: string;
  direction: SortOrder;
}

export interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

export const PAGE_SIZES = [10, 25, 50] as const;

export function validSort(
  value: unknown,
  allowed: string[],
  fallback: Sort,
): Sort {
  if (
    typeof value !== "object" ||
    value === null ||
    !("column" in value) ||
    !("direction" in value)
  ) {
    return fallback;
  }
  const { column, direction } = value;
  return typeof column === "string" &&
    allowed.includes(column) &&
    (direction === "asc" || direction === "desc")
    ? { column, direction }
    : fallback;
}

export function validPageSize(value: unknown, fallback = 25): number {
  return PAGE_SIZES.find((pageSize) => pageSize === value) ?? fallback;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const appHref = (path: string) => `${BASE}${path === "/" ? "/" : path}`;

export function navigate(path: string) {
  window.history.pushState({}, "", appHref(path));
  window.dispatchEvent(new PopStateEvent("popstate"));
}
