import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  Customer,
  Expense,
  Product,
  Sale,
  SaleItem,
  ShopProfile,
  ShopSnapshot,
  SyncOperation,
  UdharEntry,
} from '../types.ts';

interface StoredShopRecord {
  profile: ShopProfile;
  pinHash?: string;
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  udharEntries: UdharEntry[];
  expenses: Expense[];
  appliedKeys: string[];
}

interface DatabaseSchema {
  shops: Record<string, StoredShopRecord>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'dukaansaathi-db.json');

const TOKEN_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function isoOffset(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
}

function createDemoShopRecord(): StoredShopRecord {
  const now = new Date().toISOString();
  const shopId = 'demo-kirana';

  const profile: ShopProfile = {
    id: shopId,
    code: 'DEMO-KIRANA',
    name: 'Sri Lakshmi Kirana & General Store',
    ownerName: 'Venkatesh Rao',
    phone: '+91 98480 12345',
    address: '14-2 Main Bazaar Road, Hanamkonda',
    city: 'Warangal, Telangana',
    shopType: 'Kirana & Grocery',
    currency: 'INR',
    isPublic: true,
    hasPin: false,
    lowStockDefault: 8,
    categories: ['Grains & Pulses', 'Oils & Ghee', 'Dairy & Bakery', 'Snacks & Beverages', 'Personal Care', 'Vegetables', 'Household'],
    expenseCategories: ['Electricity', 'Shop Rent', 'Wholesale Restock', 'Transport', 'Staff & Tea', 'Packaging', 'Maintenance', 'Other'],
    voiceReadbackEnabled: true,
    aiModel: 'gemini-4-hydrogen',
    createdAt: isoOffset(720),
    updatedAt: now,
  };

  const products: Product[] = [
    {
      id: 'prod-rice',
      shopId,
      name: 'Sona Masoori Rice',
      localNames: { hi: 'चावल (सोना मसूरी)', te: 'బియ్యం (సోనా మసూరి)' },
      category: 'Grains & Pulses',
      unit: 'kg',
      price: 52,
      costPrice: 44,
      stock: 48,
      minStock: 15,
      sku: 'GRN-001',
      updatedAt: isoOffset(12),
    },
    {
      id: 'prod-toordal',
      shopId,
      name: 'Toor Dal',
      localNames: { hi: 'तूर दाल', te: 'కందిపప్పు' },
      category: 'Grains & Pulses',
      unit: 'kg',
      price: 155,
      costPrice: 136,
      stock: 6,
      minStock: 10,
      sku: 'GRN-002',
      updatedAt: isoOffset(8),
    },
    {
      id: 'prod-sugar',
      shopId,
      name: 'Refined Sugar',
      localNames: { hi: 'चीनी / शक्कर', te: 'చక్కెర / పంచదార' },
      category: 'Grains & Pulses',
      unit: 'kg',
      price: 46,
      costPrice: 40,
      stock: 22,
      minStock: 10,
      sku: 'GRN-003',
      updatedAt: isoOffset(15),
    },
    {
      id: 'prod-oil',
      shopId,
      name: 'Sunflower Cooking Oil',
      localNames: { hi: 'सूरजमुखी तेल', te: 'వంట నూనె' },
      category: 'Oils & Ghee',
      unit: 'litre',
      price: 145,
      costPrice: 128,
      stock: 5,
      minStock: 8,
      sku: 'OIL-001',
      updatedAt: isoOffset(5),
    },
    {
      id: 'prod-atta',
      shopId,
      name: 'Wheat Flour (Atta)',
      localNames: { hi: 'गेहूँ का आटा', te: 'గోధుమ పిండి' },
      category: 'Grains & Pulses',
      unit: 'kg',
      price: 42,
      costPrice: 35,
      stock: 30,
      minStock: 10,
      sku: 'GRN-004',
      updatedAt: isoOffset(20),
    },
    {
      id: 'prod-milk',
      shopId,
      name: 'Fresh Milk Packet (500ml)',
      localNames: { hi: 'दूध पैकेट', te: 'పాలు ప్యాకెట్' },
      category: 'Dairy & Bakery',
      unit: 'pkt',
      price: 30,
      costPrice: 27,
      stock: 4,
      minStock: 12,
      sku: 'DRY-001',
      updatedAt: isoOffset(2),
    },
    {
      id: 'prod-tea',
      shopId,
      name: 'Red Label Tea (250g)',
      localNames: { hi: 'चाय पत्ती', te: 'టీ పొడి' },
      category: 'Snacks & Beverages',
      unit: 'pkt',
      price: 135,
      costPrice: 118,
      stock: 14,
      minStock: 6,
      sku: 'BEV-001',
      updatedAt: isoOffset(24),
    },
    {
      id: 'prod-parle',
      shopId,
      name: 'Parle-G Biscuit Pack',
      localNames: { hi: 'बिस्कुट', te: 'బిస్కెట్ ప్యాకెట్' },
      category: 'Snacks & Beverages',
      unit: 'pkt',
      price: 10,
      costPrice: 8.5,
      stock: 64,
      minStock: 20,
      sku: 'SNK-001',
      updatedAt: isoOffset(18),
    },
    {
      id: 'prod-soap',
      shopId,
      name: 'Dettol Bath Soap',
      localNames: { hi: 'साबुन', te: 'సబ్బు' },
      category: 'Personal Care',
      unit: 'pcs',
      price: 38,
      costPrice: 32,
      stock: 19,
      minStock: 10,
      sku: 'PRC-001',
      updatedAt: isoOffset(30),
    },
    {
      id: 'prod-onion',
      shopId,
      name: 'Onions',
      localNames: { hi: 'प्याज', te: 'ఉల్లిపాయలు' },
      category: 'Vegetables',
      unit: 'kg',
      price: 36,
      costPrice: 28,
      stock: 7,
      minStock: 10,
      sku: 'VEG-001',
      updatedAt: isoOffset(3),
    },
    {
      id: 'prod-tomato',
      shopId,
      name: 'Tomatoes',
      localNames: { hi: 'टमाटर', te: 'టమాటా' },
      category: 'Vegetables',
      unit: 'kg',
      price: 40,
      costPrice: 30,
      stock: 12,
      minStock: 8,
      sku: 'VEG-002',
      updatedAt: isoOffset(4),
    },
    {
      id: 'prod-detergent',
      shopId,
      name: 'Surf Excel Powder (500g)',
      localNames: { hi: 'डिटर्जेंट पाउडर', te: 'సర్ఫ్ పొడి' },
      category: 'Household',
      unit: 'pkt',
      price: 72,
      costPrice: 61,
      stock: 11,
      minStock: 6,
      sku: 'HHD-001',
      updatedAt: isoOffset(36),
    },
  ];

  const customers: Customer[] = [
    {
      id: 'cust-ravi',
      shopId,
      name: 'Ravi Kumar',
      phone: '98491 22011',
      address: 'Gandhi Nagar, Lane 3',
      udharBalance: 500,
      lastActivityAt: isoOffset(5),
      reminderNote: 'Monthly grocery account',
      updatedAt: isoOffset(5),
    },
    {
      id: 'cust-lakshmi',
      shopId,
      name: 'Lakshmi Devi',
      phone: '99890 44120',
      address: 'Subedari Colony',
      udharBalance: 1250,
      lastActivityAt: isoOffset(26),
      reminderNote: 'Promises settlement on 1st',
      updatedAt: isoOffset(26),
    },
    {
      id: 'cust-suresh',
      shopId,
      name: 'Suresh Patel',
      phone: '97012 88340',
      address: 'Near Bus Stand',
      udharBalance: 320,
      lastActivityAt: isoOffset(52),
      updatedAt: isoOffset(52),
    },
    {
      id: 'cust-ramesh',
      shopId,
      name: 'Ramesh Reddy',
      phone: '94401 55678',
      address: 'Vidyaranyapuri',
      udharBalance: 850,
      lastActivityAt: isoOffset(74),
      updatedAt: isoOffset(74),
    },
    {
      id: 'cust-anitha',
      shopId,
      name: 'Anitha Sharma',
      phone: '98662 11904',
      address: 'Kakatiya Colony',
      udharBalance: 0,
      lastActivityAt: isoOffset(16),
      updatedAt: isoOffset(16),
    },
  ];

  const sales: Sale[] = [
    {
      id: 'sale-demo-1',
      shopId,
      invoiceNumber: 'INV-1041',
      items: [
        { productId: 'prod-rice', productName: 'Sona Masoori Rice', quantity: 5, unit: 'kg', unitPrice: 52, lineTotal: 260 },
        { productId: 'prod-toordal', productName: 'Toor Dal', quantity: 1, unit: 'kg', unitPrice: 155, lineTotal: 155 },
      ],
      totalAmount: 415,
      paymentMode: 'upi',
      paidAmount: 415,
      creditAmount: 0,
      customerId: 'cust-anitha',
      customerName: 'Anitha Sharma',
      source: 'manual',
      createdAt: isoOffset(1.5),
      updatedAt: isoOffset(1.5),
      synced: true,
    },
    {
      id: 'sale-demo-2',
      shopId,
      invoiceNumber: 'INV-1042',
      items: [
        { productId: 'prod-milk', productName: 'Fresh Milk Packet (500ml)', quantity: 4, unit: 'pkt', unitPrice: 30, lineTotal: 120 },
        { productId: 'prod-parle', productName: 'Parle-G Biscuit Pack', quantity: 3, unit: 'pkt', unitPrice: 10, lineTotal: 30 },
      ],
      totalAmount: 150,
      paymentMode: 'cash',
      paidAmount: 150,
      creditAmount: 0,
      source: 'voice',
      transcript: '4 milk packet aur 3 parle biscuit cash 150',
      createdAt: isoOffset(3),
      updatedAt: isoOffset(3),
      synced: true,
    },
    {
      id: 'sale-demo-3',
      shopId,
      invoiceNumber: 'INV-1043',
      items: [
        { productId: 'prod-oil', productName: 'Sunflower Cooking Oil', quantity: 2, unit: 'litre', unitPrice: 145, lineTotal: 290 },
        { productId: 'prod-sugar', productName: 'Refined Sugar', quantity: 2, unit: 'kg', unitPrice: 46, lineTotal: 92 },
      ],
      totalAmount: 382,
      paymentMode: 'cash',
      paidAmount: 382,
      creditAmount: 0,
      source: 'manual',
      createdAt: isoOffset(4.5),
      updatedAt: isoOffset(4.5),
      synced: true,
    },
    {
      id: 'sale-demo-4',
      shopId,
      invoiceNumber: 'INV-1044',
      items: [
        { productId: 'prod-rice', productName: 'Sona Masoori Rice', quantity: 6, unit: 'kg', unitPrice: 52, lineTotal: 312 },
        { productId: 'prod-tea', productName: 'Red Label Tea (250g)', quantity: 1, unit: 'pkt', unitPrice: 135, lineTotal: 135 },
      ],
      totalAmount: 447,
      paymentMode: 'udhar',
      paidAmount: 0,
      creditAmount: 447,
      customerId: 'cust-ravi',
      customerName: 'Ravi Kumar',
      source: 'manual',
      createdAt: isoOffset(5),
      updatedAt: isoOffset(5),
      synced: true,
    },
    {
      id: 'sale-demo-5',
      shopId,
      invoiceNumber: 'INV-1038',
      items: [
        { productId: 'prod-atta', productName: 'Wheat Flour (Atta)', quantity: 10, unit: 'kg', unitPrice: 42, lineTotal: 420 },
        { productId: 'prod-soap', productName: 'Dettol Bath Soap', quantity: 4, unit: 'pcs', unitPrice: 38, lineTotal: 152 },
      ],
      totalAmount: 572,
      paymentMode: 'upi',
      paidAmount: 572,
      creditAmount: 0,
      source: 'manual',
      createdAt: isoOffset(28),
      updatedAt: isoOffset(28),
      synced: true,
    },
    {
      id: 'sale-demo-6',
      shopId,
      invoiceNumber: 'INV-1035',
      items: [
        { productId: 'prod-rice', productName: 'Sona Masoori Rice', quantity: 15, unit: 'kg', unitPrice: 52, lineTotal: 780 },
        { productId: 'prod-toordal', productName: 'Toor Dal', quantity: 3, unit: 'kg', unitPrice: 155, lineTotal: 465 },
      ],
      totalAmount: 1245,
      paymentMode: 'cash',
      paidAmount: 1245,
      creditAmount: 0,
      source: 'manual',
      createdAt: isoOffset(54),
      updatedAt: isoOffset(54),
      synced: true,
    },
    {
      id: 'sale-demo-7',
      shopId,
      invoiceNumber: 'INV-1029',
      items: [
        { productId: 'prod-oil', productName: 'Sunflower Cooking Oil', quantity: 5, unit: 'litre', unitPrice: 145, lineTotal: 725 },
        { productId: 'prod-detergent', productName: 'Surf Excel Powder (500g)', quantity: 4, unit: 'pkt', unitPrice: 72, lineTotal: 288 },
      ],
      totalAmount: 1013,
      paymentMode: 'upi',
      paidAmount: 1013,
      creditAmount: 0,
      source: 'manual',
      createdAt: isoOffset(120),
      updatedAt: isoOffset(120),
      synced: true,
    },
  ];

  const udharEntries: UdharEntry[] = [
    {
      id: 'udh-1',
      shopId,
      customerId: 'cust-ravi',
      customerName: 'Ravi Kumar',
      type: 'credit',
      amount: 500,
      balanceAfter: 500,
      note: 'Monthly ration items on credit',
      linkedSaleId: 'sale-demo-4',
      source: 'manual',
      createdAt: isoOffset(5),
      synced: true,
    },
    {
      id: 'udh-2',
      shopId,
      customerId: 'cust-lakshmi',
      customerName: 'Lakshmi Devi',
      type: 'credit',
      amount: 1650,
      balanceAfter: 1650,
      note: 'Festival grocery order',
      source: 'manual',
      createdAt: isoOffset(96),
      synced: true,
    },
    {
      id: 'udh-3',
      shopId,
      customerId: 'cust-lakshmi',
      customerName: 'Lakshmi Devi',
      type: 'repayment',
      amount: 400,
      balanceAfter: 1250,
      note: 'Partial UPI repayment',
      source: 'manual',
      createdAt: isoOffset(26),
      synced: true,
    },
    {
      id: 'udh-4',
      shopId,
      customerId: 'cust-suresh',
      customerName: 'Suresh Patel',
      type: 'credit',
      amount: 320,
      balanceAfter: 320,
      note: 'Oil and biscuits',
      source: 'manual',
      createdAt: isoOffset(52),
      synced: true,
    },
    {
      id: 'udh-5',
      shopId,
      customerId: 'cust-ramesh',
      customerName: 'Ramesh Reddy',
      type: 'credit',
      amount: 850,
      balanceAfter: 850,
      note: 'Rice bag & dal credit',
      source: 'manual',
      createdAt: isoOffset(74),
      synced: true,
    },
  ];

  const expenses: Expense[] = [
    {
      id: 'exp-1',
      shopId,
      title: 'Shop Electricity Bill',
      category: 'Electricity',
      amount: 480,
      paymentMode: 'upi',
      note: 'Monthly meter reading',
      source: 'manual',
      createdAt: isoOffset(6),
      synced: true,
    },
    {
      id: 'exp-2',
      shopId,
      title: 'Auto Transport for Mandi Stock',
      category: 'Transport',
      amount: 180,
      paymentMode: 'cash',
      note: 'Rice & onion delivery',
      source: 'manual',
      createdAt: isoOffset(2),
      synced: true,
    },
    {
      id: 'exp-3',
      shopId,
      title: 'Carry Bags & Packing Paper',
      category: 'Packaging',
      amount: 240,
      paymentMode: 'cash',
      source: 'manual',
      createdAt: isoOffset(48),
      synced: true,
    },
    {
      id: 'exp-4',
      shopId,
      title: 'Shop Monthly Rent',
      category: 'Shop Rent',
      amount: 4500,
      paymentMode: 'bank',
      note: 'Paid to landlord',
      source: 'manual',
      createdAt: isoOffset(180),
      synced: true,
    },
  ];

  return {
    profile,
    products,
    customers,
    sales,
    udharEntries,
    expenses,
    appliedKeys: [],
  };
}

