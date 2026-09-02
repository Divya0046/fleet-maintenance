const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export type Role = "FLEET_MANAGER" | "TECHNICIAN";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type LoginResponse = {
  token: string;
  user: User;
};

export type Vehicle = {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  currentOdometer: number;
  serviceIntervalDays: number;
  mileageIntervalKm: number;
  overdueGracePeriodDays: number;
  lastServiceAt: string;
  lastServiceOdometer: number;
  currentServiceCycle: number;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VehicleInput = {
  registrationNumber: string;
  make: string;
  model: string;
  currentOdometer: number;
  serviceIntervalDays: number;
  mileageIntervalKm: number;
  overdueGracePeriodDays: number;
};

export type ServiceRecord = {
  id: string;
  vehicleId: string;
  cycleNumber: number;
  status: "DUE" | "BOOKED" | "IN_SERVICE" | "COMPLETED";
  description: string;
  dueAt: string;
  scheduledDate: string | null;
  completedAt: string | null;
  completedOdometer: number | null;
  vehicle: Vehicle;
  technicians: Array<{
    technician: {
      id: string;
      name: string;
      email: string;
    };
  }>;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);

  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Request failed";

    throw new Error(message);
  }

  return data as T;
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getVehicles(token: string): Promise<Vehicle[]> {
  const data = await request<{ vehicles: Vehicle[] }>(
    "/api/vehicles",
    {},
    token,
  );

  return data.vehicles;
}

export async function createVehicle(
  token: string,
  input: VehicleInput,
): Promise<Vehicle> {
  const data = await request<{ vehicle: Vehicle }>(
    "/api/vehicles",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token,
  );

  return data.vehicle;
}

export async function updateVehicle(
  token: string,
  id: string,
  input: Partial<VehicleInput>,
): Promise<Vehicle> {
  const data = await request<{ vehicle: Vehicle }>(
    `/api/vehicles/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    token,
  );

  return data.vehicle;
}

export async function archiveVehicle(
  token: string,
  id: string,
): Promise<Vehicle> {
  const data = await request<{ vehicle: Vehicle }>(
    `/api/vehicles/${id}/archive`,
    {
      method: "POST",
    },
    token,
  );

  return data.vehicle;
}

export async function restoreVehicle(
  token: string,
  id: string,
): Promise<Vehicle> {
  const data = await request<{ vehicle: Vehicle }>(
    `/api/vehicles/${id}/restore`,
    {
      method: "POST",
    },
    token,
  );

  return data.vehicle;
}

export async function getServices(
  token: string,
  params = "",
): Promise<{
  records: ServiceRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}> {
  return request(
    `/api/services${params ? `?${params}` : ""}`,
    {},
    token,
  );
}

export async function createService(
  token: string,
  vehicleId: string,
  description: string,
): Promise<{ record: ServiceRecord }> {
  return request<{ record: ServiceRecord }>(
    "/api/services",
    {
      method: "POST",
      body: JSON.stringify({
        vehicleId,
        description,
      }),
    },
    token,
  );
}

export async function updateServiceDescription(
  token: string,
  id: string,
  description: string,
): Promise<{ record: ServiceRecord }> {
  return request<{ record: ServiceRecord }>(
    `/api/services/${id}/description`,
    {
      method: "PATCH",
      body: JSON.stringify({ description }),
    },
    token,
  );
}

export async function transitionService(
  token: string,
  id: string,
  body: {
    status: ServiceRecord["status"];
    scheduledDate?: string;
    technicianIds?: string[];
  },
): Promise<{ result: ServiceRecord }> {
  return request<{ result: ServiceRecord }>(
    `/api/services/${id}/transition`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    token,
  );
}

export async function assignTechnician(
  token: string,
  serviceId: string,
  technicianId: string,
) {
  return request(
    `/api/services/${serviceId}/assign`,
    {
      method: "POST",
      body: JSON.stringify({ technicianId }),
    },
    token,
  );
}

export async function unassignTechnician(
  token: string,
  serviceId: string,
  technicianId: string,
) {
  return request(
    `/api/services/${serviceId}/assign/${technicianId}`,
    {
      method: "DELETE",
    },
    token,
  );
}
export type Technician = {
  id: string;
  name: string;
  email: string;
};

export async function getTechnicians(
  token: string,
): Promise<Technician[]> {
  const data = await request<{ technicians: Technician[] }>(
    "/api/users/technicians",
    {},
    token,
  );

  return data.technicians;
}
export type DashboardData = {
  headlines: {
    vehiclesDue: number;
    vehiclesInService: number;
    servicesCompletedThisWeek: number;
    vehiclesOverdue: number;
  };
  byStatus: Array<{
    status: string;
    count: number;
  }>;
  byTechnician: Array<{
    technicianId: string;
    name: string;
    count: number;
  }>;
  completedByWeek: Array<{
    weekStart: string;
    completed: number;
  }>;
};

export async function getDashboard(
  token: string,
): Promise<DashboardData> {
  return request<DashboardData>(
    "/api/reports/dashboard",
    {},
    token,
  );
}
export type AuditEvent = {
  id: string;
  type:
    | "CREATED"
    | "STATUS_CHANGED"
    | "TECHNICIAN_ASSIGNED"
    | "TECHNICIAN_UNASSIGNED"
    | "NOTE_ADDED";
  oldStatus: ServiceRecord["status"] | null;
  newStatus: ServiceRecord["status"] | null;
  noteText: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
  };
  technician: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export async function getTimeline(
  token: string,
  serviceId: string,
): Promise<AuditEvent[]> {
  const data = await request<{ events: AuditEvent[] }>(
    `/api/history/services/${serviceId}/timeline`,
    {},
    token,
  );

  return data.events;
}

export async function addServiceNote(
  token: string,
  serviceId: string,
  noteText: string,
) {
  return request(
    `/api/history/services/${serviceId}/notes`,
    {
      method: "POST",
      body: JSON.stringify({ noteText }),
    },
    token,
  );
}
export type Alert = {
  id: string;
  vehicleId: string;
  serviceRecordId: string;
  dismissedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  vehicle: Vehicle;
  serviceRecord: ServiceRecord;
};

export async function getAlerts(token: string): Promise<Alert[]> {
  const data = await request<{ alerts: Alert[] }>(
    "/api/alerts",
    {},
    token,
  );

  return data.alerts;
}

export async function dismissAlert(
  token: string,
  id: string,
) {
  return request(
    `/api/alerts/${id}/dismiss`,
    {
      method: "POST",
    },
    token,
  );
}
export async function importOdometerCsv(
  token: string,
  csv: string,
) {
  return request<{
    total: number;
    succeeded: number;
    rejected: number;
    results: Array<{
      row: number;
      registrationNumber?: string;
      success: boolean;
      odometer?: number;
      reason?: string;
    }>;
  }>(
    "/api/reports/odometer-import",
    {
      method: "POST",
      body: JSON.stringify({ csv }),
    },
    token,
  );
}

export async function downloadServiceHistoryCsv(
  token: string,
): Promise<Blob> {
  const response = await fetch(
    `${API_URL}/api/reports/service-history.csv`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to export service history");
  }

  return response.blob();
}