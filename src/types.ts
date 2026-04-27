export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export type OrderStatus = 'pending' | 'paid' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  available: boolean;
  costPrice?: number;
  stockQuantity?: number;
  minStockAlert?: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: any;
  updatedAt?: any;
  attributes?: {
    temperature?: 'gelada' | 'natural';
    size?: 'pequeno' | 'medio' | 'grande';
  };
}

export interface AuditLog {
  id: string;
  action: 'create' | 'update' | 'delete';
  entityType: 'menu' | 'categories' | 'tables' | 'promotions' | 'coupons' | 'settings' | 'users';
  entityId: string;
  entityName: string;
  userEmail: string;
  userId: string;
  timestamp: any;
  details?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number; // This will be the final price after item-specific promotions
  originalPrice: number; // Price before any promotions
  costPrice?: number; // Historical cost price for profit calculation
  observations?: string;
  attributes?: Record<string, any>;
}

export interface Order {
  id: string;
  orderNumber: number;
  tableId: string;
  userId: string;
  userName?: string;
  attendantId?: string; // ID of the waiter/attendant who made the order
  attendantName?: string; // Name of the waiter/attendant
  items: OrderItem[];
  originalSubtotal?: number; // Sum of original prices
  promotionDiscount?: number; // Total discount from promotions
  subtotal?: number; // Sum of discounted prices (after promotions)
  total: number; // Final total after promotions and coupons
  couponId?: string | null;
  couponCode?: string | null;
  couponDiscount?: number; // Discount from coupon
  status: OrderStatus;
  paymentMethod: 'pix' | 'card';
  paymentStatus: 'pending' | 'paid' | 'failed';
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  isTest?: boolean;
}

export interface Table {
  id: string;
  number: number;
  active: boolean;
  currentUserId?: string;
  currentUserName?: string;
  currentCart?: OrderItem[];
  lastOrderId?: string;
  x?: number;
  y?: number;
  reservedUntil?: any;
  reservedBy?: string;
  reservedByName?: string;
}

export interface ReservationSettings {
  cost: number;
  durationMinutes: number;
  enabled: boolean;
}

export interface Promotion {
  id: string;
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  targetType: 'item' | 'category' | 'all';
  targetId?: string; // MenuItem ID or Category ID
  active: boolean;
  startDate?: any;
  endDate?: any;
  imageUrl?: string;
  createdAt: any;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchase?: number;
  usageLimit?: number;
  usedCount: number;
  active: boolean;
  expiryDate?: any;
  createdAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'staff' | 'client' | 'waiter' | 'root';
  displayName?: string;
  phone?: string;
  cpf?: string;
  address?: string;
  createdAt?: any;
}

export interface BusinessRule {
  id: string;
  title: string;
  description: string;
  status: 'implemented' | 'pending' | 'draft';
  priority: 'low' | 'medium' | 'high';
  category: 'auth' | 'order' | 'payment' | 'table' | 'other';
  testScenario?: string;
  createdAt: any;
  updatedAt: any;
}

export interface UserFlowStep {
  id: string;
  label: string;
  type: 'start' | 'action' | 'decision' | 'end';
  next?: string[];
  position: { x: number; y: number };
}

export interface UserFlow {
  id: string;
  name: string;
  description: string;
  role: UserProfile['role'];
  steps: UserFlowStep[];
  createdAt: any;
  updatedAt: any;
}

export interface SystemAccess {
  client: boolean;
  waiter: boolean;
  staff: boolean;
  admin: boolean;
  root: boolean;
  devLogin?: {
    admin: boolean;
    waiter: boolean;
    staff: boolean;
    root: boolean;
  };
}

export interface SystemError {
  id: string;
  message: string;
  stack?: string;
  userId?: string;
  userEmail?: string;
  role?: string;
  path: string;
  timestamp: any;
  userAgent: string;
  status: 'active' | 'resolved';
  severity: 'error' | 'warning' | 'info';
  metadata?: Record<string, any>;
}
