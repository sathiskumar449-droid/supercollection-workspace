"use client";

import React, { useState, useEffect } from "react";
import { 
  Building2, 
  Users, 
  Truck, 
  Send, 
  Globe, 
  MessageSquare, 
  Key, 
  Eye, 
  EyeOff, 
  Save, 
  Check, 
  Copy,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Plus,
  Pencil,
  X,
  AlertCircle,
  Trash2,
  UserPlus,
  RefreshCw,
  Search,
  PackageCheck,
  User
} from "lucide-react";
import { Role, Courier } from "@/types/orderflow";
import { useOrderFlow } from "@/lib/hooks";
import { useAuth, UserAccount } from "@/lib/auth-context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/ui/toast";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"business" | "users" | "couriers" | "ping4sms" | "woocommerce" | "whatsapp">("business");
  const [savedSuccess, setSavedSuccess] = useState(false);

  const { courierPartners, addCourierPartner, updateCourierPartner, toggleCourierPartner } = useOrderFlow();

  // User Management Auth Hook & State
  const { 
    accounts, 
    addUser, 
    updateUser, 
    changePassword, 
    toggleUserStatus, 
    deleteUser, 
    resetToDefaults 
  } = useAuth();

  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"ALL" | "ADMIN" | "STAFF" | "COURIER">("ALL");
  const [userToast, setUserToast] = useState<string | null>(null);

  // Add User Modal State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserShowPassword, setNewUserShowPassword] = useState(false);
  const [newUserRole, setNewUserRole] = useState<Role>("ORDER_STAFF");
  const [newUserPartnerId, setNewUserPartnerId] = useState<string>("ST_COURIER");
  const [addUserError, setAddUserError] = useState<string | null>(null);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserUsername, setEditUserUsername] = useState("");
  const [editUserRole, setEditUserRole] = useState<Role>("ORDER_STAFF");
  const [editUserPartnerId, setEditUserPartnerId] = useState<string>("ST_COURIER");
  const [editUserError, setEditUserError] = useState<string | null>(null);

  // Change Password Modal State
  const [passwordModalUser, setPasswordModalUser] = useState<UserAccount | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("");
  const [showNewPasswordVal, setShowNewPasswordVal] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);

  // Delete User Confirm Dialog State
  const [deletingUser, setDeletingUser] = useState<UserAccount | null>(null);

  const triggerUserToast = (msg: string) => {
    setUserToast(msg);
    showToast(msg, "success");
    setTimeout(() => setUserToast(null), 3000);
  };

  const filteredAccounts = accounts.filter((acc) => {
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.toLowerCase().trim();
      const matchName = acc.name.toLowerCase().includes(q);
      const matchUname = acc.username.toLowerCase().includes(q);
      const matchPartner = (acc.courierPartnerId || "").toLowerCase().includes(q);
      if (!matchName && !matchUname && !matchPartner) return false;
    }
    if (userRoleFilter === "ADMIN") return acc.role === "ADMIN";
    if (userRoleFilter === "STAFF") return acc.role !== "ADMIN" && acc.role !== "COURIER";
    if (userRoleFilter === "COURIER") return acc.role === "COURIER";
    return true;
  });

  // Add courier modal state
  const [showAddCourierModal, setShowAddCourierModal] = useState(false);
  const [newCourierName, setNewCourierName] = useState("");
  const [newCourierCode, setNewCourierCode] = useState("");
  const [newCourierTracking, setNewCourierTracking] = useState("");
  const [newCourierIsSt, setNewCourierIsSt] = useState(false);

  // Edit courier modal state
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [editCourierName, setEditCourierName] = useState("");
  const [editCourierCode, setEditCourierCode] = useState("");
  const [editCourierTracking, setEditCourierTracking] = useState("");
  const [editCourierIsSt, setEditCourierIsSt] = useState(false);

  // Masked secret fields visibility
  const [showPing4ApiKey, setShowPing4ApiKey] = useState(false);
  const [showWcSecret, setShowWcSecret] = useState(false);
  const [showWaToken, setShowWaToken] = useState(false);

  // Business state
  const [businessName, setBusinessName] = useState("Vastra Collections & Apparel");
  const [gstin, setGstin] = useState("33AABCU9603R1ZM");
  const [dispatchHub, setDispatchHub] = useState("Plot 42, Guindy Industrial Estate, Chennai, TN - 600032");
  const [supportPhone, setSupportPhone] = useState("+91 44 2250 8899");

  // Ping4SMS state
  const [pingApiKey, setPingApiKey] = useState("p4s_live_890bf2314e1a0989fce");
  const [pingUsername, setPingUsername] = useState("vastra_ping4");
  const [pingSenderId, setPingSenderId] = useState("VASTRA");
  const [pingApiUrl, setPingApiUrl] = useState("https://api.ping4sms.com/api/v2/dlr");

  // Webhook & Integration state
  const [wcSecret, setWcSecret] = useState("wc_sec_90fa8319e09bc4");
  const [wcStoreUrl, setWcStoreUrl] = useState("https://supercollections.in");
  const [wcConsumerKey, setWcConsumerKey] = useState("");
  const [wcConsumerSecret, setWcConsumerSecret] = useState("");
  const [showWcKey, setShowWcKey] = useState(false);
  const [waToken, setWaToken] = useState("wa_box_tok_34089ae832b");

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUrl = localStorage.getItem("sc_wc_store_url") || "";
      const savedKey = localStorage.getItem("sc_wc_consumer_key") || "";
      const savedSecret = localStorage.getItem("sc_wc_consumer_secret") || "";
      if (savedUrl) setWcStoreUrl(savedUrl);
      if (savedKey) setWcConsumerKey(savedKey);
      if (savedSecret) setWcConsumerSecret(savedSecret);
    }
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      if (wcStoreUrl) localStorage.setItem("sc_wc_store_url", wcStoreUrl.trim());
      if (wcConsumerKey) localStorage.setItem("sc_wc_consumer_key", wcConsumerKey.trim());
      if (wcConsumerSecret) localStorage.setItem("sc_wc_consumer_secret", wcConsumerSecret.trim());
    }
    if (activeTab === "woocommerce" && wcConsumerKey && wcConsumerSecret) {
      try {
        await fetch("/api/sync/woocommerce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeUrl: wcStoreUrl.trim(),
            consumerKey: wcConsumerKey.trim(),
            consumerSecret: wcConsumerSecret.trim(),
            rangeType: "last_2_days",
          }),
        });
      } catch {}
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-subtle">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Configuration</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage store credentials, staff permissions, courier partners, and external API webhooks.
          </p>
        </div>

        {savedSuccess && (
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Configuration saved successfully
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Settings Navigation Sidebar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-subtle p-2 space-y-1">
          {[
            { key: "business", label: "Business Profile", icon: <Building2 className="w-4 h-4" /> },
            { key: "users", label: "Staff & Roles (RBAC)", icon: <Users className="w-4 h-4" /> },
            { key: "couriers", label: "Courier Partners", icon: <Truck className="w-4 h-4" /> },
            { key: "ping4sms", label: "Ping4SMS Gateway", icon: <Send className="w-4 h-4" /> },
            { key: "woocommerce", label: "WooCommerce Webhook", icon: <Globe className="w-4 h-4" /> },
            { key: "whatsapp", label: "WhatsApp Chat Box", icon: <MessageSquare className="w-4 h-4" /> },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key as any)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-colors",
                activeTab === item.key
                  ? "bg-orange-50 text-orange-900 font-semibold shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Settings Content Area */}
        <div className="md:col-span-3 bg-white rounded-xl border border-slate-200 shadow-subtle p-6">
          
          {/* 1. Business Profile */}
          {activeTab === "business" && (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Business & Dispatch Hub Information</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Appears on parcel shipping manifests, packing slips, and courier pickup requests.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Company / Brand Name</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-600 font-medium mb-1">Dispatch Warehouse Hub Address</label>
                  <input
                    type="text"
                    value={dispatchHub}
                    onChange={(e) => setDispatchHub(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Logistics Support Phone</label>
                  <input
                    type="text"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-700 hover:bg-orange-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Business Profile</span>
                </button>
              </div>
            </form>
          )}

          {/* 2. Staff, Admin & Courier Accounts Management */}
          {activeTab === "users" && (
            <div className="space-y-4">
              {/* Header and Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">User Accounts & Access Control (RBAC)</h3>
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-800 font-mono text-[10.5px] font-bold rounded-full border border-orange-200">
                      {accounts.length} Total Users
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Complete administrative control: create logins, set/change usernames and passwords, assign roles, and configure partner-isolated courier portals.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setNewUserName("");
                      setNewUserUsername("");
                      setNewUserPassword("");
                      setNewUserRole("ORDER_STAFF");
                      setNewUserPartnerId("ST_COURIER");
                      setAddUserError(null);
                      setShowAddUserModal(true);
                    }}
                    className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add New User</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Restore standard default accounts (Admin, Staff, ST Courier, DTDC, India Post)?")) {
                        resetToDefaults();
                        triggerUserToast("Restored standard accounts successfully!");
                      }
                    }}
                    className="p-1.5 border border-slate-300 text-slate-600 hover:bg-white hover:text-slate-900 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    title="Restore default initial accounts"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Toast message inside users tab */}
              {userToast && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{userToast}</span>
                </div>
              )}

              {/* Role Filter Tabs & Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-0.5 rounded-lg text-xs overflow-x-auto">
                  {[
                    { key: "ALL", label: `All Users (${accounts.length})` },
                    { key: "ADMIN", label: `Admin (${accounts.filter(a => a.role === "ADMIN").length})` },
                    { key: "STAFF", label: `Staff (${accounts.filter(a => a.role !== "ADMIN" && a.role !== "COURIER").length})` },
                    { key: "COURIER", label: `Couriers (${accounts.filter(a => a.role === "COURIER").length})` },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setUserRoleFilter(tab.key as any)}
                      className={cn(
                        "px-3 py-1 rounded-md font-semibold transition-all whitespace-nowrap cursor-pointer",
                        userRoleFilter === tab.key
                          ? "bg-white text-slate-900 shadow-xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search name or @username..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 text-slate-800"
                  />
                </div>
              </div>

              {/* Accounts Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10.5px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">User & Username</th>
                      <th className="py-2.5 px-3">Role & Access Scope</th>
                      <th className="py-2.5 px-3">Password</th>
                      <th className="py-2.5 px-2 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400">
                          <Users className="w-7 h-7 mx-auto mb-1.5 text-slate-300" />
                          <p className="font-semibold text-slate-600">No users match your filter criteria.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredAccounts.map((acc) => {
                        const isCourier = acc.role === "COURIER";
                        const isAdmin = acc.role === "ADMIN";
                        const isStaff = !isAdmin && !isCourier;

                        const courierName = acc.courierPartnerId === "ST_COURIER" 
                          ? "ST Courier" 
                          : acc.courierPartnerId === "DTDC" 
                          ? "DTDC" 
                          : acc.courierPartnerId === "INDIA_POST" 
                          ? "India Post" 
                          : acc.courierPartnerId || "Assigned Partner";

                        return (
                          <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* 1. Name & Username */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className={cn(
                                  "w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0",
                                  isAdmin
                                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                                    : isCourier
                                    ? "bg-orange-100 text-orange-800 border border-orange-200"
                                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                )}>
                                  {acc.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                                    <span>{acc.name}</span>
                                    {isAdmin && (
                                      <span className="text-[9.5px] px-1.5 py-0.2 bg-purple-50 text-purple-700 border border-purple-200 rounded font-semibold">
                                        Super
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-mono text-[11px] text-slate-500">
                                    @{acc.username}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 2. Role & Access Scope */}
                            <td className="py-3 px-3">
                              {isAdmin && (
                                <div>
                                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                    Admin (All Access)
                                  </span>
                                  <span className="text-[10px] text-slate-400 block mt-0.5">
                                    Full system, operational & user credentials control
                                  </span>
                                </div>
                              )}
                              {isStaff && (
                                <div>
                                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Staff (Operations)
                                  </span>
                                  <span className="text-[10px] text-slate-400 block mt-0.5">
                                    Orders, Packing, Courier, SMS & Returns
                                  </span>
                                </div>
                              )}
                              {isCourier && (
                                <div>
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[11px] font-bold border",
                                    acc.courierPartnerId === "ST_COURIER"
                                      ? "bg-orange-50 text-orange-700 border-orange-200"
                                      : acc.courierPartnerId === "DTDC"
                                      ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  )}>
                                    Courier: {courierName}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                                    Strictly restricted to {courierName} Work Desk only
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* 3. Password / Credentials */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-xs tracking-wider">
                                  ••••••••
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPasswordModalUser(acc);
                                    setNewPasswordVal("");
                                    setChangePasswordError(null);
                                  }}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10.5px] rounded flex items-center gap-1 transition-colors cursor-pointer border border-slate-200"
                                  title="Change password for this user"
                                >
                                  <Key className="w-3 h-3 text-orange-600" />
                                  <span>Change Password</span>
                                </button>
                              </div>
                            </td>

                            {/* 4. Active Status Toggle */}
                            <td className="py-3 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const res = toggleUserStatus(acc.id);
                                  if (res.success) {
                                    triggerUserToast(`User @${acc.username} status updated!`);
                                  } else {
                                    alert(res.error || "Cannot update status");
                                  }
                                }}
                                className={cn(
                                  "px-2 py-0.5 text-[10px] font-bold rounded-full border transition-all cursor-pointer",
                                  acc.isActive
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                    : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                                )}
                                title="Click to toggle account activation"
                              >
                                {acc.isActive ? "Active" : "Inactive"}
                              </button>
                            </td>

                            {/* 5. Actions: Edit User & Delete */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUser(acc);
                                    setEditUserName(acc.name);
                                    setEditUserUsername(acc.username);
                                    setEditUserRole(acc.role);
                                    setEditUserPartnerId(acc.courierPartnerId || "ST_COURIER");
                                    setEditUserError(null);
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                                  title="Edit user details"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  disabled={acc.username.toLowerCase() === "admin"}
                                  onClick={() => setDeletingUser(acc)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                  title={acc.username.toLowerCase() === "admin" ? "Primary Admin cannot be deleted" : "Delete user"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Couriers */}
          {activeTab === "couriers" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Supported Courier Partners</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure courier partners for parcel pickup and automated tracking URL templates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewCourierName("");
                    setNewCourierCode("");
                    setNewCourierTracking("");
                    setNewCourierIsSt(false);
                    setShowAddCourierModal(true);
                  }}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Courier Partner</span>
                </button>
              </div>

              {/* Courier Partner Privacy Notice */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-amber-900 block">Strict Courier Partner Privacy & Isolation</span>
                  <p className="text-amber-800 text-[11px] leading-relaxed">
                    Each courier partner user (e.g. ST Courier driver / manager) has an isolated portal view. They can only see and manage orders dispatched to their fleet. Multi-courier queues, other partner tabs, and cross-courier API requests are strictly blocked (403 Forbidden).
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden text-xs bg-white">
                {courierPartners.map((courier) => (
                  <div key={courier.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">{courier.name}</span>
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 rounded border border-slate-200">
                          {courier.code}
                        </span>
                        {courier.isStCourier && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-800 rounded">
                            Primary LLR Partner
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded">
                          🔒 Isolated Portal
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 block truncate">
                        Tracking format: {courier.trackingUrlPattern || "Default web search"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => toggleCourierPartner(courier.id)}
                        className={cn(
                          "px-2.5 py-1 rounded text-[11px] font-medium border transition-colors",
                          courier.active !== false
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200"
                        )}
                        title="Click to toggle active status"
                      >
                        {courier.active !== false ? "Active Carrier" : "Inactive"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingCourier(courier);
                          setEditCourierName(courier.name);
                          setEditCourierCode(courier.code);
                          setEditCourierTracking(courier.trackingUrlPattern || "");
                          setEditCourierIsSt(Boolean(courier.isStCourier));
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                        title="Edit courier configuration"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Ping4SMS Gateway */}
          {activeTab === "ping4sms" && (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Ping4SMS Gateway Configuration</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Used by OrderFlow strictly to fetch delivery telemetry and sync handset receipts. (No outgoing SMS).
                </p>
              </div>

              <div className="space-y-3 text-xs pt-2">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Ping4SMS API Key (Masked Secret)</label>
                  <div className="relative">
                    <input
                      type={showPing4ApiKey ? "text" : "password"}
                      value={pingApiKey}
                      onChange={(e) => setPingApiKey(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg outline-none font-mono focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPing4ApiKey(!showPing4ApiKey)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPing4ApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Ping4SMS Username</label>
                    <input
                      type="text"
                      value={pingUsername}
                      onChange={(e) => setPingUsername(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none font-mono focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Registered DLT Sender ID</label>
                    <input
                      type="text"
                      value={pingSenderId}
                      onChange={(e) => setPingSenderId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none font-mono font-bold focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Status Query Endpoint URL</label>
                  <input
                    type="text"
                    value={pingApiUrl}
                    onChange={(e) => setPingApiUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none font-mono focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-700 hover:bg-orange-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Ping4SMS Settings</span>
                </button>
              </div>
            </form>
          )}

          {/* 5. WooCommerce Webhook & REST API */}
          {activeTab === "woocommerce" && (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">WooCommerce Integration & Webhook</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure REST API keys for manual & automated scheduled sync, and webhooks for instant order ingestion.
                </p>
              </div>

              <div className="space-y-3 text-xs pt-2">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">WooCommerce Store URL</label>
                  <input
                    type="url"
                    value={wcStoreUrl}
                    onChange={(e) => setWcStoreUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono text-slate-700"
                    placeholder="https://supercollections.in"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Consumer Key (ck_...)</label>
                  <div className="relative">
                    <input
                      type={showWcKey ? "text" : "password"}
                      value={wcConsumerKey}
                      onChange={(e) => setWcConsumerKey(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg outline-none font-mono focus:border-orange-500"
                      placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWcKey(!showWcKey)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showWcKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Consumer Secret (cs_...)</label>
                  <div className="relative">
                    <input
                      type={showWcSecret ? "text" : "password"}
                      value={wcConsumerSecret}
                      onChange={(e) => setWcConsumerSecret(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg outline-none font-mono focus:border-orange-500"
                      placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWcSecret(!showWcSecret)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showWcSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-slate-600 font-medium mb-1">Webhook Delivery URL (Instant Live Sync)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value="https://supercollection-workspace.vercel.app/api/webhooks/woocommerce"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono text-slate-700 select-all"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard("https://supercollection-workspace.vercel.app/api/webhooks/woocommerce", "wc-url")}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 text-slate-700 flex items-center gap-1 shrink-0"
                    >
                      {copiedKey === "wc-url" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === "wc-url" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 space-y-1">
                  <span className="font-semibold text-slate-800 block">Trigger Topic in WordPress WooCommerce:</span>
                  <p>In WooCommerce → Settings → Advanced → Webhooks, add Webhooks for <strong>"Order Created"</strong> and <strong>"Order Updated"</strong>.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-700 hover:bg-orange-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save WooCommerce Configuration</span>
                </button>
              </div>
            </form>
          )}

          {/* 6. WhatsApp Integration */}
          {activeTab === "whatsapp" && (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Existing WhatsApp Chat Box Webhook</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Connect your existing WhatsApp Chat Box to push confirmed customer orders directly into OrderFlow.
                </p>
              </div>

              <div className="space-y-3 text-xs pt-2">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Order Intake Webhook URL (POST)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value="https://your-domain.com/api/webhooks/whatsapp/order"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono text-slate-700 select-all"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard("https://your-domain.com/api/webhooks/whatsapp/order", "wa-url")}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 text-slate-700 flex items-center gap-1 shrink-0"
                    >
                      {copiedKey === "wa-url" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === "wa-url" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Chat Box Authorization Token (Masked)</label>
                  <div className="relative">
                    <input
                      type={showWaToken ? "text" : "password"}
                      value={waToken}
                      onChange={(e) => setWaToken(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg outline-none font-mono focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWaToken(!showWaToken)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 text-xs">
                  <strong>Strict Decoupling:</strong> The existing WhatsApp Chat Box retains complete ownership of customer messaging, chat inboxes, and payment receipts. OrderFlow ONLY handles the downstream packing, labeling, and dispatch operations.
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-700 hover:bg-orange-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save WhatsApp Integration</span>
                </button>
              </div>
            </form>
          )}

        </div>
      </div>

      {/* Add Courier Partner Modal */}
      {showAddCourierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add New Courier Partner</h3>
              <button
                type="button"
                onClick={() => setShowAddCourierModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCourierName.trim()) return;
                addCourierPartner({
                  name: newCourierName.trim(),
                  code: newCourierCode.trim() || newCourierName.trim().toUpperCase().replace(/\s+/g, "_"),
                  trackingUrlPattern: newCourierTracking.trim() || undefined,
                  isStCourier: newCourierIsSt,
                  active: true,
                });
                setShowAddCourierModal(false);
                setSavedSuccess(true);
                setTimeout(() => setSavedSuccess(false), 3000);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Carrier Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Blue Dart Express, Delhivery"
                  value={newCourierName}
                  onChange={(e) => {
                    setNewCourierName(e.target.value);
                    if (!newCourierCode) {
                      setNewCourierCode(e.target.value.toUpperCase().replace(/\s+/g, "_"));
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Partner Code / Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. BLUEDART, DELHIVERY"
                  value={newCourierCode}
                  onChange={(e) => setNewCourierCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none font-mono focus:border-orange-500 uppercase"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Used for RBAC portal mapping and API queries.</span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tracking URL Pattern</label>
                <input
                  type="text"
                  placeholder="e.g. https://track.carrier.com/search?awb={llr}"
                  value={newCourierTracking}
                  onChange={(e) => setNewCourierTracking(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none font-mono focus:border-orange-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Use {"{llr}"} or {"{trackingNumber}"} as placeholder for parcel LLR / AWB.</span>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCourierIsSt}
                    onChange={(e) => setNewCourierIsSt(e.target.checked)}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-slate-700 font-medium">Designate as Primary LLR Partner</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCourierModal(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Partner</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Courier Partner Modal */}
      {editingCourier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Edit Courier Partner</h3>
              <button
                type="button"
                onClick={() => setEditingCourier(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingCourier || !editCourierName.trim()) return;
                updateCourierPartner(editingCourier.id, {
                  name: editCourierName.trim(),
                  code: editCourierCode.trim().toUpperCase().replace(/\s+/g, "_"),
                  trackingUrlPattern: editCourierTracking.trim() || undefined,
                  isStCourier: editCourierIsSt,
                });
                setEditingCourier(null);
                setSavedSuccess(true);
                setTimeout(() => setSavedSuccess(false), 3000);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Carrier Name *</label>
                <input
                  type="text"
                  required
                  value={editCourierName}
                  onChange={(e) => setEditCourierName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Partner Code / Identifier</label>
                <input
                  type="text"
                  value={editCourierCode}
                  onChange={(e) => setEditCourierCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none font-mono focus:border-orange-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tracking URL Pattern</label>
                <input
                  type="text"
                  placeholder="e.g. https://track.carrier.com/search?awb={llr}"
                  value={editCourierTracking}
                  onChange={(e) => setEditCourierTracking(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none font-mono focus:border-orange-500"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCourierIsSt}
                    onChange={(e) => setEditCourierIsSt(e.target.checked)}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-slate-700 font-medium">Designate as Primary LLR Partner</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCourier(null)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal 1: Add New User */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm font-bold text-slate-900">Add New User Login</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setAddUserError(null);
                const res = addUser({
                  name: newUserName,
                  username: newUserUsername,
                  password: newUserPassword,
                  role: newUserRole,
                  courierPartnerId: newUserRole === "COURIER" ? newUserPartnerId : undefined,
                });
                if (!res.success) {
                  setAddUserError(res.error || "Failed to create user");
                  return;
                }
                setShowAddUserModal(false);
                triggerUserToast(`User @${newUserUsername} created successfully!`);
              }}
              className="p-5 space-y-3.5 text-xs"
            >
              {addUserError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{addUserError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar / ST Courier Lead"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500 text-xs text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Username <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. ramesh / stcourier2"
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none font-mono focus:border-orange-500 text-xs text-slate-800 lowercase"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={newUserShowPassword ? "text" : "password"}
                    placeholder="Enter login password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500 text-xs text-slate-800 font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setNewUserShowPassword(!newUserShowPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {newUserShowPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Access Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as Role)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500 text-xs text-slate-800 font-semibold cursor-pointer"
                >
                  <option value="ORDER_STAFF">Staff (Operations - Packing, Orders, Courier, SMS, Returns)</option>
                  <option value="COURIER">Courier Partner (Single-Partner Isolated Work Desk)</option>
                  <option value="ADMIN">Administrator (Full Access & User Control)</option>
                </select>
              </div>

              {newUserRole === "COURIER" && (
                <div className="p-3 bg-orange-50/70 border border-orange-200 rounded-lg space-y-1.5 animate-in fade-in">
                  <label className="block text-orange-950 font-bold text-[11px]">
                    Assigned Courier Partner <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[10.5px] text-orange-800">
                    This user will ONLY see this specific partner's page and cannot switch tabs.
                  </p>
                  <select
                    value={newUserPartnerId}
                    onChange={(e) => setNewUserPartnerId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-orange-300 rounded-md outline-none font-bold text-xs text-slate-800 cursor-pointer"
                  >
                    <option value="ST_COURIER">ST Courier (stcourier)</option>
                    <option value="DTDC">DTDC (dtdc)</option>
                    <option value="INDIA_POST">India Post (indiapost)</option>
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create User</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Change Password */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setChangePasswordError(null);
                const res = changePassword(passwordModalUser.id, newPasswordVal);
                if (!res.success) {
                  setChangePasswordError(res.error || "Failed to update password");
                  return;
                }
                const uname = passwordModalUser.username;
                setPasswordModalUser(null);
                triggerUserToast(`Password for @${uname} updated successfully!`);
              }}
              className="p-5 space-y-3.5 text-xs"
            >
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Updating credentials for:</span>
                <span className="font-bold text-slate-900 text-xs block">{passwordModalUser.name}</span>
                <span className="font-mono text-[11px] text-orange-600 font-semibold">@{passwordModalUser.username}</span>
              </div>

              {changePasswordError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{changePasswordError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPasswordVal ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPasswordVal}
                    onChange={(e) => setNewPasswordVal(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500 text-xs text-slate-800 font-mono"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPasswordVal(!showNewPasswordVal)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPasswordVal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Edit User Details */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm font-bold text-slate-900">Edit User Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setEditUserError(null);
                const res = updateUser(editingUser.id, {
                  name: editUserName,
                  username: editUserUsername,
                  role: editUserRole,
                  courierPartnerId: editUserRole === "COURIER" ? editUserPartnerId : undefined,
                });
                if (!res.success) {
                  setEditUserError(res.error || "Failed to update user");
                  return;
                }
                setEditingUser(null);
                triggerUserToast("User updated successfully!");
              }}
              className="p-5 space-y-3.5 text-xs"
            >
              {editUserError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editUserError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500 text-xs text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Username</label>
                <input
                  type="text"
                  value={editUserUsername}
                  onChange={(e) => setEditUserUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none font-mono focus:border-orange-500 text-xs text-slate-800 lowercase"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Access Role</label>
                <select
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value as Role)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500 text-xs text-slate-800 font-semibold cursor-pointer"
                >
                  <option value="ORDER_STAFF">Staff (Operations - Packing, Orders, Courier, SMS, Returns)</option>
                  <option value="COURIER">Courier Partner (Single-Partner Isolated Work Desk)</option>
                  <option value="ADMIN">Administrator (Full Access & User Control)</option>
                </select>
              </div>

              {editUserRole === "COURIER" && (
                <div className="p-3 bg-orange-50/70 border border-orange-200 rounded-lg space-y-1.5 animate-in fade-in">
                  <label className="block text-orange-950 font-bold text-[11px]">
                    Assigned Courier Partner
                  </label>
                  <select
                    value={editUserPartnerId}
                    onChange={(e) => setEditUserPartnerId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-orange-300 rounded-md outline-none font-bold text-xs text-slate-800 cursor-pointer"
                  >
                    <option value="ST_COURIER">ST Courier (stcourier)</option>
                    <option value="DTDC">DTDC (dtdc)</option>
                    <option value="INDIA_POST">India Post (indiapost)</option>
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingUser)}
        title="Delete User Account?"
        description={
          deletingUser
            ? `Are you sure you want to permanently delete user account @${deletingUser.username} (${deletingUser.name})? This user will no longer be able to log in.`
            : ""
        }
        confirmLabel="Yes, Delete User"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          if (!deletingUser) return;
          const uname = deletingUser.username;
          const res = deleteUser(deletingUser.id);
          setDeletingUser(null);
          if (res.success) {
            triggerUserToast(`User @${uname} deleted successfully!`);
          } else {
            alert(res.error || "Cannot delete user");
          }
        }}
        onCancel={() => setDeletingUser(null)}
      />
    </div>
  );
}

