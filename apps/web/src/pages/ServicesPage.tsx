import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  createService,
  getServices,
  getTechnicians,
  transitionService,
  updateServiceDescription,
  type ServiceRecord,
  type Technician,
} from "../lib/api";
import {
  addServiceNote,
  getTimeline,
  type AuditEvent,
} from "../lib/api";

export default function ServicesPage() {
  const { token, user, logout } = useAuth();

  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [timeline, setTimeline] = useState<AuditEvent[]>([]);
const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  async function load() {
    if (!token) return;

    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        sortBy: "updatedAt",
        sortOrder: "desc",
      });

      if (search) params.set("search", search);
      if (status) params.set("status", status);

      const data = await getServices(token, params.toString());

      setRecords(data.records);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load services",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token, search, status, page]);

  useEffect(() => {
    if (!token || user?.role !== "FLEET_MANAGER") return;

    void getTechnicians(token)
      .then(setTechnicians)
      .catch(() => setTechnicians([]));
  }, [token, user?.role]);

  async function createNewService() {
    if (!token || user?.role !== "FLEET_MANAGER") return;

    const vehicleId = window.prompt("Enter vehicle ID");
    const description = window.prompt("Service description");

    if (!vehicleId || !description) return;

    try {
      await createService(token, vehicleId, description);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create service");
    }
  }

  async function book(record: ServiceRecord) {
    if (!token || user?.role !== "FLEET_MANAGER") return;

    const scheduledDate = window.prompt(
      "Scheduled date (YYYY-MM-DD)",
      new Date().toISOString().slice(0, 10),
    );

    if (!scheduledDate || technicians.length === 0) return;

    const technicianIds = technicians
      .slice(0, 1)
      .map((technician) => technician.id);

    try {
      await transitionService(token, record.id, {
        status: "BOOKED",
        scheduledDate,
        technicianIds,
      });

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to book service");
    }
  }

  async function advance(record: ServiceRecord) {
    if (!token) return;

    const next =
      record.status === "BOOKED"
        ? "IN_SERVICE"
        : record.status === "IN_SERVICE"
          ? "COMPLETED"
          : null;

    if (!next) return;

    try {
      await transitionService(token, record.id, {
        status: next,
      });

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update service",
      );
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
      setError(
        err instanceof Error ? err.message : "Unable to update description",
      );
    }
  }
  async function openTimeline(id: string) {
  if (!token) return;

  try {
    const events = await getTimeline(token, id);
    setTimeline(events);
    setSelectedServiceId(id);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to load timeline",
    );
  }
}

async function addNote(id: string) {
  if (!token) return;

  const note = window.prompt("Add service note");

  if (!note?.trim()) return;

  try {
    await addServiceNote(token, id, note.trim());
    await openTimeline(id);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to add note",
    );
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
            <p>
              Server-side search, filtering and pagination.
            </p>
          </div>

          {user?.role === "FLEET_MANAGER" && (
            <button onClick={() => void createNewService()}>
              + Create service
            </button>
            
          )}
        </div>

        <div className="topbar-actions">
          <input
            placeholder="Search description"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />

          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All statuses</option>
            <option value="DUE">Due</option>
            <option value="BOOKED">Booked</option>
            <option value="IN_SERVICE">In Service</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
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
                          ? new Date(
                              record.scheduledDate,
                            ).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        {record.technicians
                          .map((x) => x.technician.name)
                          .join(", ") || "Unassigned"}
                      </td>
                      <td>
                        <div className="table-actions">
                          {record.status === "DUE" &&
                            user?.role === "FLEET_MANAGER" && (
                              <button onClick={() => void book(record)}>
                                Book
                              </button>
                            )}

                          {(record.status === "BOOKED" ||
                            record.status === "IN_SERVICE") && (
                            <button
                              onClick={() => void advance(record)}
                            >
                              {record.status === "BOOKED"
                                ? "Start"
                                : "Complete"}
                            </button>
                          )}

                          {user && (
                            <button
                              onClick={() =>
                                void editDescription(record)
                              }
                            >
                              Edit description
                            </button>
                            
                          )}
                          <button
  onClick={() => void openTimeline(record.id)}
>
  Timeline
</button>

<button
  onClick={() => void addNote(record.id)}
>
  Add note
</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="topbar-actions" style={{ marginTop: 16 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>

              <span>
                Page {page} of {Math.max(totalPages, 1)}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
        {selectedServiceId && (
  <section className="panel" style={{ marginTop: 24 }}>
    <div className="panel-heading">
      <div>
        <h2>Service timeline</h2>
        <p>Append-only history</p>
      </div>

      <button
        onClick={() => {
          setSelectedServiceId(null);
          setTimeline([]);
        }}
      >
        Close
      </button>
    </div>

    {timeline.length === 0 ? (
      <p>No timeline events.</p>
    ) : (
      timeline.map((event) => (
        <div
          key={event.id}
          style={{
            padding: "12px 0",
            borderBottom: "1px solid #edf0f3",
          }}
        >
          <strong>{event.type}</strong>

          <div>
            {event.actor.name} ·{" "}
            {new Date(event.createdAt).toLocaleString()}
          </div>

          {event.oldStatus && event.newStatus && (
            <div>
              {event.oldStatus} → {event.newStatus}
            </div>
          )}

          {event.technician && (
            <div>
              Technician: {event.technician.name}
            </div>
          )}

          {event.noteText && (
            <div>
              Note: {event.noteText}
            </div>
          )}
        </div>
      ))
    )}
  </section>
)}
      </section>
    </main>
  );
}