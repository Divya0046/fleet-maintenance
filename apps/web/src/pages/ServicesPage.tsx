import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  getServices,
  transitionService,
  updateServiceDescription,
  type ServiceRecord,
} from "../lib/api";

export default function ServicesPage() {
  const { token, user, logout } = useAuth();

  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!token) return;

    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
        sortBy: "updatedAt",
        sortOrder: "desc",
      });

      if (search) params.set("search", search);
      if (status) params.set("status", status);

      const data = await getServices(token, params.toString());
      setRecords(data.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token, search, status]);

  async function move(record: ServiceRecord) {
    if (!token) return;

    let next: ServiceRecord["status"] | null = null;

    if (record.status === "BOOKED") next = "IN_SERVICE";
    if (record.status === "IN_SERVICE") next = "COMPLETED";

    if (!next) return;

    try {
      await transitionService(token, record.id, {
        status: next,
      });

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update service");
    }
  }

  async function editDescription(record: ServiceRecord) {
    if (!token) return;

    const description = window.prompt(
      "Service description",
      record.description,
    );

    if (!description || description === record.description) return;

    try {
      await updateServiceDescription(token, record.id, description);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update description");
    }
  }

  return (
    <main className="fleet-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Fleet Maintenance</p>
          <h1>Service Records</h1>
        </div>

        <div className="topbar-actions">
          <span>
            {user?.name} · {user?.role}
          </span>
          <button onClick={logout}>Sign out</button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Service records</h2>
            <p>Search and filter records on the server.</p>
          </div>

          <div className="topbar-actions">
            <input
              placeholder="Search description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="DUE">Due</option>
              <option value="BOOKED">Booked</option>
              <option value="IN_SERVICE">In Service</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="vehicle-table-wrapper">
            <table className="vehicle-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Scheduled</th>
                  <th>Technicians</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.vehicle.registrationNumber}</td>
                    <td>{record.description}</td>
                    <td>{record.status}</td>
                    <td>
                      {record.scheduledDate
                        ? new Date(record.scheduledDate).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      {record.technicians
                        .map((x) => x.technician.name)
                        .join(", ") || "Unassigned"}
                    </td>
                    <td>
                      <div className="table-actions">
                        {(record.status === "BOOKED" ||
                          record.status === "IN_SERVICE") && (
                          <button onClick={() => void move(record)}>
                            {record.status === "BOOKED"
                              ? "Start"
                              : "Complete"}
                          </button>
                        )}

                        {(user?.role === "TECHNICIAN" ||
                          user?.role === "FLEET_MANAGER") && (
                          <button
                            onClick={() => void editDescription(record)}
                          >
                            Edit description
                          </button>
                        )}
                      </div>
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