import { useEffect, useMemo, useState } from "react";
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

  const maxCompleted = useMemo(() => {
    if (!data?.completedByWeek.length) return 1;

    return Math.max(
      1,
      ...data.completedByWeek.map((week) => week.completed),
    );
  }, [data]);

  if (!data) {
    return (
      <main className="fleet-page">
        {error ? (
          <div className="error-banner">{error}</div>
        ) : (
          "Loading..."
        )}
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
          <span>
            {user?.name} · {user?.role}
          </span>
          <button onClick={logout}>Sign out</button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

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

          {data.byTechnician.length === 0 && (
            <p>No technician assignments yet.</p>
          )}
        </section>

        <section className="panel">
          <h2>Completed — last 8 weeks</h2>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              minHeight: 220,
              padding: "24px 8px 8px",
              borderBottom: "1px solid #dfe4e8",
            }}
          >
            {data.completedByWeek.map((week) => {
              const height =
                week.completed === 0
                  ? 4
                  : Math.max(
                      12,
                      (week.completed / maxCompleted) * 170,
                    );

              return (
                <div
                  key={week.weekStart}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  <strong>{week.completed}</strong>

                  <div
                    title={`${week.completed} completed`}
                    style={{
                      width: "100%",
                      maxWidth: 48,
                      height,
                      background: "#2563eb",
                      borderRadius: "6px 6px 0 0",
                    }}
                  />

                  <span
                    style={{
                      fontSize: 12,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      transform: "rotate(-35deg)",
                      transformOrigin: "top center",
                      marginTop: 8,
                    }}
                  >
                    {new Date(
                      week.weekStart,
                    ).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}