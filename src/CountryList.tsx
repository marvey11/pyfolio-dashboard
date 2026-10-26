import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@marvey11/codescape-ui";
import { useLocalStorage } from "@marvey11/codescape-react-utils";
import { api, type Country, type PaginationMetadata } from "./api";
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

export function CountryList({
  notify,
}: {
  notify: (type: Toast["type"], message: string) => void;
}) {
  const [stored, setStored] = useLocalStorage<unknown>(
    "pyfolio.countries.sort",
    { column: "code", direction: "asc" },
  );
  const sort = validSort(stored, ["code", "name"], {
    column: "code",
    direction: "asc",
  });
  const [storedPageSize, setStoredPageSize] = useLocalStorage<unknown>(
    "pyfolio.countries.page-size",
    25,
  );
  const pageSize = validPageSize(storedPageSize);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<Country[]>([]);
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
    api
      .countries({
        page,
        pageSize,
        sort_by: sort.column,
        sort_order: sort.direction,
      })
      .then((page) => {
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
  }, [page, pageSize, sort.column, sort.direction, refresh]);
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
  const remove = async (country: Country) => {
    if (
      !window.confirm(`Delete ${country.name}? This action cannot be undone.`)
    )
      return;
    try {
      await api.deleteCountry(country.code);
      notify("success", "Country deleted.");
      reload();
    } catch (cause) {
      notify(
        "error",
        cause instanceof Error
          ? cause.message
          : "The country could not be deleted.",
      );
    }
  };
  return (
    <main className="page">
      <PageTitle
        eyebrow="Your reference data"
        title="Countries"
        description="Manage the countries available when adding securities."
        action={
          <Link to="/countries/new" className="button-link primary-link">
            ＋ Add country
          </Link>
        }
      />
      <Card className="data-card">
        <CardContent>
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorBox message={error} retry={reload} />
          ) : rows.length === 0 ? (
            <Empty
              title={
                page > 1 ? "No countries on this page" : "No countries yet"
              }
              text={
                page > 1
                  ? "Go to the previous page to see countries."
                  : "Add a country to make it available on security forms."
              }
              action={
                page === 1 ? (
                  <Link
                    to="/countries/new"
                    className="button-link primary-link"
                  >
                    Add your first country
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
                          label="Country code"
                          column="code"
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
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.code}>
                        <td className="mono">{row.code}</td>
                        <td className="name-cell">{row.name}</td>
                        <td className="actions">
                          <Link
                            to={`/countries/${row.code}/edit`}
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
      <p className="table-note">Choose 10, 25 or 50 countries per page</p>
    </main>
  );
}
