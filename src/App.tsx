import {
  useCallback,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type SubmitEvent,
  type ReactNode,
} from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@marvey11/codescape-ui";
import "@marvey11/codescape-ui/style.css";
import { useLocalStorage } from "@marvey11/codescape-react-utils";
import {
  api,
  ApiError,
  INSTRUMENT_TYPES,
  type Country,
  type PaginationMetadata,
  type Security,
  type SecurityInput,
  type SortOrder,
} from "./api";
import "./App.css";

interface Sort {
  column: string;
  direction: SortOrder;
}
interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const routePath = () => {
  const pathname = window.location.pathname;
  return BASE && pathname.startsWith(BASE)
    ? pathname.slice(BASE.length) || "/"
    : pathname;
};
const href = (path: string) => `${BASE}${path === "/" ? "/" : path}`;
function validSort(value: unknown, allowed: string[], fallback: Sort): Sort {
  if (
    typeof value !== "object" ||
    value === null ||
    !("column" in value) ||
    !("direction" in value)
  )
    return fallback;
  const { column, direction } = value;
  return typeof column === "string" &&
    allowed.includes(column) &&
    (direction === "asc" || direction === "desc")
    ? { column, direction }
    : fallback;
}
const PAGE_SIZES = [10, 25, 50] as const;
function validPageSize(value: unknown, fallback = 25): number {
  return PAGE_SIZES.find((pageSize) => pageSize === value) ?? fallback;
}

function Link({
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
      href={href(to)}
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
          window.history.pushState({}, "", href(to));
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      }}
    >
      {children}
    </a>
  );
}

