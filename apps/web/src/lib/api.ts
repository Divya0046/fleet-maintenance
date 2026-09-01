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

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
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

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }

  return data as T;
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
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