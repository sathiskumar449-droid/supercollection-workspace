"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Role } from "@/types/orderflow";
import { orderflowStore } from "./store";

export interface AuthUser {
  username: string;
  role: Role;
  name: string;
  courierPartnerId?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => { success: boolean; error?: string; role?: Role };
  logout: () => void;
}

const STORAGE_KEY_AUTH = "sc_auth_session_v1";

const VALID_ACCOUNTS: Record<string, { password: string; role: Role; name: string; courierPartnerId?: string }> = {
  admin: {
    password: "1234",
    role: "ADMIN",
    name: "Admin",
  },
  courier: {
    password: "1234",
    role: "COURIER",
    name: "Courier Portal",
  },
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => ({ success: false, error: "AuthContext not initialized" }),
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(STORAGE_KEY_AUTH);
        if (stored) {
          const parsed: AuthUser = JSON.parse(stored);
          const cleanUname = (parsed.username || "").trim().toLowerCase();
          if (cleanUname && VALID_ACCOUNTS[cleanUname]) {
            const acc = VALID_ACCOUNTS[cleanUname];
            const session: AuthUser = {
              username: cleanUname,
              role: acc.role,
              name: acc.name,
              courierPartnerId: acc.courierPartnerId,
            };
            setUser(session);
            setIsAuthenticated(true);
            orderflowStore.switchRole(session.role, session.courierPartnerId);
          } else {
            localStorage.removeItem(STORAGE_KEY_AUTH);
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      }
    } catch (err) {
      console.error("Error reading auth session:", err);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (usernameInput: string, passwordInput: string): { success: boolean; error?: string; role?: Role } => {
    const cleanUser = (usernameInput || "").trim().toLowerCase();
    const cleanPass = (passwordInput || "").trim();

    if (!cleanUser || !cleanPass) {
      return { success: false, error: "Please enter both username and password." };
    }

    const account = VALID_ACCOUNTS[cleanUser];
    if (!account || account.password !== cleanPass) {
      return {
        success: false,
        error: "Invalid username or password. Valid accounts: admin (1234) or courier (1234).",
      };
    }

    const session: AuthUser = {
      username: cleanUser,
      role: account.role,
      name: account.name,
      courierPartnerId: account.courierPartnerId,
    };

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(session));
      }
    } catch (e) {
      console.error("Error saving auth session:", e);
    }

    setUser(session);
    setIsAuthenticated(true);
    orderflowStore.switchRole(account.role, account.courierPartnerId);

    return { success: true, role: account.role };
  };

  const logout = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY_AUTH);
      }
    } catch (e) {
      console.error("Error clearing auth session:", e);
    }
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
