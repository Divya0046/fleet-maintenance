import { useState } from "react";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import ServicesPage from "./pages/ServicesPage";
import VehiclesPage from "./pages/VehiclesPage";
import { useAuth } from "./auth/AuthContext";
import "./App.css";

export default function App() {
  const { user } = useAuth();
  const [page, setPage] = useState<
    "dashboard" | "vehicles" | "services"
  >("dashboard");

  if (!user) {
    return <LoginPage />;
  }

  return (
    <>
      <nav style={{ padding: 16, display: "flex", gap: 8 }}>
        <button onClick={() => setPage("dashboard")}>
          Dashboard
        </button>

        <button onClick={() => setPage("vehicles")}>
          Vehicles
        </button>

        <button onClick={() => setPage("services")}>
          Service Records
        </button>
      </nav>

      {page === "dashboard" && <DashboardPage />}
      {page === "vehicles" && <VehiclesPage />}
      {page === "services" && <ServicesPage />}
    </>
  );
}