"use client";

import React, { useState } from "react";
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
  AlertCircle
} from "lucide-react";
import { STAFF_USERS } from "@/lib/mock-data";
import { Role, Courier } from "@/types/orderflow";
import { useOrderFlow } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"business" | "users" | "couriers" | "ping4sms" | "woocommerce" | "whatsapp">("business");
  const [savedSuccess, setSavedSuccess] = useState(false);

  const { courierPartners, addCourierPartner, updateCourierPartner, toggleCourierPartner } = useOrderFlow();

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

  // Webhook state
  const [wcSecret, setWcSecret] = useState("wc_sec_90fa8319e09bc4");
  const [waToken, setWaToken] = useState("wa_box_tok_34089ae832b");

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
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

          {/* 2. Staff & Roles */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Staff & Role-Based Access Control (RBAC)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pre-configured operational staff mapped to specific operational permissions.
                </p>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden text-xs">
                {STAFF_USERS.map((staff) => (
                  <div key={staff.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center">
                        {staff.name[0]}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900 block">{staff.name}</span>
                        <span className="text-slate-400 text-[11px] font-mono">{staff.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded-full font-semibold text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                        {staff.role} {staff.courierPartnerId ? `(${staff.courierPartnerId})` : ""}
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active" />
                    </div>
                  </div>
                ))}
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

          {/* 5. WooCommerce Webhook */}
          {activeTab === "woocommerce" && (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">WooCommerce Webhook Ingestion</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure this webhook inside your WordPress WooCommerce Admin &gt; Advanced &gt; Webhooks.
                </p>
              </div>

              <div className="space-y-3 text-xs pt-2">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Webhook Delivery URL (POST)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value="https://your-domain.com/api/webhooks/woocommerce/order"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono text-slate-700 select-all"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard("https://your-domain.com/api/webhooks/woocommerce/order", "wc-url")}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 text-slate-700 flex items-center gap-1 shrink-0"
                    >
                      {copiedKey === "wc-url" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === "wc-url" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Webhook Secret (Masked)</label>
                  <div className="relative">
                    <input
                      type={showWcSecret ? "text" : "password"}
                      value={wcSecret}
                      onChange={(e) => setWcSecret(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg outline-none font-mono focus:border-orange-500"
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

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 space-y-1">
                  <span className="font-semibold text-slate-800 block">Trigger Topic:</span>
                  <p>Select <strong>"Order Created"</strong> and <strong>"Order Updated"</strong> in WooCommerce settings.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-700 hover:bg-orange-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save WooCommerce Webhook</span>
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
    </div>
  );
}

