import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  createService,
  getServices,
  getTechnicians,
  getVehicles,
  transitionService,
  updateServiceDescription,
  assignTechnician,
  unassignTechnician,
  type ServiceRecord,
  type Technician,
  type Vehicle,
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [sortBy, setSortBy] = useState<
  "scheduledDate" | "status" | "updatedAt"
>("updatedAt");

const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [timeline, setTimeline] = useState<AuditEvent[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );

  async function load() {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        sortBy: "updatedAt",
        sortOrder: "desc",
      });

     if (search) params.set("search", search);
if (status) params.set("status", status);
if (vehicleId) params.set("vehicleId", vehicleId);
if (technicianId) params.set("technicianId", technicianId);

params.set("sortBy", sortBy);
params.set("sortOrder", sortOrder);

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
  }, [
  token,
  search,
  status,
  vehicleId,
  technicianId,
  sortBy,
  sortOrder,
  page,
]);

  useEffect(() => {
  if (!token || user?.role !== "FLEET_MANAGER") return;

  void Promise.all([
    getTechnicians(token),
    getVehicles(token),
  ])
    .then(([loadedTechnicians, loadedVehicles]) => {
      setTechnicians(loadedTechnicians);
      setVehicles(loadedVehicles);
    })
    .catch(() => {
      setTechnicians([]);
      setVehicles([]);
    });
}, [token, user?.role]);

  function resetFilters() {
    setSearch("");
    setStatus("");
    setVehicleId("");
    setTechnicianId("");
    setPage(1);
  }

  async function createNewService() {
    if (!token || user?.role !== "FLEET_MANAGER") return;

    const selectedVehicle =
      vehicles.length > 0
        ? window.prompt(
            `Enter vehicle ID.\n\nAvailable vehicles:\n${vehicles
              .map((vehicle) => `${vehicle.id} - ${vehicle.registrationNumber}`)
              .join("\n")}`,
          )
        : window.prompt("Enter vehicle ID");

    const description = window.prompt("Service description");

    if (!selectedVehicle || !description) return;

    try {
      await createService(token, selectedVehicle, description);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create service",
      );
    }
  }

  async function book(record: ServiceRecord) {
    if (!token || user?.role !== "FLEET_MANAGER") return;

    const scheduledDate = window.prompt(
      "Scheduled date (YYYY-MM-DD)",
      new Date().toISOString().slice(0, 10),
    );

    if (!scheduledDate) return;

    if (technicians.length === 0) {
      setError("No technicians are available.");
      return;
    }

    const technicianList = technicians
      .map(
        (technician, index) =>
          `${index + 1}. ${technician.name} (${technician.email})`,
      )
      .join("\n");

    const selection = window.prompt(
      `Enter technician numbers separated by commas.\n\n${technicianList}`,
      "1",
    );

    if (!selection?.trim()) return;

    const selectedIndexes = selection
      .split(",")
      .map((value) => Number(value.trim()) - 1)
      .filter(
        (index) =>
          Number.isInteger(index) &&
          index >= 0 &&
          index < technicians.length,
      );

    const uniqueIndexes = [...new Set(selectedIndexes)];

    if (uniqueIndexes.length === 0) {
      setError("Please select at least one valid technician.");
      return;
    }

    const technicianIds = uniqueIndexes.map(
      (index) => technicians[index].id,
    );

    try {
      await transitionService(token, record.id, {
        status: "BOOKED",
        scheduledDate,
        technicianIds,
      });

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to book service",
      );
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

  async function addTechnicianToRecord(record: ServiceRecord) {
    if (!token || user?.role !== "FLEET_MANAGER") return;

    const existingIds = new Set(
      record.technicians.map((item) => item.technician.id),
    );

    const available = technicians.filter(
      (technician) => !existingIds.has(technician.id),
    );

    if (available.length === 0) {
      setError("All available technicians are already assigned.");
      return;
    }

    const technicianList = available
      .map(
        (technician, index) =>
          `${index + 1}. ${technician.name} (${technician.email})`,
      )
      .join("\n");

    const selection = window.prompt(
      `Select technician to add:\n\n${technicianList}`,
      "1",
    );

    if (!selection) return;

    const index = Number(selection.trim()) - 1;

    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= available.length
    ) {
      setError("Invalid technician selection.");
      return;
    }

    try {
      await assignTechnician(token, record.id, available[index].id);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to assign technician",
      );
    }
  }

  async function removeTechnicianFromRecord(
    record: ServiceRecord,
    technicianId: string,
  ) {
    if (!token || user?.role !== "FLEET_MANAGER") return;

    const confirmed = window.confirm(
      "Remove this technician from the service record?",
    );

    if (!confirmed) return;

    try {
      await unassignTechnician(token, record.id, technicianId);
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove technician",
      );
    }
  }

  async function openTimeline(id: string) {
    if (!token) return;

    setSelectedServiceId(id);
    setTimeline([]);
    setError("");

    try {
      const events = await getTimeline(token, id);
      setTimeline(events);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load timeline",
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
        err instanceof Error ? err.message : "Unable to add note",
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
              Server-side search, filtering, sorting and pagination.
            </p>
          </div>

          {user?.role === "FLEET_MANAGER" && (
            <button onClick={() => void createNewService()}>
              + Create service
            </button>
          )}
        </div>

        <div
          className="topbar-actions"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 16,
          }}
        >
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

          <select
            value={vehicleId}
            onChange={(e) => {
              setPage(1);
              setVehicleId(e.target.value);
            }}
          >
            <option value="">All vehicles</option>

            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registrationNumber}
              </option>
            ))}
          </select>

          <select
            value={technicianId}
            onChange={(e) => {
              setPage(1);
              setTechnicianId(e.target.value);
            }}
          >
            <option value="">All technicians</option>

            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.name}
              </option>
            ))}
          </select>

          {(search || status || vehicleId || technicianId) && (
            <button onClick={resetFilters}>Clear filters</button>
          )}
          <select
  value={vehicleId}
  onChange={(e) => {
    setPage(1);
    setVehicleId(e.target.value);
  }}