class PersistentShopStore {
  private db: DatabaseSchema = { shops: {} };
  private writeLock: Promise<void> = Promise.resolve();

  constructor() {
    this.load();
  }

  private load() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        if (parsed && typeof parsed.shops === 'object') {
          this.db = parsed;
        }
      } catch {
        this.db = { shops: {} };
      }
    }
    if (!this.db.shops['demo-kirana']) {
      this.db.shops['demo-kirana'] = createDemoShopRecord();
      this.persistSync();
    }
  }

  private persistSync() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpFile = `${DB_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(this.db, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  private async withWriteLock<T>(fn: () => T): Promise<T> {
    let release!: () => void;
    const prev = this.writeLock;
    this.writeLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      const result = fn();
      this.persistSync();
      return result;
    } finally {
      release();
    }
  }

  public hashPin(pin: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(pin, salt, 64).toString('hex');
    return `${salt}:${derived}`;
  }

  public verifyPin(pin: string, storedHash: string): boolean {
    const [salt, hashHex] = storedHash.split(':');
    if (!salt || !hashHex) return false;
    const derived = crypto.scryptSync(pin, salt, 64);
    const stored = Buffer.from(hashHex, 'hex');
    if (derived.length !== stored.length) return false;
    return crypto.timingSafeEqual(derived, stored);
  }

  public signShopToken(shopId: string): string {
    const payload = Buffer.from(
      JSON.stringify({ shopId, iat: Date.now() }),
      'utf8'
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }

  public verifyShopToken(token: string, expectedShopId: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payload, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { shopId?: string };
      return decoded.shopId === expectedShopId;
    } catch {
      return false;
    }
  }

  public getShopRecord(shopId: string): StoredShopRecord | undefined {
    return this.db.shops[shopId];
  }

  public findShopByCode(code: string): StoredShopRecord | undefined {
    const normalized = code.trim().toUpperCase();
    return Object.values(this.db.shops).find((s) => s.profile.code.toUpperCase() === normalized);
  }

  public getSnapshot(shopId: string): ShopSnapshot | null {
    const record = this.db.shops[shopId];
    if (!record) return null;
    return {
      shop: record.profile,
      products: record.products,
      customers: record.customers,
      sales: record.sales,
      udharEntries: record.udharEntries,
      expenses: record.expenses,
      lastSyncedAt: new Date().toISOString(),
    };
  }

  public async createShop(input: {
    name: string;
    ownerName: string;
    phone?: string;
    city?: string;
    shopType?: string;
    pin?: string;
    isPublic?: boolean;
  }): Promise<{ snapshot: ShopSnapshot; token?: string }> {
    return this.withWriteLock(() => {
      const cleanName = input.name.trim().slice(0, 80);
      const id = `shop-${crypto.randomBytes(4).toString('hex')}`;
      const prefix = cleanName
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 5)
        .toUpperCase() || 'SHOP';
      const code = `${prefix}-${crypto.randomInt(100, 999)}`;
      const now = new Date().toISOString();
      const hasPin = Boolean(input.pin && input.pin.trim().length >= 4);

      const profile: ShopProfile = {
        id,
        code,
        name: cleanName,
        ownerName: (input.ownerName || 'Shopkeeper').trim().slice(0, 60),
        phone: (input.phone || '').trim().slice(0, 20),
        address: '',
        city: (input.city || 'India').trim().slice(0, 60),
        shopType: (input.shopType || 'Kirana & General Store').trim().slice(0, 40),
        currency: 'INR',
        isPublic: hasPin ? Boolean(input.isPublic) : true,
        hasPin,
        lowStockDefault: 8,
        categories: ['Grains & Pulses', 'Oils & Ghee', 'Dairy & Bakery', 'Snacks & Beverages', 'Personal Care', 'Vegetables', 'Household'],
        expenseCategories: ['Electricity', 'Shop Rent', 'Wholesale Restock', 'Transport', 'Staff & Tea', 'Packaging', 'Maintenance', 'Other'],
        voiceReadbackEnabled: true,
        aiModel: 'gemini-4-hydrogen',
        createdAt: now,
        updatedAt: now,
      };

      this.db.shops[id] = {
        profile,
        pinHash: hasPin && input.pin ? this.hashPin(input.pin.trim()) : undefined,
        products: [],
        customers: [],
        sales: [],
        udharEntries: [],
        expenses: [],
        appliedKeys: [],
      };

      const snapshot = this.getSnapshot(id)!;
      const token = hasPin ? this.signShopToken(id) : undefined;
      return { snapshot, token };
    });
  }

  public async resetDemoShop(): Promise<ShopSnapshot> {
    return this.withWriteLock(() => {
      this.db.shops['demo-kirana'] = createDemoShopRecord();
      return this.getSnapshot('demo-kirana')!;
    });
  }

  public async applySyncOperations(
    shopId: string,
    operations: SyncOperation[]
  ): Promise<{
    appliedOpIds: string[];
    skippedDuplicates: { opId: string; reason: string }[];
    warnings: string[];
    snapshot: ShopSnapshot;
  }> {
    return this.withWriteLock(() => {
      const record = this.db.shops[shopId];
      if (!record) {
        throw new Error('Shop not found');
      }

      const appliedOpIds: string[] = [];
      const skippedDuplicates: { opId: string; reason: string }[] = [];
      const warnings: string[] = [];

      const sortedOps = [...operations].sort((a, b) =>
        a.clientTimestamp.localeCompare(b.clientTimestamp)
      );

      for (const op of sortedOps) {
        if (!op || !op.opId || !op.idempotencyKey) continue;

        if (record.appliedKeys.includes(op.idempotencyKey)) {
          appliedOpIds.push(op.opId);
          continue;
        }

        const p = op.payload || {};

        if (op.entityType === 'sale' && op.action === 'create') {
          const rawItems = Array.isArray(p.items) ? (p.items as SaleItem[]) : [];
          if (rawItems.length === 0) {
            warnings.push(`Ignored empty sale ${op.opId}`);
            appliedOpIds.push(op.opId);
            continue;
          }

          // Server-side independent validation & recalculation
          const validatedItems: SaleItem[] = rawItems.map((it) => {
            const qty = Math.max(0.01, Number(it.quantity) || 0);
            const unitPrice = Math.max(0, Number(it.unitPrice) || 0);
            const lineTotal = Math.round(qty * unitPrice * 100) / 100;
            return {
              productId: String(it.productId || 'custom'),
              productName: String(it.productName || 'Item').slice(0, 80),
              quantity: qty,
              unit: String(it.unit || 'pcs').slice(0, 20),
              unitPrice,
              lineTotal,
            };
          });

          const totalAmount =
            Math.round(validatedItems.reduce((acc, item) => acc + item.lineTotal, 0) * 100) / 100;

          if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
            warnings.push(`Invalid sale total for ${op.opId}`);
            appliedOpIds.push(op.opId);
            continue;
          }

          // Duplicate sale guard (90s window unless forceDuplicate)
          if (!op.forceDuplicate) {
            const firstItemName = validatedItems[0]?.productName?.toLowerCase() || '';
            const recentDup = record.sales.find((s) => {
              const dt = Math.abs(
                new Date(op.clientTimestamp).getTime() - new Date(s.createdAt).getTime()
              );
              const sameTotal = Math.abs(s.totalAmount - totalAmount) < 0.01;
              const sameProduct =
                (s.items[0]?.productName?.toLowerCase() || '') === firstItemName;
              return dt < 90_000 && sameTotal && sameProduct;
            });
            if (recentDup) {
              skippedDuplicates.push({
                opId: op.opId,
                reason: `Duplicate sale detected (${recentDup.invoiceNumber} · ₹${totalAmount})`,
              });
              record.appliedKeys.push(op.idempotencyKey);
              continue;
            }
          }

          const paymentMode = (['cash', 'upi', 'udhar', 'mixed'].includes(String(p.paymentMode))
            ? String(p.paymentMode)
            : 'cash') as Sale['paymentMode'];

          let paidAmount = totalAmount;
          let creditAmount = 0;
          if (paymentMode === 'udhar') {
            paidAmount = 0;
            creditAmount = totalAmount;
          } else if (paymentMode === 'mixed') {
            const reqPaid = Math.min(totalAmount, Math.max(0, Number(p.paidAmount) || 0));
            paidAmount = Math.round(reqPaid * 100) / 100;
            creditAmount = Math.round((totalAmount - paidAmount) * 100) / 100;
          }

          // Deduct stock safely
          for (const item of validatedItems) {
            const prod = record.products.find(
              (pr) =>
                pr.id === item.productId ||
                pr.name.toLowerCase() === item.productName.toLowerCase()
            );
            if (prod) {
              prod.stock = Math.max(0, Math.round((prod.stock - item.quantity) * 100) / 100);
              prod.updatedAt = op.clientTimestamp;
            }
          }

          const saleId = String(p.id || `sale-${crypto.randomBytes(4).toString('hex')}`);
          const invoiceNumber =
            String(p.invoiceNumber || '') ||
            `INV-${1045 + record.sales.length}`;

          const customerId = p.customerId ? String(p.customerId) : undefined;
          const customerName = p.customerName ? String(p.customerName).slice(0, 60) : undefined;

          const newSale: Sale = {
            id: saleId,
            shopId,
            invoiceNumber,
            items: validatedItems,
            totalAmount,
            paymentMode,
            paidAmount,
            creditAmount,
            customerId,
            customerName,
            notes: p.notes ? String(p.notes).slice(0, 200) : undefined,
            source: p.source === 'voice' ? 'voice' : 'manual',
            transcript: p.transcript ? String(p.transcript).slice(0, 300) : undefined,
            idempotencyKey: op.idempotencyKey,
            createdAt: String(p.createdAt || op.clientTimestamp),
            updatedAt: new Date().toISOString(),
            synced: true,
          };

          if (!record.sales.some((s) => s.id === newSale.id)) {
            record.sales.unshift(newSale);
          }

          // If sale has credit, automatically update customer Udhar ledger
          if (creditAmount > 0 && customerId) {
            const cust = record.customers.find((c) => c.id === customerId);
            if (cust) {
              cust.udharBalance = Math.round((cust.udharBalance + creditAmount) * 100) / 100;
              cust.lastActivityAt = newSale.createdAt;
              cust.updatedAt = new Date().toISOString();
              record.udharEntries.unshift({
                id: `udh-${crypto.randomBytes(4).toString('hex')}`,
                shopId,
                customerId: cust.id,
                customerName: cust.name,
                type: 'credit',
                amount: creditAmount,
                balanceAfter: cust.udharBalance,
                note: `Invoice ${invoiceNumber}`,
                linkedSaleId: newSale.id,
                source: newSale.source,
                idempotencyKey: `${op.idempotencyKey}-udhar`,
                createdAt: newSale.createdAt,
                synced: true,
              });
            }
          }
        } else if (op.entityType === 'sale' && op.action === 'delete') {
          const saleId = String(p.id || '');
          record.sales = record.sales.filter((s) => s.id !== saleId);
        } else if (op.entityType === 'product' && (op.action === 'create' || op.action === 'update')) {
          const prodId = String(p.id || `prod-${crypto.randomBytes(4).toString('hex')}`);
          const existingIdx = record.products.findIndex((pr) => pr.id === prodId);
          const nextProd: Product = {
            id: prodId,
            shopId,
            name: String(p.name || 'Unnamed Product').trim().slice(0, 80),
            localNames: (p.localNames as Product['localNames']) || undefined,
            category: String(p.category || 'Grains & Pulses').slice(0, 40),
            unit: String(p.unit || 'kg').slice(0, 20),
            price: Math.max(0, Number(p.price) || 0),
            costPrice: Math.max(0, Number(p.costPrice) || 0),
            stock: Math.max(0, Math.round((Number(p.stock) || 0) * 100) / 100),
            minStock: Math.max(0, Number(p.minStock) || record.profile.lowStockDefault),
            sku: p.sku ? String(p.sku).slice(0, 30) : undefined,
            updatedAt: op.clientTimestamp,
          };
          if (existingIdx >= 0) {
            record.products[existingIdx] = nextProd;
          } else {
            record.products.push(nextProd);
          }
        } else if (op.entityType === 'product' && op.action === 'delete') {
          const prodId = String(p.id || '');
          record.products = record.products.filter((pr) => pr.id !== prodId);
        } else if (op.entityType === 'customer' && (op.action === 'create' || op.action === 'update')) {
          const custId = String(p.id || `cust-${crypto.randomBytes(4).toString('hex')}`);
          const existingIdx = record.customers.findIndex((c) => c.id === custId);
          const existing = existingIdx >= 0 ? record.customers[existingIdx] : undefined;
          const nextCust: Customer = {
            id: custId,
            shopId,
            name: String(p.name || 'Customer').trim().slice(0, 60),
            phone: String(p.phone || '').trim().slice(0, 20),
            address: p.address ? String(p.address).slice(0, 120) : undefined,
            udharBalance: existing
              ? existing.udharBalance
              : Math.max(0, Number(p.udharBalance) || 0),
            lastActivityAt: String(p.lastActivityAt || op.clientTimestamp),
            reminderNote: p.reminderNote ? String(p.reminderNote).slice(0, 160) : undefined,
            updatedAt: op.clientTimestamp,
          };
          if (existingIdx >= 0) {
            record.customers[existingIdx] = nextCust;
          } else {
            record.customers.push(nextCust);
          }
        } else if (op.entityType === 'udhar' && op.action === 'create') {
          const amount = Math.round(Math.max(0, Number(p.amount) || 0) * 100) / 100;
          const customerId = String(p.customerId || '');
          const entryType = p.type === 'repayment' ? 'repayment' : 'credit';
          const cust = record.customers.find((c) => c.id === customerId);
          if (amount > 0 && cust) {
            if (!op.forceDuplicate) {
              const dup = record.udharEntries.find((u) => {
                const dt = Math.abs(
                  new Date(op.clientTimestamp).getTime() - new Date(u.createdAt).getTime()
                );
                return (
                  dt < 90_000 &&
                  u.customerId === customerId &&
                  u.type === entryType &&
                  Math.abs(u.amount - amount) < 0.01
                );
              });
              if (dup) {
                skippedDuplicates.push({
                  opId: op.opId,
                  reason: `Duplicate Udhar ${entryType} for ${cust.name} (₹${amount})`,
                });
                record.appliedKeys.push(op.idempotencyKey);
                continue;
              }
            }

            const delta = entryType === 'credit' ? amount : -amount;
            cust.udharBalance = Math.max(
              0,
              Math.round((cust.udharBalance + delta) * 100) / 100
            );
            cust.lastActivityAt = String(p.createdAt || op.clientTimestamp);
            cust.updatedAt = new Date().toISOString();

            const entry: UdharEntry = {
              id: String(p.id || `udh-${crypto.randomBytes(4).toString('hex')}`),
              shopId,
              customerId: cust.id,
              customerName: cust.name,
              type: entryType,
              amount,
              balanceAfter: cust.udharBalance,
              note: p.note ? String(p.note).slice(0, 180) : undefined,
              source: p.source === 'voice' ? 'voice' : 'manual',
              idempotencyKey: op.idempotencyKey,
              createdAt: String(p.createdAt || op.clientTimestamp),
              synced: true,
            };
            if (!record.udharEntries.some((u) => u.id === entry.id)) {
              record.udharEntries.unshift(entry);
            }
          }
        } else if (op.entityType === 'expense' && op.action === 'create') {
          const amount = Math.round(Math.max(0, Number(p.amount) || 0) * 100) / 100;
          if (amount > 0) {
            const title = String(p.title || 'Shop Expense').trim().slice(0, 80);
            if (!op.forceDuplicate) {
              const dup = record.expenses.find((e) => {
                const dt = Math.abs(
                  new Date(op.clientTimestamp).getTime() - new Date(e.createdAt).getTime()
                );
                return (
                  dt < 90_000 &&
                  e.title.toLowerCase() === title.toLowerCase() &&
                  Math.abs(e.amount - amount) < 0.01
                );
              });
              if (dup) {
                skippedDuplicates.push({
                  opId: op.opId,
                  reason: `Duplicate expense detected (${title} · ₹${amount})`,
                });
                record.appliedKeys.push(op.idempotencyKey);
                continue;
              }
            }

            const expense: Expense = {
              id: String(p.id || `exp-${crypto.randomBytes(4).toString('hex')}`),
              shopId,
              title,
              category: String(p.category || 'Other').slice(0, 40),
              amount,
              paymentMode: (['cash', 'upi', 'bank'].includes(String(p.paymentMode))
                ? String(p.paymentMode)
                : 'cash') as Expense['paymentMode'],
              note: p.note ? String(p.note).slice(0, 180) : undefined,
              source: p.source === 'voice' ? 'voice' : 'manual',
              idempotencyKey: op.idempotencyKey,
              createdAt: String(p.createdAt || op.clientTimestamp),
              synced: true,
            };
            if (!record.expenses.some((e) => e.id === expense.id)) {
              record.expenses.unshift(expense);
            }
          }
        } else if (op.entityType === 'expense' && op.action === 'delete') {
          const expId = String(p.id || '');
          record.expenses = record.expenses.filter((e) => e.id !== expId);
        } else if (op.entityType === 'settings' && op.action === 'update') {
          record.profile = {
            ...record.profile,
            name: p.name ? String(p.name).slice(0, 80) : record.profile.name,
            ownerName: p.ownerName ? String(p.ownerName).slice(0, 60) : record.profile.ownerName,
            phone: typeof p.phone === 'string' ? p.phone.slice(0, 20) : record.profile.phone,
            address: typeof p.address === 'string' ? p.address.slice(0, 140) : record.profile.address,
            city: typeof p.city === 'string' ? p.city.slice(0, 60) : record.profile.city,
            shopType: p.shopType ? String(p.shopType).slice(0, 40) : record.profile.shopType,
            currency: p.currency ? String(p.currency).slice(0, 10) : record.profile.currency,
            lowStockDefault:
              typeof p.lowStockDefault === 'number'
                ? Math.max(1, p.lowStockDefault)
                : record.profile.lowStockDefault,
            categories: Array.isArray(p.categories)
              ? (p.categories as string[]).map((c) => String(c).slice(0, 40)).slice(0, 20)
              : record.profile.categories,
            expenseCategories: Array.isArray(p.expenseCategories)
              ? (p.expenseCategories as string[]).map((c) => String(c).slice(0, 40)).slice(0, 20)
              : record.profile.expenseCategories,
            voiceReadbackEnabled:
              typeof p.voiceReadbackEnabled === 'boolean'
                ? p.voiceReadbackEnabled
                : record.profile.voiceReadbackEnabled,
            updatedAt: new Date().toISOString(),
          };
        }

        record.appliedKeys.push(op.idempotencyKey);
        if (record.appliedKeys.length > 1000) {
          record.appliedKeys = record.appliedKeys.slice(-500);
        }
        appliedOpIds.push(op.opId);
      }

      return {
        appliedOpIds,
        skippedDuplicates,
        warnings,
        snapshot: this.getSnapshot(shopId)!,
      };
    });
  }
}

export const shopStore = new PersistentShopStore();
