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
  dispatchId?: string; // Auto-generated e.g. "DSP-260922-001"
  llrNumber?: string;
  pickupPhone?: string; // Courier pickup person's phone number (separate from customer mobile)
  courierStatus: CourierStatus;
  dispatchedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  estimatedDelivery?: string;
  notes?: string;
}

export interface SmsInfo {
  status: SmsStatus;
  provider: string; // "Ping4SMS"
  providerMessageId?: string;
  sentAt?: string;
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
  oldValue?: string;
  newValue?: string;
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
  packingStaff?: string;
  orderTakenBy?: string;
  returnStatus?: string;
  notes?: string;
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
  type: "packing_waiting" | "dispatch_waiting" | "sms_pending" | "sms_failed" | "st_courier_missing_llr";
  color: "amber" | "purple" | "blue" | "red" | "orange";
  href: string;
  queryParam?: Record<string, string>;
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
  actionItems: ActionRequiredItem[];
}
