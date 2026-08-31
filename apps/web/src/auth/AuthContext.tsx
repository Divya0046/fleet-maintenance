import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Role = "FLEET_MANAGER" | "TECHNICIAN";

type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type AuthContextValue = {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "fleet_auth_token";
const USER_KEY = "fleet_auth_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );

  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(USER_KEY);

    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored) as User;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [user]);

  const value = useMemo(
    () => ({
      token,
      user,
      login(nextToken: string, nextUser: User) {
        setToken(nextToken);
        setUser(nextUser);
      },
      logout() {
        setToken(null);
        setUser(null);
      },
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}