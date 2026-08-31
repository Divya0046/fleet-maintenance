import { useState } from "react";
import type { FormEvent } from "react";
import { login as loginApi } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail] = useState("manager@fleetdemo.com");
  const [password, setPassword] = useState("FleetDemo123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const result = await loginApi(email, password);
      login(result.token, result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div>
        <h1>Fleet Maintenance</h1>
        <p>Sign in to manage maintenance operations.</p>

        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && <p>{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}