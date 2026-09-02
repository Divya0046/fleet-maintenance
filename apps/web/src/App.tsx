import { useEffect, useState } from "react";
import "./App.css";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import VehiclesPage from "./pages/VehiclesPage";
import ServicesPage from "./pages/ServicesPage";
import AlertsPage from "./pages/AlertsPage";

import { useAuth } from "./auth/AuthContext";
import { getAlerts } from "./lib/api";

type Page =
  | "dashboard"
  | "vehicles"
  | "services"
  | "alerts";

export default function App() {
  const { user, token, logout } = useAuth();
  const [page, setPage] = useState<Page>("dashboard");
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (!user || !token) {
      setAlertCount(0);
      return;
    }

    void getAlerts(token)
      .then((alerts) => {
        setAlertCount(alerts.length);
      })
      .catch(() => {
        setAlertCount(0);
      });
  }, [user, token, page]);

  if (!user) {
    return <LoginPage />;
  }

  return (
    <>
      <nav
        style={{
          padding: 16,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button onClick={() => setPage("dashboard")}>
          Dashboard
        </button>

        <button onClick={() => setPage("vehicles")}>
          Vehicles
        </button>

        <button onClick={() => setPage("services")}>
          Service Records
        </button>

        <button onClick={() => setPage("alerts")}>
          Alerts
          {alertCount > 0 ? ` (${alertCount})` : ""}
        </button>

        <button onClick={logout}>
          Sign out
        </button>
      </nav>

      {page === "dashboard" && <DashboardPage />}
      {page === "vehicles" && <VehiclesPage />}
      {page === "services" && <ServicesPage />}
      {page === "alerts" && <AlertsPage />}
    </>
  );
}