function App() {
  const [path, setPath] = useState(routePath);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, type, message }]);
    if (type === "success")
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 4500);
  }, []);
  useEffect(() => {
    const update = () => {
      setPath(routePath());
    };
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("popstate", update);
    };
  }, []);
  let page: ReactNode;
  if (path === "/" || path === "/securities")
    page = <SecurityList notify={notify} />;
  else if (path === "/countries") page = <CountryList notify={notify} />;
  else if (/^\/securities\/new$/.test(path))
    page = <SecurityForm notify={notify} />;
  else if (/^\/securities\/\d+\/edit$/.test(path))
    page = <SecurityForm id={Number(path.split("/")[2])} notify={notify} />;
  else if (path === "/countries/new") page = <CountryForm notify={notify} />;
  else if (/^\/countries\/[^/]+\/edit$/.test(path))
    page = (
      <CountryForm
        code={decodeURIComponent(path.split("/")[2] ?? "")}
        notify={notify}
      />
    );
  else
    page = (
      <main className="page">
        <Card>
          <CardHeader>
            <CardTitle>Page not found</CardTitle>
            <CardDescription>This page does not exist.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/securities">Return to securities</Link>
          </CardContent>
        </Card>
      </main>
    );
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/securities" className="brand">
          Pyfolio<span className="brand-mark">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link
            to="/securities"
            className={
              path.startsWith("/securities") || path === "/"
                ? "nav-link active"
                : "nav-link"
            }
          >
            Securities
          </Link>
          <Link
            to="/countries"
            className={
              path.startsWith("/countries") ? "nav-link active" : "nav-link"
            }
          >
            Countries
          </Link>
        </nav>
      </header>
      {page}
      <div
        className="toast-region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            className={`toast ${toast.type}`}
            role={toast.type === "error" ? "alert" : "status"}
            key={toast.id}
          >
            <span>{toast.message}</span>
            {toast.type === "error" && (
              <button
                aria-label="Dismiss notification"
                onClick={() => {
                  setToasts((all) =>
                    all.filter((item) => item.id !== toast.id),
                  );
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PageTitle({
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
function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      Loading…
    </div>
  );
}
function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">—</span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
function ErrorBox({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="error-box" role="alert">
      <strong>We couldn’t load this data</strong>
      <p>{message}</p>
      <Button variant="outline" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
function Pagination({
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
function SortButton({
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

function SecurityList({
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

function CountryList({
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

function fieldMessage(error: unknown, field: string) {
  return error instanceof ApiError ? error.fields[field] : undefined;
}
function SecurityForm({
  id,
  notify,
}: {
  id?: number;
  notify: (type: Toast["type"], message: string) => void;
}) {
  const edit = id !== undefined;
  const [countries, setCountries] = useState<Country[]>([]);
  const [form, setForm] = useState<SecurityInput>({
    isin: "",
    wkn: "",
    name: "",
    instrument_type: "stock",
    country_code: "",
  });
  const [loading, setLoading] = useState(edit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let active = true;
    api
      .countries({ page: 1, pageSize: 500, sort_by: "name", sort_order: "asc" })
      .then((page) => {
        if (active) {
          setCountries(page.items);
          setForm((current) => ({
            ...current,
            country_code:
              current.country_code.length > 0
                ? current.country_code
                : (page.items.at(0)?.code ?? ""),
          }));
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    if (edit)
      api
        .security(id)
        .then((item) => {
          if (active)
            setForm({
              isin: item.isin,
              wkn: item.wkn,
              name: item.name,
              instrument_type: item.instrument_type,
              country_code: item.country_code,
            });
        })
        .catch((cause: unknown) => {
          if (active) setError(cause);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    return () => {
      active = false;
    };
  }, [edit, id]);
  const change = (key: keyof SecurityInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const normalised: SecurityInput = {
        ...form,
        isin: form.isin.trim().toUpperCase(),
        wkn: form.wkn.trim().toUpperCase(),
        name: form.name.trim(),
        country_code: form.country_code.toUpperCase(),
      };
      if (edit) await api.updateSecurity(id, normalised);
      else await api.createSecurity(normalised);
      notify("success", edit ? "Security updated." : "Security created.");
      navigate("/securities");
    } catch (cause) {
      setError(cause);
    } finally {
      setSaving(false);
    }
  };
  if (loading)
    return (
      <main className="page">
        <Loading />
      </main>
    );
  return (
    <main className="page form-page">
      <PageTitle
        eyebrow="Securities"
        title={edit ? "Edit security" : "Add security"}
        description={
          edit
            ? "Update the details for this instrument."
            : "Add an instrument to your reference list."
        }
      />
      <Card>
        <CardContent>
          <form
            className="entity-form"
            onSubmit={(event) => void submit(event)}
          >
            {error instanceof ApiError &&
              Object.keys(error.fields).length === 0 && (
                <div className="form-error" role="alert">
                  {error.message}
                </div>
              )}
            {error instanceof Error && !(error instanceof ApiError) && (
              <div className="form-error" role="alert">
                {error.message}
              </div>
            )}
            <div className="form-grid">
              <Field
                label="ISIN"
                id="isin"
                value={form.isin}
                onChange={(value) => {
                  change("isin", value);
                }}
                error={fieldMessage(error, "isin")}
                required
                maxLength={12}
                pattern="[A-Za-z]{2}[A-Za-z0-9]{9}[0-9]"
              />
              <Field
                label="WKN"
                id="wkn"
                value={form.wkn}
                onChange={(value) => {
                  change("wkn", value);
                }}
                error={fieldMessage(error, "wkn")}
                required
                maxLength={6}
                pattern="[A-Za-z0-9]{6}"
              />
              <Field
                label="Name"
                id="security-name"
                value={form.name}
                onChange={(value) => {
                  change("name", value);
                }}
                error={fieldMessage(error, "name")}
                required
                maxLength={255}
              />
              <div className="filter-control">
                <Label htmlFor="instrument-type">Instrument type</Label>
                <select
                  id="instrument-type"
                  value={form.instrument_type}
                  onChange={(event) => {
                    change("instrument_type", event.target.value);
                  }}
                  aria-invalid={
                    fieldMessage(error, "instrument_type") !== undefined
                  }
                  aria-describedby={
                    fieldMessage(error, "instrument_type") !== undefined
                      ? "instrument-type-error"
                      : undefined
                  }
                >
                  {INSTRUMENT_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value[0]?.toUpperCase()}
                      {value.slice(1)}
                    </option>
                  ))}
                </select>
                {fieldMessage(error, "instrument_type") !== undefined && (
                  <span className="field-error" id="instrument-type-error">
                    {fieldMessage(error, "instrument_type")}
                  </span>
                )}
              </div>
              <div className="filter-control">
                <Label htmlFor="country-code">Country</Label>
                <select
                  id="country-code"
                  value={form.country_code}
                  onChange={(event) => {
                    change("country_code", event.target.value);
                  }}
                  required
                  aria-invalid={
                    fieldMessage(error, "country_code") !== undefined
                  }
                  aria-describedby={
                    fieldMessage(error, "country_code") !== undefined
                      ? "country-code-error"
                      : undefined
                  }
                >
                  <option value="" disabled>
                    Select a country
                  </option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name} ({country.code})
                    </option>
                  ))}
                </select>
                {fieldMessage(error, "country_code") !== undefined && (
                  <span className="field-error" id="country-code-error">
                    {fieldMessage(error, "country_code")}
                  </span>
                )}
              </div>
            </div>
            <div className="form-actions">
              <Link to="/securities" className="button-link outline-link">
                Cancel
              </Link>
              <Button type="submit" disabled={saving || countries.length === 0}>
                {saving ? "Saving…" : edit ? "Save changes" : "Create security"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
function Field({
  label,
  id,
  value,
  onChange,
  error,
  required,
  maxLength,
  pattern,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  required?: boolean;
  maxLength?: number;
  pattern?: string;
}) {
  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        required={required}
        maxLength={maxLength}
        pattern={pattern}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? `${id}-error` : undefined}
      />
      {error !== undefined && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

function CountryForm({
  code,
  notify,
}: {
  code?: string;
  notify: (type: Toast["type"], message: string) => void;
}) {
  const edit = code !== undefined;
  const [form, setForm] = useState<Country>({ code: "", name: "" });
  const [loading, setLoading] = useState(edit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (!edit) return;
    let active = true;
    api
      .country(code)
      .then((country) => {
        if (active) setForm(country);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code, edit]);
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const data = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
    };
    try {
      if (edit) await api.updateCountry(code, data);
      else await api.createCountry(data);
      notify("success", edit ? "Country updated." : "Country created.");
      navigate("/countries");
    } catch (cause) {
      setError(cause);
    } finally {
      setSaving(false);
    }
  };
  if (loading)
    return (
      <main className="page">
        <Loading />
      </main>
    );
  return (
    <main className="page form-page">
      <PageTitle
        eyebrow="Countries"
        title={edit ? "Edit country" : "Add country"}
        description={
          edit
            ? "Update the country reference details."
            : "Add a country to use when recording securities."
        }
      />
      <Card>
        <CardContent>
          <form
            className="entity-form narrow-form"
            onSubmit={(event) => void submit(event)}
          >
            {error instanceof ApiError &&
              Object.keys(error.fields).length === 0 && (
                <div className="form-error" role="alert">
                  {error.message}
                </div>
              )}
            {error instanceof Error && !(error instanceof ApiError) && (
              <div className="form-error" role="alert">
                {error.message}
              </div>
            )}
            <Field
              label="Country code"
              id="country-code"
              value={form.code}
              onChange={(value) => {
                setForm((current) => ({ ...current, code: value }));
              }}
              error={fieldMessage(error, "code")}
              required
              maxLength={2}
              pattern="[A-Za-z]{2}"
            />
            <p className="hint">
              Two-letter ISO 3166-1 alpha-2 code, for example GB or DE.
            </p>
            <Field
              label="Country name"
              id="country-name"
              value={form.name}
              onChange={(value) => {
                setForm((current) => ({ ...current, name: value }));
              }}
              error={fieldMessage(error, "name")}
              required
              maxLength={120}
            />
            <div className="form-actions">
              <Link to="/countries" className="button-link outline-link">
                Cancel
              </Link>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : edit ? "Save changes" : "Create country"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
function navigate(path: string) {
  window.history.pushState({}, "", href(path));
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default App;
