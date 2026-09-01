import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { getDashboard, type DashboardData } from "../lib/api";

export default function DashboardPage() {
  const { token, logout, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    void getDashboard(token)
      .then(setData)
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load dashboard",
        );
      });
  }, [token]);

  if (!data) {
    return (
      <main className="fleet-page">
        {error ? <div className="error-banner">{error}</div> : "Loading..."}
      </main>
    );
  }

  return (
    <main className="fleet-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Fleet Maintenance</p>
          <h1>Dashboard</h1>
        </div>

        <div className="topbar-actions">
          <span>{user?.name}</span>
          <button onClick={logout}>Sign out</button>
        </div>
      </header>

      <section className="vehicle-layout">
        <div className="panel">
          <div className="vehicle-form">
            <div>
              <strong>Vehicles Due</strong>
              <h2>{data.headlines.vehiclesDue}</h2>
            </div>

            <div>
              <strong>In Service</strong>
              <h2>{data.headlines.vehiclesInService}</h2>
            </div>

            <div>
              <strong>Completed This Week</strong>
              <h2>{data.headlines.servicesCompletedThisWeek}</h2>
            </div>

            <div>
              <strong>Overdue</strong>
              <h2>{data.headlines.vehiclesOverdue}</h2>
            </div>
          </div>
        </div>

        <section className="panel">
          <h2>Services by status</h2>

          {data.byStatus.map((item) => (
            <p key={item.status}>
              <strong>{item.status}</strong>: {item.count}
            </p>
          ))}
        </section>

        <section className="panel">
          <h2>Services by technician</h2>

          {data.byTechnician.map((item) => (
            <p key={item.technicianId}>
              <strong>{item.name}</strong>: {item.count}
            </p>
          ))}
        </section>

        <section className="panel">
          <h2>Completed — last 8 weeks</h2>

          {data.completedByWeek.map((week) => (
            <p key={week.weekStart}>
              {new Date(week.weekStart).toLocaleDateString()}:
              {" "}
              {week.completed}
            </p>
          ))}
        </section>
      </section>
    </main>
  );
}