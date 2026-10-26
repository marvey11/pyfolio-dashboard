import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Button, EmptyState, Alert, Skeleton } from "@marvey11/codescape-ui";
import { appHref, navigate, PAGE_SIZES, type Sort } from "./ui-utils";

export function Link({
  to,
  children,
  className,
  ...props
}: { to: string; children: ReactNode } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick"
>) {
  return (
    <a
      href={appHref(to)}
      className={className}
      {...props}
      onClick={(event) => {
        if (
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          navigate(to);
        }
      }}
    >
      {children}
    </a>
  );
}

export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtitle">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status" aria-label="Loading">
      <Skeleton className="loading-skeleton" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <EmptyState className="empty-state" title={title} description={text}>
      {action}
    </EmptyState>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <Alert className="error-box" variant="destructive">
      <strong>We couldn’t load this data</strong>
      <p>{message}</p>
      <Button variant="outline" onClick={retry}>
        Try again
      </Button>
    </Alert>
  );
}
export function Pagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const firstItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);
  return (
    <div className="pagination">
      <span>
        {totalItems === 0
          ? "No results"
          : `Page ${String(page)} of ${String(totalPages)} · ${String(firstItem)}–${String(lastItem)} of ${String(totalItems)}`}
      </span>
      <div>
        <label className="pagination-size">
          Rows per page
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value));
            }}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPreviousPage}
          onClick={() => {
            onPageChange(page - 1);
          }}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNextPage}
          onClick={() => {
            onPageChange(page + 1);
          }}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
export function SortButton({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: string;
  sort: Sort;
  onSort: (column: string) => void;
}) {
  return (
    <button
      className="sort-button"
      onClick={() => {
        onSort(column);
      }}
    >
      {label}
      <span aria-hidden="true">
        {sort.column === column
          ? sort.direction === "asc"
            ? " ↑"
            : " ↓"
          : " ↕"}
      </span>
    </button>
  );
}
