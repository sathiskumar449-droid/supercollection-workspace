"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Role } from "@/types/orderflow";
import { orderflowStore } from "./store";

export interface AuthUser {
  username: string;
  role: Role;
  name: string;
  courierPartnerId?: string;
  avatarUrl?: string;
}

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  name: string;
  role: Role;
  courierPartnerId?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accounts: UserAccount[];
  login: (username: string, password: string) => { success: boolean; error?: string; role?: Role; courierPartnerId?: string };
  logout: () => void;
  addUser: (accountData: { username: string; password: string; name: string; role: Role; courierPartnerId?: string }) => { success: boolean; error?: string };
  updateUser: (id: string, updates: Partial<Pick<UserAccount, "username" | "name" | "role" | "courierPartnerId" | "isActive">>) => { success: boolean; error?: string };
  changePassword: (id: string, newPassword: string) => { success: boolean; error?: string };
  toggleUserStatus: (id: string) => { success: boolean; error?: string };
  deleteUser: (id: string) => { success: boolean; error?: string };
  resetToDefaults: () => void;
}

const STORAGE_KEY_AUTH = "sc_auth_session_v1";
const STORAGE_KEY_ACCOUNTS = "sc_user_accounts_v2";
const STORAGE_KEY_DELETED_USERS = "sc_deleted_usernames_v2";

