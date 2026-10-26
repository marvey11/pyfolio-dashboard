import { useEffect, useState, type SubmitEvent } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Input,
  Label,
} from "@marvey11/codescape-ui";
import {
  api,
  ApiError,
  INSTRUMENT_TYPES,
  type Country,
  type SecurityInput,
} from "./api";
import { Link, Loading, PageTitle } from "./shared";
import { navigate, type Toast } from "./ui-utils";

function fieldMessage(error: unknown, field: string) {
  return error instanceof ApiError ? error.fields[field] : undefined;
}
export function SecurityForm({
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
                <Alert className="form-error" variant="destructive">
                  {error.message}
                </Alert>
              )}
            {error instanceof Error && !(error instanceof ApiError) && (
              <Alert className="form-error" variant="destructive">
                {error.message}
              </Alert>
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

export function CountryForm({
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
                <Alert className="form-error" variant="destructive">
                  {error.message}
                </Alert>
              )}
            {error instanceof Error && !(error instanceof ApiError) && (
              <Alert className="form-error" variant="destructive">
                {error.message}
              </Alert>
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
