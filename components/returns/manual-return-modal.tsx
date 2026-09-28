"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Order, ReturnReason, ReturnType, RefundMethod, RefundStatus, ReplacementStatus } from "@/types/orderflow";
import { useOrderFlow } from "@/lib/hooks";
import { formatINR, formatDate, cn } from "@/lib/utils";
import { 
  X, 
  Search, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  IndianRupee,
  ArrowRightLeft,
  User,
  Phone,
  Calendar,
  Package,
  Truck,
  Clock,
  ArrowRight,
  Plus,
  Trash2,
  Edit3,
  Check,
  Sparkles,
  Layers
} from "lucide-react";

interface ManualReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrders?: Order[];
  preselectedOrder?: Order | null;
  onSuccess?: (returnId: string, orderId?: string) => void;
}

interface ManualProductItem {
  id: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

const RETURN_REASONS: ReturnReason[] = [
  "Color Issue",
  "Size Issue",
  "Defective/Damaged",
  "Wrong Product",
  "Customer Changed Mind",
  "Other",
];

const REFUND_MODES: Array<{ value: RefundMethod; label: string }> = [
  { value: "Cash", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "Bank", label: "Bank" },
  { value: "Original Payment Method", label: "Original Payment Method" },
];

const REPLACEMENT_STATUSES: ReplacementStatus[] = [
  "Not Dispatched",
  "Packed",
  "Dispatched",
  "Picked Up",
  "Shipped",
];

export function ManualReturnModal({
  isOpen,
  onClose,
  selectedOrders,
  preselectedOrder,
  onSuccess,
}: ManualReturnModalProps) {
  const { orders, returns, createReturnCase } = useOrderFlow();

  // Mode: "SEARCH" (from existing orders in DB) vs "MANUAL" (direct order ID entry)
  const [orderMode, setOrderMode] = useState<"SEARCH" | "MANUAL">("SEARCH");

  // 1. Order selection (SEARCH mode)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // 1. Manual Order Fields (MANUAL mode)
  const [manualOrderId, setManualOrderId] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualCustomerMobile, setManualCustomerMobile] = useState("");
  const [manualOrderDate, setManualOrderDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  });
  const [manualOrderTotal, setManualOrderTotal] = useState<string>("");
  const [manualAmountPaid, setManualAmountPaid] = useState<string>("");

  // 2. Returned Products state
  // For Search mode (existing order): orderItemId -> returned quantity
  const [existingItemQuantities, setExistingItemQuantities] = useState<Record<string, number>>({});

  // For Manual mode: list of manually entered items
  const [manualProducts, setManualProducts] = useState<ManualProductItem[]>([
    { id: "item-1", productName: "", size: "", quantity: 1, unitPrice: 0 }
  ]);

  // 3. Return Type
  const [returnType, setReturnType] = useState<ReturnType>("Refund");

  // 4. Refund fields
  const [refundAmountOverride, setRefundAmountOverride] = useState<string>("");
  const [refundMode, setRefundMode] = useState<RefundMethod>("UPI");
  const [refundStatus, setRefundStatus] = useState<RefundStatus>("Pending");
  const [refundDateTime, setRefundDateTime] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [refundReferenceNo, setRefundReferenceNo] = useState("");

  // 5. Exchange fields
  const [repProductName, setRepProductName] = useState("");
  const [repSize, setRepSize] = useState("");
  const [repQty, setRepQty] = useState(1);
  const [repUnitPrice, setRepUnitPrice] = useState<number>(0);
  const [extraPaymentStatus, setExtraPaymentStatus] = useState("Pending");
  const [exchangePaymentMode, setExchangePaymentMode] = useState<RefundMethod>("UPI");
  const [exchangeReferenceNo, setExchangeReferenceNo] = useState("");

  // 6. Replacement Fulfillment
  const [replacementDispatchNo, setReplacementDispatchNo] = useState("");
  const [replacementStatus, setReplacementStatus] = useState<ReplacementStatus>("Not Dispatched");

  // 7. Return Reason & Notes
  const [returnReason, setReturnReason] = useState<ReturnReason>("Color Issue");
  const [returnNotes, setReturnNotes] = useState("");

  // Status & Validation
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search results for autocomplete
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return orders
      .filter((o) => {
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.externalOrderId.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.mobile.replace(/\s+/g, "").includes(q.replace(/\s+/g, ""))
        );
      })
      .slice(0, 6);
  }, [orders, searchQuery]);

  // Check if manual order ID matches an existing order in DB
  const matchingOrderByManualId = useMemo(() => {
    if (!manualOrderId.trim() || orderMode !== "MANUAL") return null;
    const q = manualOrderId.toLowerCase().trim();
    return orders.find(
      (o) => o.orderNumber.toLowerCase() === q || o.externalOrderId.toLowerCase() === q
    );
  }, [manualOrderId, orderMode, orders]);

  // Handle selecting an order from search
  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setSearchQuery("");
    setErrorMsg(null);
    setOrderMode("SEARCH");
    setRefundAmountOverride("");

    const initialQuantities: Record<string, number> = {};
    order.items.forEach((it) => {
      const existing = returns.filter(
        (r) => (r.orderId === order.id || r.orderNumber === order.orderNumber) &&
          r.status !== "Rejected" && r.status !== "Cancelled"
      );
      let alreadyReturned = 0;
      existing.forEach((ret) => {
        ret.items.forEach((ri) => {
          if ((ri.orderItemId && ri.orderItemId === it.id) || (ri.productName === it.productName && ri.size === it.size)) {
            alreadyReturned += ri.requestedQuantity;
          }
        });
      });
      const available = Math.max(0, it.quantity - alreadyReturned);
      initialQuantities[it.id] = available > 0 ? available : 0;
    });

    setExistingItemQuantities(initialQuantities);

    // Pre-fill replacement product with first item
    if (order.items.length > 0) {
      const first = order.items[0];
      setRepProductName(first.productName);
      setRepSize(first.size || "L");
      setRepUnitPrice(first.unitPrice || 0);
      setRepQty(1);
    }
  };

  // Sync selected order when opened with preselectedOrder or selectedOrders
  useEffect(() => {
    if (!isOpen) {
      setSelectedOrder(null);
      setSearchQuery("");
      setOrderMode("SEARCH");
      setErrorMsg(null);
      return;
    }

    if (preselectedOrder) {
      handleSelectOrder(preselectedOrder);
    } else if (selectedOrders && selectedOrders.length > 0) {
      setSelectedOrder((current) => {
        if (current && selectedOrders.some((o) => o.id === current.id)) {
          return current;
        }
        handleSelectOrder(selectedOrders[0]);
        return selectedOrders[0];
      });
    }
  }, [isOpen, preselectedOrder, selectedOrders]);

  // Switch to manual mode with optional prefilled ID
  const handleSwitchToManual = (prefilledId?: string) => {
    setSelectedOrder(null);
    setOrderMode("MANUAL");
    if (prefilledId) {
      setManualOrderId(prefilledId);
    }
    setErrorMsg(null);
  };

  // Auto-fill from matching order if found in manual mode
  const handleAutoFillFromMatching = () => {
    if (!matchingOrderByManualId) return;
    handleSelectOrder(matchingOrderByManualId);
  };

  // Add / remove / change manual product items
  const handleAddManualProduct = () => {
    setManualProducts((prev) => [
      ...prev,
      { id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, productName: "", size: "L", quantity: 1, unitPrice: 0 }
    ]);
  };

  const handleRemoveManualProduct = (id: string) => {
    if (manualProducts.length <= 1) return;
    setManualProducts((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateManualProduct = (id: string, field: keyof ManualProductItem, val: any) => {
    setManualProducts((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: val } : it))
    );
    setErrorMsg(null);
  };

  // Existing order item quantity change
  const handleQtyChange = (itemId: string, maxAvailable: number, delta: number) => {
    setExistingItemQuantities((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, Math.min(maxAvailable, current + delta));
      return { ...prev, [itemId]: next };
    });
    setErrorMsg(null);
  };

  const handleDirectQtyInput = (itemId: string, maxAvailable: number, val: number) => {
    const valid = Math.max(0, Math.min(maxAvailable, isNaN(val) ? 0 : val));
    setExistingItemQuantities((prev) => ({ ...prev, [itemId]: valid }));
    setErrorMsg(null);
  };

  // Calculate returned products analysis for existing order
  const existingOrderCalculations = useMemo(() => {
    if (!selectedOrder) return { items: [], totalReturnedQty: 0, totalReturnedValue: 0 };

    const existing = returns.filter(
      (r) => (r.orderId === selectedOrder.id || r.orderNumber === selectedOrder.orderNumber) &&
        r.status !== "Rejected" && r.status !== "Cancelled"
    );

    let totalReturnedQty = 0;
    let totalReturnedValue = 0;

    const items = selectedOrder.items.map((it) => {
      let alreadyReturned = 0;
      existing.forEach((ret) => {
        ret.items.forEach((ri) => {
          if ((ri.orderItemId && ri.orderItemId === it.id) || (ri.productName === it.productName && ri.size === it.size)) {
            alreadyReturned += ri.requestedQuantity;
          }
        });
      });

      const maxReturnable = Math.max(0, it.quantity - alreadyReturned);
      const chosenQty = Math.max(0, Math.min(maxReturnable, existingItemQuantities[it.id] || 0));
      const lineReturnAmount = chosenQty * it.unitPrice;

      if (chosenQty > 0) {
        totalReturnedQty += chosenQty;
        totalReturnedValue += lineReturnAmount;
      }

      return {
        ...it,
        alreadyReturned,
        maxReturnable,
        chosenQty,
        lineReturnAmount,
      };
    });

    return { items, totalReturnedQty, totalReturnedValue };
  }, [selectedOrder, existingItemQuantities, returns]);

  // Calculate returned products for manual entry
  const manualProductsCalculations = useMemo(() => {
    let totalReturnedQty = 0;
    let totalReturnedValue = 0;

    manualProducts.forEach((it) => {
      const qty = Math.max(0, it.quantity || 0);
      const price = Math.max(0, it.unitPrice || 0);
      totalReturnedQty += qty;
      totalReturnedValue += qty * price;
    });

    return { totalReturnedQty, totalReturnedValue };
  }, [manualProducts]);

  // Unified totals depending on mode
  const activeTotalReturnedQty = selectedOrder
    ? existingOrderCalculations.totalReturnedQty
    : manualProductsCalculations.totalReturnedQty;

  const activeTotalReturnedValue = selectedOrder
    ? existingOrderCalculations.totalReturnedValue
    : manualProductsCalculations.totalReturnedValue;

  // Active Refund amount
  const activeRefundAmount = refundAmountOverride !== ""
    ? parseFloat(refundAmountOverride) || 0
    : activeTotalReturnedValue;

  // Active Replacement calculations
  const replacementTotal = (repQty || 1) * (repUnitPrice || 0);
  const exchangeDifference = replacementTotal - activeTotalReturnedValue;
  const exchangeDifferenceType: "CUSTOMER_PAYS" | "SHOP_REFUNDS" | "NO_DIFFERENCE" =
    exchangeDifference > 0
      ? "CUSTOMER_PAYS"
      : exchangeDifference < 0
      ? "SHOP_REFUNDS"
      : "NO_DIFFERENCE";

  // Amount paid
  const activeAmountPaid = selectedOrder
    ? selectedOrder.paymentStatus === "PAID"
      ? selectedOrder.totalAmount
      : 0
    : manualAmountPaid !== ""
    ? parseFloat(manualAmountPaid) || 0
    : parseFloat(manualOrderTotal) || activeTotalReturnedValue;

  // Submission handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (orderMode === "SEARCH" && !selectedOrder) {
      setErrorMsg("Please search and select an order, or switch to 'Enter Order ID Manually'.");
      return;
    }

    if (orderMode === "MANUAL" && !manualOrderId.trim()) {
      setErrorMsg("Please enter an Order ID.");
      return;
    }

    if (activeTotalReturnedQty <= 0) {
      setErrorMsg("Please specify at least 1 returned product with quantity > 0.");
      return;
    }

    if (orderMode === "MANUAL") {
      const emptyName = manualProducts.some((p) => !p.productName.trim());
      if (emptyName) {
        setErrorMsg("Please fill in the product name for all returned items.");
        return;
      }
    }

    if (returnType === "Exchange") {
      if (!repProductName.trim()) {
        setErrorMsg("Please specify the replacement product name.");
        return;
      }
      if (repUnitPrice < 0) {
        setErrorMsg("Replacement unit price cannot be negative.");
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const itemsToReturn = selectedOrder
      ? existingOrderCalculations.items
          .filter((it) => it.chosenQty > 0)
          .map((it) => ({
            orderItemId: it.id,
            productName: it.productName,
            sku: it.sku,
            color: it.color || "Standard",
            size: it.size,
            purchasedQuantity: it.quantity,
            returnQuantity: it.chosenQty,
            unitPrice: it.unitPrice,
          }))
      : manualProducts.map((it, idx) => ({
          orderItemId: `man-item-${idx}-${Date.now()}`,
          productName: it.productName.trim(),
          sku: `SKU-${idx + 1}`,
          color: "Standard",
          size: it.size || "M",
          purchasedQuantity: it.quantity,
          returnQuantity: it.quantity,
          unitPrice: it.unitPrice || 0,
        }));

    const result = createReturnCase({
      orderId: selectedOrder ? selectedOrder.id : manualOrderId.trim(),
      customerName: selectedOrder ? selectedOrder.customer.name : manualCustomerName.trim() || "Customer",
      customerPhone: selectedOrder ? selectedOrder.customer.mobile : manualCustomerMobile.trim() || "",
      returnType,
      reason: returnReason,
      customerNote: returnNotes.trim() || undefined,
      items: itemsToReturn,
      // Rule 8: Manual return - strictly current timestamp, no backdating
      isManual: true,
      originalOrderDate: selectedOrder ? selectedOrder.createdAt : (manualOrderDate || new Date().toISOString()),
      originalOrderTotal: selectedOrder ? selectedOrder.totalAmount : (parseFloat(manualOrderTotal) || activeTotalReturnedValue),
      originalAmountPaid: activeAmountPaid,
      // If Refund
      refundAmount: returnType === "Refund" ? activeRefundAmount : undefined,
      refundMode: returnType === "Refund" ? refundMode : undefined,
      refundStatus: returnType === "Refund" ? refundStatus : undefined,
      refundDateTime: returnType === "Refund" ? (refundDateTime ? new Date(refundDateTime).toISOString() : new Date().toISOString()) : undefined,
      refundReferenceNumber: returnType === "Refund" ? refundReferenceNo.trim() || undefined : undefined,
      // If Exchange
      replacementProduct: returnType === "Exchange" ? {
        productName: repProductName.trim(),
        size: repSize.trim() || "Standard",
        quantity: repQty || 1,
        unitPrice: repUnitPrice || 0,
        total: replacementTotal,
      } : undefined,
      exchangeDifference: returnType === "Exchange" ? exchangeDifference : undefined,
      exchangeDifferenceType: returnType === "Exchange" ? exchangeDifferenceType : undefined,
      exchangePaymentStatus: returnType === "Exchange" ? extraPaymentStatus : undefined,
      exchangePaymentMode: returnType === "Exchange" ? exchangePaymentMode : undefined,
      exchangeReferenceNumber: returnType === "Exchange" ? exchangeReferenceNo.trim() || undefined : undefined,
      replacementDispatchNumber: returnType === "Exchange" ? replacementDispatchNo.trim() || undefined : undefined,
      replacementStatus: returnType === "Exchange" ? replacementStatus : undefined,
    });

    setIsSubmitting(false);

    if (result.success && result.returnCase) {
      onSuccess?.(result.returnCase.returnId, selectedOrder ? selectedOrder.id : manualOrderId.trim());
      onClose();
    } else {
      setErrorMsg(result.error || "Failed to create manual return. Please review the inputs.");
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal / Slide Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center shadow-xs">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  {selectedOrder ? "Mark as Return" : "Add Return"}
                </h2>
                {selectedOrder ? (
                  <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
                    {selectedOrder.orderNumber}
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-bold bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded border border-orange-200">
                    Staff Entry
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {selectedOrder 
                  ? `${selectedOrder.customer.name} • ${selectedOrder.customer.mobile}` 
                  : "Record customer walk-in, phone, or direct return entry"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* SECTION 1: ORIGINAL ORDER */}
          {/* ============================================================== */}
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                <span>Original Order Selection / Entry</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {orderMode === "SEARCH" ? "Select order from system database" : "Enter custom Order ID & details directly"}
              </span>
            </div>

            {/* If multiple orders selected, show order switcher dropdown */}
            {selectedOrders && selectedOrders.length > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-orange-50/90 border border-orange-200 rounded-xl text-xs shadow-2xs">
                <div className="flex items-center gap-2 text-orange-950 font-bold">
                  <Layers className="w-4 h-4 text-orange-600 shrink-0" />
                  <span>Select order ({selectedOrders.length} selected):</span>
                </div>
                <select
                  value={selectedOrder?.id || ""}
                  onChange={(e) => {
                    const ord = selectedOrders.find((o) => o.id === e.target.value);
                    if (ord) handleSelectOrder(ord);
                  }}
                  className="bg-white border border-orange-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer shadow-2xs max-w-full sm:max-w-md truncate"
                >
                  {selectedOrders.map((ord, idx) => (
                    <option key={ord.id} value={ord.id}>
                      #{idx + 1}: {ord.orderNumber} - {ord.customer.name} ({formatINR(ord.totalAmount)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Prominent High-Visibility Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-200/70 rounded-xl border border-slate-300/80 gap-1">
              <button
                type="button"
                onClick={() => {
                  setOrderMode("SEARCH");
                  setErrorMsg(null);
                }}
                className={cn(
                  "py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                  orderMode === "SEARCH"
                    ? "bg-white text-orange-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
                )}
              >
                <Search className="w-3.5 h-3.5 text-orange-600" />
                <span>Search Existing Order</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedOrder(null);
                  setOrderMode("MANUAL");
                  setErrorMsg(null);
                }}
                className={cn(
                  "py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                  orderMode === "MANUAL"
                    ? "bg-white text-orange-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
                )}
              >
                <Edit3 className="w-3.5 h-3.5 text-orange-600" />
                <span>Direct Order ID Manual Entry</span>
              </button>
            </div>

            {/* MODE 1: SEARCH EXISTING ORDERS */}
            {orderMode === "SEARCH" && (
              <>
                {!selectedOrder ? (
                  <div className="space-y-2.5">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      Search Order by ID (e.g. SC-WC-17875), Customer Name, or Mobile:
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (searchResults.length > 0) {
                              handleSelectOrder(searchResults[0]);
                            } else if (searchQuery.trim()) {
                              handleSwitchToManual(searchQuery.trim());
                            }
                          }
                        }}
                        placeholder="Type order ID (press Enter to select or create), customer name, or phone number..."
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-slate-900 font-medium text-xs placeholder:text-slate-400 shadow-2xs"
                        autoFocus
                      />
                    </div>

                    {/* Autocomplete Dropdown */}
                    {searchResults.length > 0 && (
                      <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white shadow-sm mt-1">
                        {searchResults.map((ord) => (
                          <div
                            key={ord.id}
                            onClick={() => handleSelectOrder(ord)}
                            className="p-2.5 hover:bg-orange-50/70 cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900 text-xs">{ord.orderNumber}</span>
                                {ord.externalOrderId && (
                                  <span className="text-[10px] text-slate-400 font-mono">#{ord.externalOrderId}</span>
                                )}
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-medium">
                                  {ord.orderStatus}
                                </span>
                              </div>
                              <div className="text-slate-600 font-medium text-[11px] mt-0.5">
                                {ord.customer.name} · <span className="font-mono text-slate-500">{ord.customer.mobile}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold text-slate-900 text-xs">{formatINR(ord.totalAmount)}</div>
                              <div className="text-[10px] text-slate-400">{formatDate(ord.createdAt)}</div>
                            </div>
                          </div>
                        ))}

                        {/* Option to bypass search with typed query */}
                        {searchQuery.trim() && (
                          <div className="p-2 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                            <span>Don't see what you need?</span>
                            <button
                              type="button"
                              onClick={() => handleSwitchToManual(searchQuery.trim())}
                              className="text-orange-600 hover:text-orange-700 font-bold hover:underline cursor-pointer"
                            >
                              Enter "{searchQuery.trim()}" directly manually →
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* If typed but no results */}
                    {searchQuery.trim() && searchResults.length === 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs animate-in fade-in">
                        <span className="text-amber-800">
                          No order matching <strong>"{searchQuery.trim()}"</strong> in database.
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSwitchToManual(searchQuery.trim())}
                          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors"
                        >
                          Enter Order "{searchQuery.trim()}" Manually
                        </button>
                      </div>
                    )}

                    {/* Quick Link to Manual Entry */}
                    {!searchQuery && (
                      <div className="pt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Need to record a return for an offline/unlisted order?</span>
                        <button
                          type="button"
                          onClick={() => handleSwitchToManual()}
                          className="text-orange-600 hover:text-orange-700 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Switch to Direct Manual Entry</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Selected Order Snapshot */
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">Order ID</span>
                        <span className="font-mono font-bold text-orange-700 text-xs">{selectedOrder.orderNumber}</span>
                        {selectedOrder.externalOrderId && (
                          <span className="text-[9.5px] text-slate-400 font-mono block">#{selectedOrder.externalOrderId}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">Customer</span>
                        <span className="font-semibold text-slate-900 block truncate" title={selectedOrder.customer.name}>
                          {selectedOrder.customer.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">{selectedOrder.customer.mobile}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">Order Date</span>
                        <span className="font-medium text-slate-800 text-[11px]">{formatDate(selectedOrder.createdAt)}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">Order Total</span>
                        <span className="font-mono font-bold text-slate-900 text-xs">{formatINR(selectedOrder.totalAmount)}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">Already Paid</span>
                        <span className="font-mono font-bold text-emerald-700 text-xs">{formatINR(activeAmountPaid)}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded inline-block mt-0.5 bg-emerald-100 text-emerald-800">
                          {selectedOrder.paymentStatus}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(null)}
                        className="text-xs font-semibold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
                      >
                        Change Order Selection
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* MODE 2: ENTER ORDER ID MANUALLY */}
            {orderMode === "MANUAL" && (
              <div className="space-y-3 bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-2xs">
                {matchingOrderByManualId && (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900 animate-in fade-in">
                    <span className="font-medium">
                      💡 Found order <strong>{matchingOrderByManualId.orderNumber}</strong> in system for <strong>{matchingOrderByManualId.customer.name}</strong>!
                    </span>
                    <button
                      type="button"
                      onClick={handleAutoFillFromMatching}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10.5px] cursor-pointer transition-colors"
                    >
                      Auto-fill from Order
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                      Order ID / Number: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={manualOrderId}
                      onChange={(e) => setManualOrderId(e.target.value)}
                      placeholder="e.g. SC-WC-17922 or ORD-1029"
                      className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-xs text-slate-900 outline-none focus:border-orange-500 focus:bg-white"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Customer Name:</label>
                    <input
                      type="text"
                      value={manualCustomerName}
                      onChange={(e) => setManualCustomerName(e.target.value)}
                      placeholder="e.g. Suriya / Priya"
                      className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded font-medium text-xs text-slate-900 outline-none focus:border-orange-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Customer Mobile:</label>
                    <input
                      type="text"
                      value={manualCustomerMobile}
                      onChange={(e) => setManualCustomerMobile(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded font-mono text-xs text-slate-900 outline-none focus:border-orange-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Original Order Date:</label>
                    <input
                      type="date"
                      value={manualOrderDate}
                      onChange={(e) => setManualOrderDate(e.target.value)}
                      className="w-full py-1.5 px-2 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800 outline-none focus:border-orange-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Original Order Total (₹):</label>
                    <input
                      type="number"
                      min={0}
                      value={manualOrderTotal}
                      onChange={(e) => setManualOrderTotal(e.target.value)}
                      placeholder={activeTotalReturnedValue ? String(activeTotalReturnedValue) : "e.g. 189"}
                      className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-xs text-slate-900 outline-none focus:border-orange-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Amount Already Paid (₹):</label>
                    <input
                      type="number"
                      min={0}
                      value={manualAmountPaid}
                      onChange={(e) => setManualAmountPaid(e.target.value)}
                      placeholder={manualOrderTotal || (activeTotalReturnedValue ? String(activeTotalReturnedValue) : "0")}
                      className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-xs text-emerald-700 outline-none focus:border-orange-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* SECTION 2: RETURNED PRODUCT */}
          {/* ============================================================== */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                <span>Returned Product(s)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {selectedOrder 
                  ? "Select from order items (supports partial qty)" 
                  : orderMode === "SEARCH" 
                  ? "Select an order to view products" 
                  : "Enter product(s) being returned"}
              </span>
            </div>

            {/* A. If selected order from DB exists: show order items table */}
            {selectedOrder ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/40">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold text-[10.5px] uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Product Name</th>
                      <th className="py-2 px-2 text-center">Size</th>
                      <th className="py-2 px-2 text-center">Purchased</th>
                      <th className="py-2 px-2 text-center">Unit Price</th>
                      <th className="py-2 px-3 text-center">Qty to Return</th>
                      <th className="py-2 px-3 text-right">Return Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {existingOrderCalculations.items.map((it) => {
                      const isReturning = it.chosenQty > 0;
                      return (
                        <tr 
                          key={it.id} 
                          className={cn(
                            "transition-colors",
                            isReturning ? "bg-orange-50/50" : "bg-white"
                          )}
                        >
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-900 block">{it.productName}</span>
                            {it.sku && <span className="text-[10px] text-slate-400 font-mono">{it.sku}</span>}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-700">{it.size}</td>
                          <td className="py-2.5 px-2 text-center font-medium text-slate-600">
                            {it.quantity} pc{it.quantity > 1 ? "s" : ""}
                            {it.alreadyReturned > 0 && (
                              <span className="text-[9.5px] text-rose-600 block">(-{it.alreadyReturned} returned)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-800">
                            {formatINR(it.unitPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {it.maxReturnable === 0 ? (
                              <span className="text-[10px] text-slate-400 italic">Fully Returned</span>
                            ) : (
                              <div className="inline-flex items-center border border-slate-300 rounded bg-white overflow-hidden shadow-2xs">
                                <button
                                  type="button"
                                  disabled={it.chosenQty <= 0}
                                  onClick={() => handleQtyChange(it.id, it.maxReturnable, -1)}
                                  className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  max={it.maxReturnable}
                                  value={it.chosenQty}
                                  onChange={(e) => handleDirectQtyInput(it.id, it.maxReturnable, parseInt(e.target.value))}
                                  className="w-12 text-center font-bold font-mono text-xs border-x border-slate-200 py-1 outline-none text-slate-900"
                                />
                                <button
                                  type="button"
                                  disabled={it.chosenQty >= it.maxReturnable}
                                  onClick={() => handleQtyChange(it.id, it.maxReturnable, 1)}
                                  className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {it.chosenQty > 0 ? formatINR(it.lineReturnAmount) : "₹0"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100/70 border-t border-slate-200 font-bold text-slate-900 text-xs">
                    <tr>
                      <td colSpan={4} className="py-2 px-3 text-slate-600">Total Returned Items Value:</td>
                      <td className="py-2 px-3 text-center font-mono text-orange-700">
                        {existingOrderCalculations.totalReturnedQty} pc(s)
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-orange-700 text-sm">
                        {formatINR(existingOrderCalculations.totalReturnedValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : orderMode === "SEARCH" ? (
              /* Informative card when in SEARCH mode and no order selected yet */
              <div className="p-6 bg-slate-50/80 border border-dashed border-slate-300 rounded-xl text-center space-y-2.5">
                <Package className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="font-bold text-slate-700 text-xs">No Order Selected Yet</div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Search and pick an order in Step 1 above to load products automatically, or switch to Direct Manual Entry to type products manually.
                </p>
                <button
                  type="button"
                  onClick={() => handleSwitchToManual(searchQuery.trim())}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Switch to Direct Manual Entry</span>
                </button>
              </div>
            ) : (
              /* B. If manual order mode: editable manual returned products list */
              <div className="space-y-2.5">
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/40">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold text-[10.5px] uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Product Name</th>
                        <th className="py-2 px-2 w-24">Size</th>
                        <th className="py-2 px-2 w-20 text-center">Qty</th>
                        <th className="py-2 px-2 w-28 text-right">Unit Price (₹)</th>
                        <th className="py-2 px-3 w-28 text-right">Return Amount</th>
                        <th className="py-2 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {manualProducts.map((p, idx) => {
                        const lineAmount = (p.quantity || 0) * (p.unitPrice || 0);
                        return (
                          <tr key={p.id}>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={p.productName}
                                onChange={(e) => handleUpdateManualProduct(p.id, "productName", e.target.value)}
                                placeholder="e.g. Shorts - Navy Blue / Denim Shirt"
                                className="w-full py-1 px-2 border border-slate-300 rounded font-medium text-xs text-slate-900 outline-none focus:border-orange-500"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={p.size || ""}
                                onChange={(e) => handleUpdateManualProduct(p.id, "size", e.target.value)}
                                placeholder="e.g. M, 32, XL"
                                className="w-full py-1 px-2 border border-slate-300 rounded font-semibold text-xs text-slate-800 outline-none focus:border-orange-500 focus:bg-white"
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                min={1}
                                value={p.quantity}
                                onChange={(e) => handleUpdateManualProduct(p.id, "quantity", parseInt(e.target.value) || 1)}
                                className="w-full py-1 px-1 text-center font-mono font-bold border border-slate-300 rounded text-xs text-slate-900 outline-none"
                              />
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={p.unitPrice}
                                onChange={(e) => handleUpdateManualProduct(p.id, "unitPrice", parseFloat(e.target.value) || 0)}
                                className="w-full py-1 px-2 text-right font-mono font-bold border border-slate-300 rounded text-xs text-slate-900 outline-none"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              {formatINR(lineAmount)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {manualProducts.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveManualProduct(p.id)}
                                  className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100/70 border-t border-slate-200 font-bold text-slate-900 text-xs">
                      <tr>
                        <td colSpan={2} className="py-2 px-3 text-slate-600">Total Returned Items:</td>
                        <td className="py-2 px-2 text-center font-mono text-orange-700">
                          {manualProductsCalculations.totalReturnedQty} pc(s)
                        </td>
                        <td colSpan={1} className="py-2 px-2 text-right text-slate-600">Total Returned Value:</td>
                        <td className="py-2 px-3 text-right font-mono text-orange-700 text-sm">
                          {formatINR(manualProductsCalculations.totalReturnedValue)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleAddManualProduct}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Returned Product</span>
                  </button>

                  <span className="text-[11px] text-slate-400 italic">
                    Multiple returned products supported
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* SECTION 3: RETURN TYPE */}
          {/* ============================================================== */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
              <span>Return Type Decision</span>
            </span>

            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => setReturnType("Refund")}
                className={cn(
                  "p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3",
                  returnType === "Refund"
                    ? "border-rose-500 bg-rose-50/50 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  returnType === "Refund" ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"
                )}>
                  <IndianRupee className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-xs block">Refund</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Return payment back to customer via UPI, Bank, Cash or Gateway
                  </span>
                </div>
              </div>

              <div
                onClick={() => setReturnType("Exchange")}
                className={cn(
                  "p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3",
                  returnType === "Exchange"
                    ? "border-purple-500 bg-purple-50/50 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  returnType === "Exchange" ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600"
                )}>
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-xs block">Exchange</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Send replacement product or size and calculate price difference
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* SECTION 4: IF REFUND */}
          {/* ============================================================== */}
          {returnType === "Refund" && (
            <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-200 space-y-4 animate-in fade-in">
              <span className="font-bold text-rose-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-rose-200/70 pb-2">
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold">4</span>
                <span>Refund Execution Details</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Returned Product Value (Auto-calculated):
                  </label>
                  <div className="py-2 px-3 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-sm">
                    {formatINR(activeTotalReturnedValue)}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Actual Refund Amount (₹):
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={refundAmountOverride !== "" ? refundAmountOverride : activeTotalReturnedValue}
                    onChange={(e) => setRefundAmountOverride(e.target.value)}
                    className="w-full py-2 px-3 bg-white border border-rose-300 focus:border-rose-500 rounded-lg font-mono font-bold text-rose-700 text-sm outline-none shadow-2xs"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Defaults to returned product value; adjust if deducting fees.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Refund Mode:</label>
                  <select
                    value={refundMode}
                    onChange={(e) => setRefundMode(e.target.value as RefundMethod)}
                    className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-lg font-medium text-xs text-slate-800 outline-none"
                  >
                    {REFUND_MODES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Refund Status:</label>
                  <select
                    value={refundStatus}
                    onChange={(e) => setRefundStatus(e.target.value as RefundStatus)}
                    className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-lg font-bold text-xs text-slate-800 outline-none"
                  >
                    <option value="Pending">Pending (Processing)</option>
                    <option value="Refunded">Refunded (Completed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Refund Date/Time:</label>
                  <input
                    type="datetime-local"
                    value={refundDateTime}
                    onChange={(e) => setRefundDateTime(e.target.value)}
                    className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg font-medium text-xs text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Transaction / UTR Reference Number:
                </label>
                <input
                  type="text"
                  value={refundReferenceNo}
                  onChange={(e) => setRefundReferenceNo(e.target.value)}
                  placeholder="e.g. UPI/123456789012 or IMPS-987654"
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SECTION 5: IF EXCHANGE */}
          {/* ============================================================== */}
          {returnType === "Exchange" && (
            <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200 space-y-4 animate-in fade-in">
              <span className="font-bold text-purple-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-purple-200/70 pb-2">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold">5</span>
                <span>Exchange & Price Difference Calculation</span>
              </span>

              {/* TWO SEPARATE SECTIONS: RETURNED PRODUCT VS REPLACEMENT PRODUCT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* RETURNED PRODUCT SUMMARY */}
                <div className="p-3 bg-white rounded-lg border border-purple-200 space-y-2">
                  <span className="font-bold text-slate-900 text-xs uppercase tracking-tight flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>Returned Product Summary</span>
                  </span>
                  
                  <div className="space-y-1.5 divide-y divide-slate-100 text-xs max-h-36 overflow-y-auto">
                    {selectedOrder ? (
                      existingOrderCalculations.items.filter((it) => it.chosenQty > 0).map((it) => (
                        <div key={it.id} className="pt-1.5 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-900 block truncate max-w-[180px]">{it.productName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">Size: {it.size} · Qty: {it.chosenQty}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-800">{formatINR(it.lineReturnAmount)}</span>
                        </div>
                      ))
                    ) : (
                      manualProducts.map((p) => (
                        <div key={p.id} className="pt-1.5 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-900 block truncate max-w-[180px]">{p.productName || "Product"}</span>
                            <span className="text-[10px] text-slate-500 font-mono">Size: {p.size} · Qty: {p.quantity}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-800">{formatINR((p.quantity || 0) * (p.unitPrice || 0))}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold text-xs">
                    <span className="text-slate-600">Total Returned Value:</span>
                    <span className="font-mono text-rose-700">{formatINR(activeTotalReturnedValue)}</span>
                  </div>
                </div>

                {/* REPLACEMENT PRODUCT INPUT */}
                <div className="p-3 bg-white rounded-lg border border-purple-200 space-y-2.5">
                  <span className="font-bold text-slate-900 text-xs uppercase tracking-tight flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-purple-600" />
                    <span>Replacement Product</span>
                  </span>

                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">Product Name:</label>
                    <input
                      type="text"
                      value={repProductName}
                      onChange={(e) => setRepProductName(e.target.value)}
                      placeholder="e.g. Shorts - Navy Blue / Denim Jeans"
                      className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded font-medium text-xs text-slate-900 outline-none focus:border-purple-500 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">Size:</label>
                      <input
                        type="text"
                        value={repSize || ""}
                        onChange={(e) => setRepSize(e.target.value)}
                        placeholder="e.g. M, 34, XL"
                        className="w-full py-1.5 px-2 bg-slate-50 border border-slate-300 rounded font-semibold text-xs text-slate-900 outline-none focus:border-purple-500 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">Qty:</label>
                      <input
                        type="number"
                        min={1}
                        value={repQty}
                        onChange={(e) => setRepQty(parseInt(e.target.value) || 1)}
                        className="w-full py-1.5 px-2 bg-slate-50 border border-slate-300 rounded font-bold font-mono text-xs text-slate-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5">Unit Price (₹):</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={repUnitPrice}
                        onChange={(e) => setRepUnitPrice(parseFloat(e.target.value) || 0)}
                        className="w-full py-1.5 px-2 bg-slate-50 border border-slate-300 rounded font-bold font-mono text-xs text-slate-900 outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold text-xs">
                    <span className="text-slate-600">Replacement Total:</span>
                    <span className="font-mono text-purple-700">{formatINR(replacementTotal)}</span>
                  </div>
                </div>

              </div>

              {/* AUTOMATICALLY CALCULATED DIFFERENCE BANNER */}
              <div className="p-3.5 rounded-xl border flex items-center justify-between text-xs bg-white shadow-2xs">
                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block">
                    Calculation: Replacement Total ({formatINR(replacementTotal)}) − Returned Value ({formatINR(activeTotalReturnedValue)})
                  </span>
                  <div className="mt-1">
                    {exchangeDifferenceType === "CUSTOMER_PAYS" && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs">
                        <IndianRupee className="w-4 h-4 text-amber-700" />
                        <span>Customer Pays Extra {formatINR(exchangeDifference)}</span>
                      </div>
                    )}
                    {exchangeDifferenceType === "SHOP_REFUNDS" && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs">
                        <IndianRupee className="w-4 h-4 text-emerald-700" />
                        <span>Shop Refunds Difference {formatINR(Math.abs(exchangeDifference))}</span>
                      </div>
                    )}
                    {exchangeDifferenceType === "NO_DIFFERENCE" && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs">
                        <Check className="w-4 h-4 text-slate-600" />
                        <span>No Difference (₹0)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Net Difference</span>
                  <span className={cn(
                    "text-lg font-mono font-bold",
                    exchangeDifference > 0 ? "text-amber-700" : exchangeDifference < 0 ? "text-emerald-700" : "text-slate-700"
                  )}>
                    {exchangeDifference > 0 ? `+${formatINR(exchangeDifference)}` : formatINR(exchangeDifference)}
                  </span>
                </div>
              </div>

              {/* CAPTURE EXTRA PAYMENT / REFUND DETAILS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Extra Payment/Refund Status:
                  </label>
                  <select
                    value={extraPaymentStatus}
                    onChange={(e) => setExtraPaymentStatus(e.target.value)}
                    className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg font-medium text-xs text-slate-800 outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid / Settled</option>
                    <option value="Refunded">Refunded to Customer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Mode:</label>
                  <select
                    value={exchangePaymentMode}
                    onChange={(e) => setExchangePaymentMode(e.target.value as RefundMethod)}
                    className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg font-medium text-xs text-slate-800 outline-none"
                  >
                    {REFUND_MODES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Transaction / Reference Number:
                  </label>
                  <input
                    type="text"
                    value={exchangeReferenceNo}
                    onChange={(e) => setExchangeReferenceNo(e.target.value)}
                    placeholder="e.g. UPI Ref / Receipt No."
                    className="w-full py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-800 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SECTION 6: REPLACEMENT FULFILLMENT (EXCHANGE ONLY) */}
          {/* ============================================================== */}
          {returnType === "Exchange" && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <span className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center text-[10px] font-bold">6</span>
                <span>Replacement Fulfillment</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Replacement Dispatch Number:
                  </label>
                  <input
                    type="text"
                    value={replacementDispatchNo}
                    onChange={(e) => setReplacementDispatchNo(e.target.value)}
                    placeholder="e.g. DSP-260928-001 or Tracking / LLR No."
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Replacement Status:
                  </label>
                  <select
                    value={replacementStatus}
                    onChange={(e) => setReplacementStatus(e.target.value as ReplacementStatus)}
                    className="w-full py-2 px-2.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-xs text-slate-800 outline-none focus:border-teal-500 focus:bg-white"
                  >
                    {REPLACEMENT_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SECTION 7: RETURN REASON & NOTES */}
          {/* ============================================================== */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-2xs">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center text-[10px] font-bold">7</span>
              <span>Return Reason & Staff Notes</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Return Reason:</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value as ReturnReason)}
                  className="w-full py-2 px-2.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-xs text-slate-800 outline-none focus:border-orange-500 focus:bg-white"
                >
                  {RETURN_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Notes / Remarks:</label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Enter reason details or customer comments..."
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:border-orange-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* SECTION 8: RETURN DATE/TIME (AUTOMATIC, NO BACKDATING) */}
          {/* ============================================================== */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center text-[10px] font-bold">8</div>
              <div>
                <span className="font-bold text-slate-800 block">Creation Date & Time</span>
                <span className="text-[11px] text-slate-500">
                  Exact timestamp recorded automatically upon submit. Backdating is not permitted.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-mono text-xs font-semibold shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-orange-600" />
              <span>Current Timestamp</span>
            </div>
          </div>

        </form>

        {/* Footer Buttons */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSubmitting || activeTotalReturnedQty <= 0 || (orderMode === "SEARCH" && !selectedOrder) || (orderMode === "MANUAL" && !manualOrderId.trim())}
            onClick={handleSubmit}
            className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isSubmitting 
                ? "Creating Return..." 
                : selectedOrder 
                ? `Confirm Return (${formatINR(activeTotalReturnedValue)})` 
                : "Add Return"}
            </span>
          </button>
        </div>

      </aside>
    </>
  );
}
