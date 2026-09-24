export type OrderStatus = "NEW" | "CONFIRMED" | "PACKING" | "PACKED" | "DISPATCHED" | "COMPLETED" | "RETURN";

export type CourierStatus = 
  | "WAITING_FOR_PICKUP" 
  | "PICKED_UP" 
  | "DELIVERED" 
  | "PENDING" 
  | "SHIPPED" 
  | "DISPATCHED";

export type SmsStatus = "SENT" | "PENDING" | "FAILED";

export type OrderSource = "WEBSITE" | "WHATSAPP" | "INSTAGRAM" | "DIRECT";

export type Role = "ADMIN" | "MANAGER" | "ORDER_STAFF" | "PACKING_STAFF" | "DISPATCH_STAFF" | "COURIER" | "SYSTEM";

export type PaymentStatus = "PAID" | "COD" | "PENDING";

export type PendingReason =
  | "Product unavailable"
  | "Stock mismatch"
  | "Customer confirmation pending"
  | "Address issue"
  | "System issue"
  | "Other";

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  totalOrders: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  color?: string;
  size: "XS" | "S" | "M" | "L" | "XL" | "XXL" | "Free Size";
  quantity: number;
  unitPrice: number;
  subtotal: number;
  imageUrl?: string;
}

export interface DispatchInfo {
  courierId?: string;
  courierName?: string;
  courierPartnerId?: string; // e.g. "ST_COURIER" | "PROFESSIONAL" | "DTDC" | "UNASSIGNED"
  dispatchId?: string; // Auto-generated or manual e.g. "DSP-260922-001"
  llrNumber?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  pickupPhone?: string; // Courier pickup person's phone number (separate from customer mobile)
  verifiedCustomerPhone?: string; // Customer phone verified at pickup
  pickedUpBy?: string;
  courierStatus: CourierStatus;
  dispatchedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  shippedAt?: string;
  estimatedDelivery?: string;
  notes?: string;
}

export interface SmsInfo {
  status: SmsStatus;
  provider: string; // "Ping4SMS"
  providerMessageId?: string;
  sentAt?: string;
  sentBy?: string;
  deliveredAt?: string;
  lastCheckedAt?: string;
  responseSnippet?: string;
}

export interface ActivityLog {
  id: string;
  orderId: string;
  timestamp: string;
  user: string;
  role: Role;
  action: string;
  details?: string;
  eventType?: string;
  duration?: string;
  oldValue?: string;
  newValue?: string;
  oldDispatchNo?: string;
  newDispatchNo?: string;
  reason?: string;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. "OF-2026-9021"
  externalOrderId: string; // WooCommerce order ID or WhatsApp Chat Box order ID
  source: OrderSource;
  customer: Customer;
  items: OrderItem[];
  totalAmount: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  dispatch: DispatchInfo;
  sms: SmsInfo;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  packingStartedAt?: string;
  packedAt?: string;
  dispatchedAt?: string;
  pickedUpAt?: string;
  shippedAt?: string;
  completedAt?: string;
  packingStaff?: string;
  orderTakenBy?: string;
  returnStatus?: string;
  linkedReturnId?: string;
  linkedReplacementId?: string;
  notes?: string;
  pendingReason?: string;
  pendingNote?: string;
  pendingAt?: string;
  pendingBy?: string;
  timeline: ActivityLog[];
}

export interface Courier {
  id: string;
  name: string;
  code: string;
  isStCourier: boolean;
  trackingUrlPattern?: string;
  active: boolean;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  online: boolean;
  courierPartnerId?: string; // e.g. "ST_COURIER" | "PROFESSIONAL" | "DTDC"
}

export interface ActionRequiredItem {
  id: string;
  title: string;
  description: string;
  count: number;
  type: 
    | "packing_waiting" 
    | "dispatch_waiting" 
    | "sms_pending" 
    | "sms_failed" 
    | "st_courier_missing_llr"
    | "return_awaiting_receipt"
    | "return_qc_pending"
    | "return_refund_pending"
    | "return_replacement_pending";
  color: "amber" | "purple" | "blue" | "red" | "orange" | "rose" | "emerald";
  href: string;
  queryParam?: Record<string, string>;
}

