import "./App.css";
import LoginPage from "./pages/LoginPage";
import { useAuth } from "./auth/AuthContext";

function AuthenticatedApp() {
  const { user, logout } = useAuth();

  return (
    <main className="app-shell">
      <section className="app-card">
        <div>
          <p className="eyebrow">Fleet Maintenance</p>

          <h1>Welcome, {user?.name}</h1>

          <p className="subtitle">
            You are signed in as{" "}
            <strong>{user?.role === "FLEET_MANAGER" ? "Fleet Manager" : "Technician"}</strong>.
          </p>
        </div>

        <button type="button" onClick={logout}>
          Sign out
        </button>
      </section>
    </main>
  );
}

export default function App() {
  const { user } = useAuth();

  if (!user) {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
}