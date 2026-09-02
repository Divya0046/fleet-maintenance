import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  archiveVehicle,
  createVehicle,
  getVehicles,
  restoreVehicle,
  updateVehicle,
  type Vehicle,
  type VehicleInput,
} from "../lib/api";

import {
  importOdometerCsv,
  downloadServiceHistoryCsv,
} from "../lib/api";

const emptyForm: VehicleInput = {
  registrationNumber: "",
  make: "",
  model: "",
  currentOdometer: 0,
  serviceIntervalDays: 180,
  mileageIntervalKm: 10000,
  overdueGracePeriodDays: 7,
};

export default function VehiclesPage() {
  const { token, user, logout } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState<VehicleInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
const [csvResult, setCsvResult] = useState<{
  succeeded: number;
  rejected: number;
} | null>(null);

  async function loadVehicles() {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const data = await getVehicles(token);
      setVehicles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadVehicles();
  }, [token]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function editVehicle(vehicle: Vehicle) {
    setEditingId(vehicle.id);
    setForm({
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      currentOdometer: vehicle.currentOdometer,
      serviceIntervalDays: vehicle.serviceIntervalDays,
      mileageIntervalKm: vehicle.mileageIntervalKm,
      overdueGracePeriodDays: vehicle.overdueGracePeriodDays,
    });
  }

  function updateField<K extends keyof VehicleInput>(
    field: K,
    value: VehicleInput[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!token) return;

    setSaving(true);
    setError("");

    try {
      if (editingId) {
        await updateVehicle(token, editingId, form);
      } else {
        await createVehicle(token, form);
      }

      resetForm();
      await loadVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save vehicle");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(vehicle: Vehicle) {
    if (!token) return;

    try {
      await archiveVehicle(token, vehicle.id);
      await loadVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to archive vehicle");
    }
  }

  async function handleRestore(vehicle: Vehicle) {
    if (!token) return;

    try {
      await restoreVehicle(token, vehicle.id);
      await loadVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to restore vehicle");
    }
  }

  async function handleCsvImport(
  event: React.ChangeEvent<HTMLInputElement>,
) {
  if (!token) return;

  const file = event.target.files?.[0];

  if (!file) return;

  try {
    const csv = await file.text();
    const result = await importOdometerCsv(token, csv);

    setCsvResult({
      succeeded: result.succeeded,
      rejected: result.rejected,
    });

    await loadVehicles();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "CSV import failed",
    );
  }

  event.target.value = "";
}

async function handleExport() {
  if (!token) return;

  try {
    const blob = await downloadServiceHistoryCsv(token);
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "service-history.csv";
    link.click();

    URL.revokeObjectURL(url);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "CSV export failed",
    );
  }
}

  const visibleVehicles = showArchived
    ? vehicles
    : vehicles.filter((vehicle) => !vehicle.isArchived);

  return (
    <main className="fleet-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Fleet Maintenance</p>
          <h1>Vehicles</h1>
        </div>

        <div className="topbar-actions">
          <span>
            {user?.name} ·{" "}
            {user?.role === "FLEET_MANAGER" ? "Fleet Manager" : "Technician"}
          </span>

          <button type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="vehicle-layout">
        {user?.role === "FLEET_MANAGER" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>{editingId ? "Edit vehicle" : "Add vehicle"}</h2>
                <p>Set vehicle details and service intervals.</p>
              </div>

              {editingId && (
                <button type="button" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>

            <form className="vehicle-form" onSubmit={handleSubmit}>
              <label>
                Registration
                <input
                  value={form.registrationNumber}
                  onChange={(e) =>
                    updateField("registrationNumber", e.target.value)
                  }
                  required
                />
              </label>

              <label>
                Make
                <input
                  value={form.make}
                  onChange={(e) => updateField("make", e.target.value)}
                  required
                />
              </label>

              <label>
                Model
                <input
                  value={form.model}
                  onChange={(e) => updateField("model", e.target.value)}
                  required
                />
              </label>

              <label>
                Current odometer
                <input
                  type="number"
                  min="0"
                  value={form.currentOdometer}
                  onChange={(e) =>
                    updateField("currentOdometer", Number(e.target.value))
                  }
                  required
                />
              </label>

              <label>
                Service interval (days)
                <input
                  type="number"
                  min="1"
                  value={form.serviceIntervalDays}
                  onChange={(e) =>
                    updateField("serviceIntervalDays", Number(e.target.value))
                  }
                  required
                />
              </label>

              <label>
                Service interval (km)
                <input
                  type="number"
                  min="1"
                  value={form.mileageIntervalKm}
                  onChange={(e) =>
                    updateField("mileageIntervalKm", Number(e.target.value))
                  }
                  required
                />
              </label>

              <label>
                Overdue grace (days)
                <input
                  type="number"
                  min="1"
                  value={form.overdueGracePeriodDays}
                  onChange={(e) =>
                    updateField(
                      "overdueGracePeriodDays",
                      Number(e.target.value),
                    )
                  }
                  required
                />
              </label>

              <button type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Create vehicle"}
              </button>
            </form>
          </section>
        )}

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Fleet</h2>
              <p>{visibleVehicles.length} vehicles shown</p>
            </div>

            {user?.role === "FLEET_MANAGER" && (
              <button
                type="button"
                onClick={() => setShowArchived((current) => !current)}
              >
                {showArchived ? "Active only" : "Show archived"}
              </button>
            )}
          </div>

          {loading ? (
            <p>Loading vehicles...</p>
          ) : visibleVehicles.length === 0 ? (
            <p>No vehicles found.</p>
          ) : (
            <div className="vehicle-table-wrapper">
              <table className="vehicle-table">
                <thead>
                  <tr>
                    <th>Registration</th>
                    <th>Make / Model</th>
                    <th>Odometer</th>
                    <th>Intervals</th>
                    <th>Status</th>
                    {user?.role === "FLEET_MANAGER" && <th>Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {visibleVehicles.map((vehicle) => (
                    <tr key={vehicle.id}>
                      <td>
                        <strong>{vehicle.registrationNumber}</strong>
                      </td>

                      <td>
                        {vehicle.make} {vehicle.model}
                      </td>

                      <td>{vehicle.currentOdometer.toLocaleString()} km</td>

                      <td>
                        {vehicle.serviceIntervalDays} days /{" "}
                        {vehicle.mileageIntervalKm.toLocaleString()} km
                      </td>

                      <td>
                        <span
                          className={
                            vehicle.isArchived
                              ? "status status-archived"
                              : "status status-active"
                          }
                        >
                          {vehicle.isArchived ? "Archived" : "Active"}
                        </span>
                      </td>

                      {user?.role === "FLEET_MANAGER" && (
                        <td>
                          <div className="table-actions">
                            {!vehicle.isArchived && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => editVehicle(vehicle)}
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleArchive(vehicle)}
                                >
                                  Archive
                                </button>
                              </>
                            )}
                            <div
  className="topbar-actions"
  style={{ marginTop: 16 }}
>
  <label>
    Import odometers CSV
    <input
      type="file"
      accept=".csv,text/csv"
      onChange={handleCsvImport}
    />
  </label>

  <button onClick={() => void handleExport()}>
    Export service history
  </button>

  {csvResult && (
    <span>
      Imported: {csvResult.succeeded} · Rejected:{" "}
      {csvResult.rejected}
    </span>
  )}
</div>

                            {vehicle.isArchived && (
                              <button
                                type="button"
                                onClick={() => handleRestore(vehicle)}
                              >
                                Restore
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}