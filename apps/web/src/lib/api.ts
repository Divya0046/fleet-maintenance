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