>
  <option value="">All vehicles</option>
  {vehicles.map((vehicle) => (
    <option key={vehicle.id} value={vehicle.id}>
      {vehicle.registrationNumber}
    </option>
  ))}
</select>

{user?.role === "FLEET_MANAGER" && (
  <select
    value={technicianId}
    onChange={(e) => {
      setPage(1);
      setTechnicianId(e.target.value);
    }}
  >
    <option value="">All technicians</option>
    {technicians.map((technician) => (
      <option key={technician.id} value={technician.id}>
        {technician.name}
      </option>
    ))}
  </select>
)}

<select
  value={sortBy}
  onChange={(e) => {
    setPage(1);
    setSortBy(
      e.target.value as
        | "scheduledDate"
        | "status"
        | "updatedAt",
    );
  }}
>
  <option value="updatedAt">Last update</option>
  <option value="scheduledDate">Scheduled date</option>
  <option value="status">Status</option>
</select>

<select
  value={sortOrder}
  onChange={(e) => {
    setPage(1);
    setSortOrder(e.target.value as "asc" | "desc");
  }}
>
  <option value="desc">Descending</option>
  <option value="asc">Ascending</option>
</select>

<button
  type="button"
  onClick={() => {
    setSearch("");
    setStatus("");
    setVehicleId("");
    setTechnicianId("");
    setSortBy("updatedAt");
    setSortOrder("desc");
    setPage(1);
  }}
>
  Clear filters
</button>
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
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        No service records found.
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => (
                      <tr key={record.id}>
                        <td>
                          {record.vehicle.registrationNumber}
                        </td>

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
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            {record.technicians.length === 0 ? (
                              <span>Unassigned</span>
                            ) : (
                              record.technicians.map((item) => (
                                <div
                                  key={item.technician.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <span>{item.technician.name}</span>

                                  {user?.role === "FLEET_MANAGER" && (
                                    <button
                                      onClick={() =>
                                        void removeTechnicianFromRecord(
                                          record,
                                          item.technician.id,
                                        )
                                      }
                                      style={{
                                        padding: "2px 6px",
                                      }}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              ))
                            )}
                          </div>

                          {user?.role === "FLEET_MANAGER" &&
                            record.status !== "COMPLETED" && (
                              <button
                                onClick={() =>
                                  void addTechnicianToRecord(record)
                                }
                                style={{
                                  marginTop: 8,
                                }}
                              >
                                + Add technician
                              </button>
                            )}
                        </td>

                        <td>
                          <div className="table-actions">
                            {record.status === "DUE" &&
                              user?.role === "FLEET_MANAGER" && (
                                <button
                                  onClick={() => void book(record)}
                                >
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
                              onClick={() =>
                                void openTimeline(record.id)
                              }
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
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div
              className="topbar-actions"
              style={{ marginTop: 16 }}
            >
              <button
                disabled={page <= 1}
                onClick={() =>
                  setPage((value) => value - 1)
                }
              >
                Previous
              </button>

              <span>
                Page {page} of {Math.max(totalPages, 1)}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((value) => value + 1)
                }
              >
                Next
              </button>
            </div>
          </>
        )}

        {selectedServiceId && (
          <section
            className="panel"
            style={{ marginTop: 24 }}
          >
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
                    {new Date(
                      event.createdAt,
                    ).toLocaleString()}
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