export interface ReturnMetrics {
  totalReturns: number;
  returnRequested: number;
  awaitingReturn: number;
  receivedQcPending: number;
  refundPending: number;
  replacementPending: number;
  activeReturnsCount: number;
}

export interface DashboardMetrics {
  todayOrders: number;
  newOrders: number;
  confirmedOrders: number;
  packingOrders: number;
  packedOrders: number;
  dispatchedOrders: number;
  smsPending: number;
  smsFailed: number;
  stCourierMissingLlr: number;
  stCourierPendingDelivery: number;
  returnMetrics?: ReturnMetrics;
  actionItems: ActionRequiredItem[];
}

// ==============================================================================
// RETURN MANAGEMENT MODULE TYPES
// ==============================================================================

export type ReturnType = "Refund" | "Replacement" | "Exchange";

export type ReturnReason =
  | "Size Issue"
  | "Color Issue"
  | "Wrong Product"
  | "Damaged Product"
  | "Quality Issue"
  | "Product Not as Expected"
  | "Customer Changed Mind"
  | "Duplicate Order"
  | "Courier Damage"
  | "Missing Item"
  | "Other";

export type ReturnStatus =
  | "Return Requested"
  | "Return Approved"
  | "Awaiting Return"
  | "Return Received"
  | "QC Pending"
  | "QC Approved"
  | "Refund Pending"
  | "Refunded"
  | "Replacement Pending"
  | "Replacement Dispatched"
  | "Exchanged"
  | "Dispatched"
  | "Completed"
  | "Rejected"
  | "Cancelled";

export type RefundStatus =
  | "Not Started"
  | "Pending"
  | "Processing"
  | "Refunded"
  | "Failed";

export type RefundMethod =
  | "UPI"
  | "Bank Transfer"
  | "Cash"
  | "Original Payment Method"
  | "Other";

export type QcCondition = "Good" | "Used" | "Damaged" | "Missing Item" | "Wrong Item";
export type QcResult = "Approved" | "Partially Approved" | "Rejected";
export type InventoryDisposition = "Restock" | "Damaged Stock" | "Hold" | "Other";

export interface ReturnItem {
  id: string;
  orderItemId?: string;
  productName: string;
  sku?: string;
  color?: string;
  size: string;
  purchasedQuantity: number;
  requestedQuantity: number;
  receivedQuantity?: number;
  approvedQuantity?: number;
  unitPrice: number;
  returnAmount: number;
}

export interface ReturnQc {
  id: string;
  condition: QcCondition;
  qcResult: QcResult;
  inventoryDisposition: InventoryDisposition;
  qcNotes?: string;
  checkedBy: string;
  checkedAt: string;
}

export interface ReturnRefund {
  id: string;
  refundStatus: RefundStatus;
  refundAmount: number;
  refundMethod?: RefundMethod;
  utrReference?: string;
  refundNotes?: string;
  processedBy?: string;
  refundDate?: string;
}

export interface ReturnReplacement {
  id: string;
  replacementId: string; // e.g. REP-260923-001
  originalOrderId: string;
  originalOrderNumber: string;
  originalItemName: string;
  returnedItem: string;
  replacementItem: string;
  color?: string;
  size: string;
  quantity: number;
  status: "Waiting for Packing" | "Packing" | "Packed" | "Dispatched" | "Delivered";
  dispatchId?: string; // e.g. DSP-260923-021
  courier?: string;
  llr?: string;
  tracking?: string;
  dispatchedAt?: string;
}

export interface ReturnTimelineEvent {
  id: string;
  returnId: string;
  action: string;
  user: string;
  role: Role;
  notes?: string;
  timestamp: string;
}

export interface ReturnCase {
  id: string;
  returnId: string; // RTN-YYMMDD-001
  orderId: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  returnType: ReturnType;
  reason: ReturnReason;
  customerNote?: string;
  status: ReturnStatus;
  requestedQuantity: number;
  receivedQuantity: number;
  approvedQuantity: number;
  expectedAmount: number;
  refundAmount: number;
  discountAdjustment: number;
  shippingAdjustment: number;
  items: ReturnItem[];
  qc?: ReturnQc;
  refund?: ReturnRefund;
  replacement?: ReturnReplacement;
  returnDate?: string;
  receivedAt?: string;
  receivedBy?: string;
  receivingNote?: string;
  timeline: ReturnTimelineEvent[];
  dispatchNumber?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
