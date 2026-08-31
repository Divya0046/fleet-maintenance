const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type LoginResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "FLEET_MANAGER" | "TECHNICIAN";
  };
};

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Login failed");
  }

  return data;
}