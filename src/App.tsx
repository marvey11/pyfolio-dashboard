import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@marvey11/codescape-ui";
import "@marvey11/codescape-ui/style.css";
import { CountryForm, SecurityForm } from "./Forms";
import { CountryList } from "./CountryList";
import { SecurityList } from "./SecurityList";
import { Link } from "./shared";
import type { Toast } from "./ui-utils";
import "./App.css";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const routePath = () => {
  const pathname = window.location.pathname;
  return BASE && pathname.startsWith(BASE)
    ? pathname.slice(BASE.length) || "/"
    : pathname;
};

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
          <Alert
            className={`toast ${toast.type}`}
            variant={toast.type === "error" ? "destructive" : "success"}
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
          </Alert>
        ))}
      </div>
    </div>
  );
}

export default App;
