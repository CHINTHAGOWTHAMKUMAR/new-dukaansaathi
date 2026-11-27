export type Language = 'en' | 'hi' | 'te';

export type PaymentMode = 'cash' | 'upi' | 'udhar' | 'mixed';

export type ExpensePaymentMode = 'cash' | 'upi' | 'bank';

export type ActiveTab =
  | 'dashboard'
  | 'sales'
  | 'inventory'
  | 'udhar'
  | 'customers'
  | 'expenses'
  | 'reports'
  | 'settings';

export interface ShopProfile {
  id: string;
  code: string;
  name: string;
  ownerName: string;
  phone: string;
  address: string;
  city: string;
  shopType: string;
  currency: string;
  isPublic: boolean;
  hasPin: boolean;
  lowStockDefault: number;
  categories: string[];
  expenseCategories: string[];
  voiceReadbackEnabled: boolean;
  aiModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  localNames?: {
    hi?: string;
    te?: string;
  };
  category: string;
  unit: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  sku?: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  address?: string;
  udharBalance: number;
  lastActivityAt: string;
  reminderNote?: string;
  updatedAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  shopId: string;
  invoiceNumber: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMode: PaymentMode;
  paidAmount: number;
  creditAmount: number;
  customerId?: string;
  customerName?: string;
  notes?: string;
  source: 'voice' | 'manual';
  transcript?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
}

export interface UdharEntry {
  id: string;
  shopId: string;
  customerId: string;
  customerName: string;
  type: 'credit' | 'repayment';
  amount: number;
  balanceAfter: number;
  note?: string;
  linkedSaleId?: string;
  source: 'voice' | 'manual';
  idempotencyKey?: string;
  createdAt: string;
  synced?: boolean;
}

export interface Expense {
  id: string;
  shopId: string;
  title: string;
  category: string;
  amount: number;
  paymentMode: ExpensePaymentMode;
  note?: string;
  source: 'voice' | 'manual';
  idempotencyKey?: string;
  createdAt: string;
  synced?: boolean;
}

export interface AIInsightReport {
  id: string;
  shopId: string;
  language: Language;
  summary: string;
  restockingAlerts: {
    productName: string;
    currentStock: number;
    minStock: number;
    suggestion: string;
  }[];
  salesTrends: string[];
  creditAlerts: string[];
  generatedAt: string;
}

export interface ShopSnapshot {
  shop: ShopProfile;
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  udharEntries: UdharEntry[];
  expenses: Expense[];
  lastSyncedAt: string;
}

export type SyncEntityType = 'sale' | 'udhar' | 'product' | 'customer' | 'expense' | 'settings';

export type SyncActionType = 'create' | 'update' | 'delete';

export interface SyncOperation {
  opId: string;
  idempotencyKey: string;
  shopId: string;
  entityType: SyncEntityType;
  action: SyncActionType;
  payload: Record<string, unknown>;
  clientTimestamp: string;
  forceDuplicate?: boolean;
  status?: 'pending' | 'syncing' | 'failed';
  error?: string;
}

export type VoiceIntentType =
  | 'RECORD_SALE'
  | 'RECORD_CREDIT'
  | 'RECORD_REPAYMENT'
  | 'RECORD_EXPENSE'
  | 'QUERY_SALES'
  | 'QUERY_LOW_STOCK'
  | 'QUERY_CUSTOMER_BALANCE'
  | 'GENERATE_REPORT'
  | 'ADD_PRODUCT'
  | 'UPDATE_STOCK'
  | 'CONFIRM_YES'
  | 'CONFIRM_NO'
  | 'CLARIFY'
  | 'UNKNOWN';

export interface VoiceExtractedEntities {
  productId?: string;
  productName?: string;
  quantity?: number;
  unit?: string;
  amount?: number;
  unitPrice?: number;
  customerId?: string;
  customerName?: string;
  paymentMode?: PaymentMode;
  category?: string;
  title?: string;
  note?: string;
  reportPeriod?: 'daily' | 'weekly' | 'monthly';
}

export interface VoiceIntentResult {
  intent: VoiceIntentType;
  confidence: number;
  needsConfirmation: boolean;
  replyText: string;
  confirmationPrompt?: string;
  missingFields: string[];
  unknownProducts: string[];
  unknownCustomers: string[];
  extracted: VoiceExtractedEntities;
  queryAnswer?: {
    title: string;
    metrics?: { label: string; value: string }[];
    items?: string[];
  };
  offlineParsed?: boolean;
}
