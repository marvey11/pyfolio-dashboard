import { useCallback, useEffect, useState } from "react";
import { Badge, Card, CardContent, Label } from "@marvey11/codescape-ui";
import { useLocalStorage } from "@marvey11/codescape-react-utils";
import {
  api,
  INSTRUMENT_TYPES,
  type Country,
  type PaginationMetadata,
  type Security,
} from "./api";
import {
  Empty,
  ErrorBox,
  Link,
  Loading,
  PageTitle,
  Pagination,
  SortButton,
} from "./shared";
import { validPageSize, validSort, type Toast } from "./ui-utils";

export function SecurityList({
  notify,
}: {
  notify: (type: Toast["type"], message: string) => void;
}) {
  const [stored, setStored] = useLocalStorage<unknown>(
    "pyfolio.securities.sort",
    { column: "isin", direction: "asc" },
  );
  const sort = validSort(
    stored,
    ["isin", "wkn", "name", "instrument_type", "country"],
    { column: "isin", direction: "asc" },
  );
  const [storedPageSize, setStoredPageSize] = useLocalStorage<unknown>(
    "pyfolio.securities.page-size",
    25,
  );
  const pageSize = validPageSize(storedPageSize);
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<Security[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState<PaginationMetadata>({
    page: 1,
    pageSize,
    totalItems: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    setRefresh((value) => value + 1);
  }, []);
  useEffect(() => {
    let active = true;
    let redirecting = false;
    Promise.all([
      api.securities({
        page,
        pageSize,
        sort_by: sort.column,
        sort_order: sort.direction,
        ...(type ? { instrument_type: type } : {}),
        ...(countryCode ? { country_code: countryCode } : {}),
      }),
      api.countries({
        page: 1,
        pageSize: 500,
        sort_by: "name",
        sort_order: "asc",
      }),
    ])
      .then(([page, countryPage]) => {
        if (active) {
          if (page.pagination.page > Math.max(page.pagination.totalPages, 1)) {
            redirecting = true;
            setLoading(true);
            setRows([]);
            setPage(Math.max(page.pagination.totalPages, 1));
            return;
          }
          setRows(page.items);
          setPagination(page.pagination);
          setCountries(countryPage.items);
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Please try again.",
          );
      })
      .finally(() => {
        if (active && !redirecting) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, pageSize, sort.column, sort.direction, type, countryCode, refresh]);
  const updateSort = (column: string) => {
    setLoading(true);
    setError("");
    setStored({
      column,
      direction:
        sort.column === column && sort.direction === "asc" ? "desc" : "asc",
    });
    setPage(1);
  };
  const remove = async (item: Security) => {
    if (!window.confirm(`Delete ${item.name}? This action cannot be undone.`))
      return;
    try {
      await api.deleteSecurity(item.id);
      notify("success", "Security deleted.");
      reload();
    } catch (cause) {
      notify(
        "error",
        cause instanceof Error
          ? cause.message
          : "The security could not be deleted.",
      );
    }
  };
  return (
    <main className="page">
      <PageTitle
        eyebrow="Your reference data"
        title="Securities"
        description="Manage the instruments in your portfolio universe."
        action={
          <Link to="/securities/new" className="button-link primary-link">
            ＋ Add security
          </Link>
        }
      />
      <section className="filter-bar" aria-label="Filter securities">
        <div className="filter-control">
          <Label htmlFor="filter-type">Instrument type</Label>
          <select
            id="filter-type"
            value={type}
            onChange={(event) => {
              setLoading(true);
              setError("");
              setType(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
            {INSTRUMENT_TYPES.map((item) => (
              <option key={item} value={item}>
                {item[0]?.toUpperCase()}
                {item.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-control">
          <Label htmlFor="filter-country">Country</Label>
          <select
            id="filter-country"
            value={countryCode}
            onChange={(event) => {
              setLoading(true);
              setError("");
              setCountryCode(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All countries</option>
            {countries.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </section>
      <Card className="data-card">
        <CardContent>
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorBox message={error} retry={reload} />
          ) : rows.length === 0 ? (
            <Empty
              title={
                page > 1
                  ? "No securities on this page"
                  : type || countryCode
                    ? "No matching securities"
                    : "No securities yet"
              }
              text={
                page > 1
                  ? "Go to the previous page to see securities."
                  : type || countryCode
                    ? "Try changing or clearing your filters."
                    : "Add a security to start building your reference list."
              }
              action={
                !type && !countryCode && page === 1 ? (
                  <Link
                    to="/securities/new"
                    className="button-link primary-link"
                  >
                    Add your first security
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <SortButton
                          label="ISIN"
                          column="isin"
                          sort={sort}
                          onSort={updateSort}
                        />
                      </th>
                      <th>
                        <SortButton
                          label="WKN"
                          column="wkn"
                          sort={sort}
                          onSort={updateSort}
                        />
                      </th>
                      <th>
                        <SortButton
                          label="Name"
                          column="name"
                          sort={sort}
                          onSort={updateSort}
                        />
                      </th>
                      <th>
                        <SortButton
                          label="Instrument type"
                          column="instrument_type"
                          sort={sort}
                          onSort={updateSort}
                        />
                      </th>
                      <th>
                        <SortButton
                          label="Country"
                          column="country"
                          sort={sort}
                          onSort={updateSort}
                        />
                      </th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="mono">{row.isin}</td>
                        <td className="mono">{row.wkn}</td>
                        <td className="name-cell">{row.name}</td>
                        <td>
                          <Badge variant="secondary">
                            {row.instrument_type}
                          </Badge>
                        </td>
                        <td>
                          {countries.find(
                            (country) => country.code === row.country_code,
                          )?.name ?? row.country_code}
                        </td>
                        <td className="actions">
                          <Link
                            to={`/securities/${String(row.id)}/edit`}
                            aria-label={`Edit ${row.name}`}
                          >
                            Edit
                          </Link>
                          <button
                            className="text-danger"
                            onClick={() => void remove(row)}
                            aria-label={`Delete ${row.name}`}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!loading && !error && (
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={pagination.totalItems}
              totalPages={pagination.totalPages}
              hasPreviousPage={pagination.hasPreviousPage}
              hasNextPage={pagination.hasNextPage}
              onPageChange={(value) => {
                setLoading(true);
                setError("");
                setPage(value);
              }}
              onPageSizeChange={(value) => {
                setStoredPageSize(value);
                setLoading(true);
                setError("");
                setPage(1);
              }}
            />
          )}
        </CardContent>
      </Card>
      <p className="table-note">Choose 10, 25 or 50 securities per page</p>
    </main>
  );
}
