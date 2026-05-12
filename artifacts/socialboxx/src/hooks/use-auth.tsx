import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetMe, useLogin, useLogout, setAuthTokenGetter } from "@workspace/api-client-react";
import type { UserProfile, LoginInput } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: UserProfile | null | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  token: string | null;
  setToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem("sb_token"));
  const [, setLocation] = useLocation();

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem("sb_token", newToken);
    } else {
      localStorage.removeItem("sb_token");
    }
    setTokenState(newToken);
  };

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("sb_token"));
  }, []);

  const { data: user, isLoading: isUserLoading, refetch } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    }
  });

  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  const login = async (credentials: LoginInput) => {
    const res = await loginMutation.mutateAsync({ data: credentials });
    setToken(res.token);
    await refetch();
  };

  const logout = async () => {
    try {
      if (token) {
        await logoutMutation.mutateAsync();
      }
    } catch (e) {
      // Ignore errors on logout
    } finally {
      setToken(null);
      setLocation("/auth");
    }
  };

  const isLoading = isUserLoading && !!token;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        token,
        setToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
