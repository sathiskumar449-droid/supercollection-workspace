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
  Lock
} from "lucide-react";
import { STAFF_USERS, INITIAL_COURIERS } from "@/lib/mock-data";
import { Role } from "@/types/orderflow";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"business" | "users" | "couriers" | "ping4sms" | "woocommerce" | "whatsapp">("business");
  const [savedSuccess, setSavedSuccess] = useState(false);

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
                        {staff.role}
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
              <div>
                <h3 className="text-sm font-bold text-slate-900">Supported Courier Partners</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Couriers available for parcel handoff with automated tracking URL templates.
                </p>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden text-xs">
                {INITIAL_COURIERS.map((courier) => (
                  <div key={courier.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{courier.name}</span>
                        {courier.isStCourier && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-800 rounded">
                            Primary LLR Partner
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                        Tracking format: {courier.trackingUrlPattern}
                      </span>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active Carrier
                    </span>
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
    </div>
  );
}

