"use client";

import React, { useState } from "react";
import { 
  Lock, 
  User, 
  ArrowRight, 
  ShieldCheck, 
  Truck, 
  Sparkles, 
  AlertCircle,
  Eye,
  EyeOff,
  PackageCheck
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Role } from "@/types/orderflow";
import { cn } from "@/lib/utils";

interface LoginScreenProps {
  onSuccess?: (role?: Role, partnerId?: string) => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = login(username, password);
    if (!res.success) {
      setError(res.error || "Login failed. Please check credentials.");
      setIsSubmitting(false);
      return;
    }

    if (onSuccess) {
      onSuccess(res.role, res.courierPartnerId);
    }
  };

  const handleQuickFill = (userVal: string, passVal: string) => {
    setUsername(userVal);
    setPassword(passVal);
    setError(null);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 font-sans relative overflow-hidden">
      {/* Decorative gradient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg z-10">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-orange-600 text-white items-center justify-center font-black text-xl shadow-lg ring-4 ring-orange-100 mb-3">
              SC
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              SuperCollection
            </h1>
            <p className="text-xs font-bold text-orange-600 tracking-widest uppercase mt-0.5">
              Work Desk Portal
            </p>
            <p className="text-slate-500 text-xs mt-1">
              Order Fulfillment, Packing & Courier Hub Operations
            </p>
          </div>

          {/* Quick Login Presets (3 Access Levels) */}
          <div className="mb-5 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                <span>Quick Access Logins</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Click to prefill</span>
            </div>

            <div className="space-y-2">
              {/* 1. Admin & Staff */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickFill("admin", "1234")}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer",
                    username.toLowerCase() === "admin"
                      ? "bg-orange-50 border-orange-300 ring-1 ring-orange-400/40 text-orange-950 font-semibold"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div className="w-7 h-7 rounded-md bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">Admin Login</div>
                    <div className="text-[10px] text-slate-500 truncate">All Access (1234)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickFill("staff", "1234")}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer",
                    username.toLowerCase() === "staff"
                      ? "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400/40 text-emerald-950 font-semibold"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <PackageCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">Staff Login</div>
                    <div className="text-[10px] text-slate-500 truncate">Packing & Ops (1234)</div>
                  </div>
                </button>
              </div>

              {/* 2. Courier Logins (Partner Specific) */}
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 px-0.5">
                  Courier Partner Portals:
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickFill("stcourier", "1234")}
                    className={cn(
                      "flex flex-col items-center p-2 rounded-lg border text-center transition-all cursor-pointer",
                      username.toLowerCase() === "stcourier"
                        ? "bg-orange-50 border-orange-300 ring-1 ring-orange-400/40 text-orange-950 font-semibold"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <Truck className="w-4 h-4 text-orange-600 mb-1" />
                    <span className="text-[11px] font-bold">ST Courier</span>
                    <span className="text-[9.5px] text-slate-400">stcourier / 1234</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickFill("dtdc", "1234")}
                    className={cn(
                      "flex flex-col items-center p-2 rounded-lg border text-center transition-all cursor-pointer",
                      username.toLowerCase() === "dtdc"
                        ? "bg-cyan-50 border-cyan-300 ring-1 ring-cyan-400/40 text-cyan-950 font-semibold"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <Truck className="w-4 h-4 text-cyan-600 mb-1" />
                    <span className="text-[11px] font-bold">DTDC</span>
                    <span className="text-[9.5px] text-slate-400">dtdc / 1234</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickFill("indiapost", "1234")}
                    className={cn(
                      "flex flex-col items-center p-2 rounded-lg border text-center transition-all cursor-pointer",
                      username.toLowerCase() === "indiapost"
                        ? "bg-amber-50 border-amber-300 ring-1 ring-amber-400/40 text-amber-950 font-semibold"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <Truck className="w-4 h-4 text-amber-600 mb-1" />
                    <span className="text-[11px] font-bold">India Post</span>
                    <span className="text-[9.5px] text-slate-400">indiapost / 1234</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium leading-snug">{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label 
                htmlFor="login-username" 
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="admin, staff, stcourier, dtdc, indiapost"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <label 
                htmlFor="login-password" 
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter password"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>Sign In to Work Desk</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Access Info Note */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 animate-pulse" />
              <span>Multi-Role Access Control</span>
            </span>
            <span className="font-semibold text-slate-400">
              Admin / Staff / Courier
            </span>
          </div>
        </div>

        {/* Outer footer */}
        <p className="text-center text-slate-400 text-xs mt-4">
          SuperCollection Logistics & Warehousing Operations
        </p>
      </div>
    </div>
  );
}
