import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  dismissAlert,
  getAlerts,
  type Alert,
} from "../lib/api";

export default function AlertsPage() {
  const { token, user, logout } = useAuth();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState("");

  async function loadAlerts() {
    if (!token) return;

    try {
      const data = await getAlerts(token);
      setAlerts(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load alerts",
      );
    }
  }

  useEffect(() => {
    void loadAlerts();
  }, [token]);

  async function handleDismiss(id: string) {
    if (!token) return;

    try {
      await dismissAlert(token, id);
      await loadAlerts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to dismiss alert",
      );
    }
  }

  return (
    <main className="fleet-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Fleet Maintenance</p>
          <h1>Overdue Alerts</h1>
        </div>

        <div className="topbar-actions">
          <span>{user?.name}</span>
          <button type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Active alerts</h2>
            <p>{alerts.length} overdue alert(s)</p>
          </div>
        </div>

        {alerts.length === 0 ? (
          <p>No active overdue alerts.</p>
        ) : (
          <div className="vehicle-table-wrapper">
            <table className="vehicle-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Service</th>
                  <th>Due</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>
                      <strong>
                        {alert.vehicle.registrationNumber}
                      </strong>
                      <br />
                      {alert.vehicle.make} {alert.vehicle.model}
                    </td>

                    <td>{alert.serviceRecord.description}</td>

                    <td>
                      {new Date(
                        alert.serviceRecord.dueAt,
                      ).toLocaleDateString()}
                    </td>

                    <td>
                      {user?.role === "FLEET_MANAGER" && (
                        <button
                          type="button"
                          onClick={() => void handleDismiss(alert.id)}
                        >
                          Dismiss
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}