export const DEFAULT_ACCOUNTS: UserAccount[] = [
  {
    id: "usr-admin-default",
    username: "admin",
    password: "1234",
    name: "Super Admin",
    role: "ADMIN",
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "usr-st-default",
    username: "stcourier",
    password: "1234",
    name: "ST Courier Team",
    role: "COURIER",
    courierPartnerId: "ST_COURIER",
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "usr-dtdc-default",
    username: "dtdc",
    password: "1234",
    name: "DTDC Courier Team",
    role: "COURIER",
    courierPartnerId: "DTDC",
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "usr-post-default",
    username: "indiapost",
    password: "1234",
    name: "India Post Team",
    role: "COURIER",
    courierPartnerId: "INDIA_POST",
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
  },
];

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  accounts: DEFAULT_ACCOUNTS,
  login: () => ({ success: false, error: "AuthContext not initialized" }),
  logout: () => {},
  addUser: () => ({ success: false, error: "AuthContext not initialized" }),
  updateUser: () => ({ success: false, error: "AuthContext not initialized" }),
  changePassword: () => ({ success: false, error: "AuthContext not initialized" }),
  toggleUserStatus: () => ({ success: false, error: "AuthContext not initialized" }),
  deleteUser: () => ({ success: false, error: "AuthContext not initialized" }),
  resetToDefaults: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [accounts, setAccounts] = useState<UserAccount[]>(DEFAULT_ACCOUNTS);

  // Helper to persist accounts
  const persistAccounts = useCallback((newAccounts: UserAccount[]) => {
    setAccounts(newAccounts);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(newAccounts));
      }
    } catch (e) {
      console.error("Error saving user accounts:", e);
    }
  }, []);

  // Initialize accounts and session from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        // Read deleted usernames blacklist
        let deletedUsernames: string[] = ["siva", "staff"];
        try {
          const storedDeleted = localStorage.getItem(STORAGE_KEY_DELETED_USERS);
          if (storedDeleted) {
            const parsedDeleted = JSON.parse(storedDeleted);
            if (Array.isArray(parsedDeleted)) {
              deletedUsernames = Array.from(new Set([...deletedUsernames, ...parsedDeleted]));
            }
          }
        } catch (e) {}

        const deletedSet = new Set(deletedUsernames.map((u) => u.toLowerCase()));

        // 1. Load accounts from storage
        let loadedAccounts: UserAccount[] = [];
        const storedAccounts = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
        if (storedAccounts) {
          try {
            const parsed: UserAccount[] = JSON.parse(storedAccounts);
            if (Array.isArray(parsed) && parsed.length > 0) {
              loadedAccounts = parsed;
            }
          } catch (e) {
            console.warn("Failed to parse stored accounts, using defaults", e);
          }
        }

        // If no stored accounts exist at all (first-ever fresh browser visit), use defaults
        if (loadedAccounts.length === 0) {
          loadedAccounts = DEFAULT_ACCOUNTS;
        }

        // Strictly filter out any accounts that were deleted by admin (or legacy demo accounts siva/staff)
        loadedAccounts = loadedAccounts.filter(
          (a) => !deletedSet.has((a.username || "").toLowerCase())
        );

        // Ensure primary admin account ALWAYS exists so owner can never be locked out
        const hasAdmin = loadedAccounts.some(
          (a) => (a.username || "").toLowerCase() === "admin"
        );
        if (!hasAdmin) {
          const defaultAdmin = DEFAULT_ACCOUNTS.find((d) => d.username === "admin");
          if (defaultAdmin) {
            loadedAccounts.unshift(defaultAdmin);
          }
        }

        setAccounts(loadedAccounts);
        localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(loadedAccounts));
        localStorage.setItem(STORAGE_KEY_DELETED_USERS, JSON.stringify(Array.from(deletedSet)));

        // 2. Load auth session
        const storedSession = localStorage.getItem(STORAGE_KEY_AUTH);
        if (storedSession) {
          const parsedSession: AuthUser = JSON.parse(storedSession);
          const cleanUname = (parsedSession.username || "").trim().toLowerCase();
          const matchedAcc = loadedAccounts.find(
            (a) => a.username.toLowerCase() === cleanUname && a.isActive
          );

          if (matchedAcc) {
            const session: AuthUser = {
              username: matchedAcc.username,
              role: matchedAcc.role,
              name: matchedAcc.name,
              courierPartnerId: matchedAcc.courierPartnerId,
            };
            setUser(session);
            setIsAuthenticated(true);
            orderflowStore.setUserSession({
              name: session.name,
              username: session.username,
              role: session.role,
              courierPartnerId: session.courierPartnerId,
            });
            orderflowStore.switchRole(session.role, session.courierPartnerId, session.name);
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

  // Login handler
  const login = (
    usernameInput: string,
    passwordInput: string
  ): { success: boolean; error?: string; role?: Role; courierPartnerId?: string } => {
    const cleanUser = (usernameInput || "").trim().toLowerCase();
    const cleanPass = (passwordInput || "").trim();

    if (!cleanUser || !cleanPass) {
      return { success: false, error: "Please enter both username and password." };
    }

    const account = accounts.find((a) => a.username.toLowerCase() === cleanUser);
    if (!account) {
      return {
        success: false,
        error: "Account not found. Please verify your username.",
      };
    }

    if (account.password !== cleanPass) {
      return {
        success: false,
        error: "Incorrect password. Please try again or contact Admin.",
      };
    }

    if (!account.isActive) {
      return {
        success: false,
        error: "This account is currently deactivated. Please contact an administrator.",
      };
    }

    const session: AuthUser = {
      username: account.username,
      role: account.role,
      name: account.name,
      courierPartnerId: account.courierPartnerId,
    };

    // Update lastLoginAt
    const updated = accounts.map((a) =>
      a.id === account.id ? { ...a, lastLoginAt: new Date().toISOString() } : a
    );
    persistAccounts(updated);

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(session));
      }
    } catch (e) {
      console.error("Error saving auth session:", e);
    }

    setUser(session);
    setIsAuthenticated(true);
    orderflowStore.setUserSession({
      name: session.name,
      username: session.username,
      role: session.role,
      courierPartnerId: session.courierPartnerId,
    });
    orderflowStore.switchRole(account.role, account.courierPartnerId, session.name);

    return { success: true, role: account.role, courierPartnerId: account.courierPartnerId };
  };

  // Logout handler
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

  // Add new user (Admin only)
  const addUser = (accountData: {
    username: string;
    password: string;
    name: string;
    role: Role;
    courierPartnerId?: string;
  }): { success: boolean; error?: string } => {
    const cleanUser = (accountData.username || "").trim().toLowerCase();
    const cleanPass = (accountData.password || "").trim();
    const cleanName = (accountData.name || "").trim();

    if (!cleanUser) return { success: false, error: "Username is required." };
    if (!cleanPass) return { success: false, error: "Password is required." };
    if (!cleanName) return { success: false, error: "Full Name is required." };

    if (accounts.some((a) => a.username.toLowerCase() === cleanUser)) {
      return { success: false, error: `Username "${cleanUser}" is already taken.` };
    }

    if (accountData.role === "COURIER" && !accountData.courierPartnerId) {
      return { success: false, error: "Please select a courier partner for this courier account." };
    }

    const newAcc: UserAccount = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      username: cleanUser,
      password: cleanPass,
      name: cleanName,
      role: accountData.role,
      courierPartnerId: accountData.role === "COURIER" ? accountData.courierPartnerId : undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    // If username was previously in deleted blacklist, remove it
    try {
      if (typeof window !== "undefined") {
        const storedDeleted = localStorage.getItem(STORAGE_KEY_DELETED_USERS);
        if (storedDeleted) {
          const list: string[] = JSON.parse(storedDeleted);
          const updated = list.filter((u) => u.toLowerCase() !== cleanUser);
          localStorage.setItem(STORAGE_KEY_DELETED_USERS, JSON.stringify(updated));
        }
      }
    } catch (e) {}

    persistAccounts([...accounts, newAcc]);
    return { success: true };
  };

  // Update existing user (Admin only)
  const updateUser = (
    id: string,
    updates: Partial<Pick<UserAccount, "username" | "name" | "role" | "courierPartnerId" | "isActive">>
  ): { success: boolean; error?: string } => {
    const existing = accounts.find((a) => a.id === id);
    if (!existing) return { success: false, error: "User account not found." };

    if (updates.username) {
      const cleanUser = updates.username.trim().toLowerCase();
      const conflict = accounts.find((a) => a.id !== id && a.username.toLowerCase() === cleanUser);
      if (conflict) {
        return { success: false, error: `Username "${cleanUser}" is already taken by another user.` };
      }
      updates.username = cleanUser;
    }

    const updatedList = accounts.map((a) => {
      if (a.id !== id) return a;
      return {
        ...a,
        ...updates,
        courierPartnerId: (updates.role || a.role) === "COURIER" 
          ? (updates.courierPartnerId !== undefined ? updates.courierPartnerId : a.courierPartnerId)
          : undefined,
      };
    });

    persistAccounts(updatedList);

    // If updating current active user, update current session
    if (user && user.username.toLowerCase() === existing.username.toLowerCase()) {
      const updatedAcc = updatedList.find((a) => a.id === id);
      if (updatedAcc) {
        const newSession: AuthUser = {
          username: updatedAcc.username,
          role: updatedAcc.role,
          name: updatedAcc.name,
          courierPartnerId: updatedAcc.courierPartnerId,
        };
        setUser(newSession);
        orderflowStore.setUserSession({
          name: newSession.name,
          username: newSession.username,
          role: newSession.role,
          courierPartnerId: newSession.courierPartnerId,
        });
        try {
          localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(newSession));
        } catch {}
      }
    }

    return { success: true };
  };

  // Change password for any user (Admin only)
  const changePassword = (id: string, newPassword: string): { success: boolean; error?: string } => {
    const cleanPass = (newPassword || "").trim();
    if (!cleanPass) return { success: false, error: "New password cannot be empty." };
    if (cleanPass.length < 3) return { success: false, error: "Password must be at least 3 characters." };

    const existing = accounts.find((a) => a.id === id);
    if (!existing) return { success: false, error: "User account not found." };

    const updated = accounts.map((a) => (a.id === id ? { ...a, password: cleanPass } : a));
    persistAccounts(updated);
    return { success: true };
  };

  // Toggle active/inactive
  const toggleUserStatus = (id: string): { success: boolean; error?: string } => {
    const existing = accounts.find((a) => a.id === id);
    if (!existing) return { success: false, error: "User not found." };

    if (existing.username.toLowerCase() === "admin" && existing.isActive) {
      return { success: false, error: "Primary Admin account cannot be deactivated." };
    }

    const updated = accounts.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a));
    persistAccounts(updated);
    return { success: true };
  };

  // Delete user (Admin only)
  const deleteUser = (id: string): { success: boolean; error?: string } => {
    const existing = accounts.find((a) => a.id === id);
    if (!existing) return { success: false, error: "User not found." };

    if (existing.username.toLowerCase() === "admin") {
      return { success: false, error: "Primary Admin account cannot be deleted." };
    }

    const cleanUname = existing.username.toLowerCase();

    // Persist to deleted users blacklist so it can NEVER be resurrected
    try {
      if (typeof window !== "undefined") {
        const storedDeleted = localStorage.getItem(STORAGE_KEY_DELETED_USERS);
        const deletedList: string[] = storedDeleted ? JSON.parse(storedDeleted) : [];
        if (!deletedList.includes(cleanUname)) {
          deletedList.push(cleanUname);
          localStorage.setItem(STORAGE_KEY_DELETED_USERS, JSON.stringify(deletedList));
        }
      }
    } catch (e) {
      console.error("Error storing deleted username:", e);
    }

    const updated = accounts.filter((a) => a.id !== id && a.username.toLowerCase() !== cleanUname);
    persistAccounts(updated);
    return { success: true };
  };

  // Reset accounts to default
  const resetToDefaults = () => {
    persistAccounts(DEFAULT_ACCOUNTS);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        accounts,
        login,
        logout,
        addUser,
        updateUser,
        changePassword,
        toggleUserStatus,
        deleteUser,
        resetToDefaults,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
