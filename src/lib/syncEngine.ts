import type {
  Customer,
  Expense,
  Product,
  Sale,
  SaleItem,
  ShopProfile,
  ShopSnapshot,
  SyncActionType,
  SyncEntityType,
  SyncOperation,
  UdharEntry,
} from '../types';
import {
  enqueueOutboxOp,
  getOutboxForShop,
  getSnapshotLocal,
  removeOutboxOps,
  saveSnapshotLocal,
} from './offlineDb';

export function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function buildAuthHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchShopSnapshot(
  shopId: string,
  token?: string | null
): Promise<{ snapshot: ShopSnapshot; fromCache: boolean }> {
  const cached = await getSnapshotLocal(shopId);
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (cached) return { snapshot: cached, fromCache: true };
    throw new Error('Offline and no cached shop data found.');
  }

  try {
    const res = await fetch(`/api/shops/${encodeURIComponent(shopId)}/snapshot`, {
      headers: buildAuthHeaders(token),
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error('PIN verification required for this shop.');
      if (cached) return { snapshot: cached, fromCache: true };
      throw new Error('Unable to load shop data.');
    }
    const serverSnapshot = (await res.json()) as ShopSnapshot;
    const pendingOps = await getOutboxForShop(shopId);
    let merged = serverSnapshot;
    for (const op of pendingOps) {
      merged = applyOpOptimistically(merged, op);
    }
    await saveSnapshotLocal(merged);
    return { snapshot: merged, fromCache: false };
  } catch (err) {
    if (cached) return { snapshot: cached, fromCache: true };
    throw err;
  }
}

export function applyOpOptimistically(snapshot: ShopSnapshot, op: SyncOperation): ShopSnapshot {
  const p = op.payload;
  const next: ShopSnapshot = {
    ...snapshot,
    products: [...snapshot.products],
    customers: [...snapshot.customers],
    sales: [...snapshot.sales],
    udharEntries: [...snapshot.udharEntries],
    expenses: [...snapshot.expenses],
  };

  if (op.entityType === 'sale' && op.action === 'create') {
    const items = (p.items as SaleItem[]) || [];
    const totalAmount = Number(p.totalAmount) || 0;
    const sale: Sale = {
      id: String(p.id),
      shopId: op.shopId,
      invoiceNumber: String(p.invoiceNumber || `INV-${1045 + next.sales.length}`),
      items,
      totalAmount,
      paymentMode: (p.paymentMode as Sale['paymentMode']) || 'cash',
      paidAmount: Number(p.paidAmount) || 0,
      creditAmount: Number(p.creditAmount) || 0,
      customerId: p.customerId ? String(p.customerId) : undefined,
      customerName: p.customerName ? String(p.customerName) : undefined,
      notes: p.notes ? String(p.notes) : undefined,
      source: p.source === 'voice' ? 'voice' : 'manual',
      transcript: p.transcript ? String(p.transcript) : undefined,
      idempotencyKey: op.idempotencyKey,
      createdAt: String(p.createdAt || op.clientTimestamp),
      updatedAt: op.clientTimestamp,
      synced: false,
    };

    if (!next.sales.some((s) => s.id === sale.id)) {
      next.sales.unshift(sale);
      for (const item of items) {
        const idx = next.products.findIndex((pr) => pr.id === item.productId);
        if (idx >= 0) {
          next.products[idx] = {
            ...next.products[idx],
            stock: Math.max(0, Math.round((next.products[idx].stock - item.quantity) * 100) / 100),
            updatedAt: op.clientTimestamp,
          };
        }
      }
      if (sale.creditAmount > 0 && sale.customerId) {
        const cIdx = next.customers.findIndex((c) => c.id === sale.customerId);
        if (cIdx >= 0) {
          const newBal = Math.round((next.customers[cIdx].udharBalance + sale.creditAmount) * 100) / 100;
          next.customers[cIdx] = {
            ...next.customers[cIdx],
            udharBalance: newBal,
            lastActivityAt: sale.createdAt,
          };
          next.udharEntries.unshift({
            id: `udh-local-${sale.id}`,
            shopId: op.shopId,
            customerId: sale.customerId,
            customerName: next.customers[cIdx].name,
            type: 'credit',
            amount: sale.creditAmount,
            balanceAfter: newBal,
            note: `Invoice ${sale.invoiceNumber}`,
            linkedSaleId: sale.id,
            source: sale.source,
            createdAt: sale.createdAt,
            synced: false,
          });
        }
      }
    }
  } else if (op.entityType === 'sale' && op.action === 'delete') {
    next.sales = next.sales.filter((s) => s.id !== String(p.id));
  } else if (op.entityType === 'product' && (op.action === 'create' || op.action === 'update')) {
    const prod = p as unknown as Product;
    const idx = next.products.findIndex((pr) => pr.id === prod.id);
    if (idx >= 0) {
      next.products[idx] = { ...next.products[idx], ...prod, updatedAt: op.clientTimestamp };
    } else {
      next.products.push({ ...prod, shopId: op.shopId, updatedAt: op.clientTimestamp });
    }
  } else if (op.entityType === 'product' && op.action === 'delete') {
    next.products = next.products.filter((pr) => pr.id !== String(p.id));
  } else if (op.entityType === 'customer' && (op.action === 'create' || op.action === 'update')) {
    const cust = p as unknown as Customer;
    const idx = next.customers.findIndex((c) => c.id === cust.id);
    if (idx >= 0) {
      next.customers[idx] = { ...next.customers[idx], ...cust, updatedAt: op.clientTimestamp };
    } else {
      next.customers.push({ ...cust, shopId: op.shopId, updatedAt: op.clientTimestamp });
    }
  } else if (op.entityType === 'udhar' && op.action === 'create') {
    const customerId = String(p.customerId);
    const amount = Number(p.amount) || 0;
    const type = p.type === 'repayment' ? 'repayment' : 'credit';
    const cIdx = next.customers.findIndex((c) => c.id === customerId);
    if (cIdx >= 0 && !next.udharEntries.some((u) => u.id === String(p.id))) {
      const delta = type === 'credit' ? amount : -amount;
      const newBal = Math.max(0, Math.round((next.customers[cIdx].udharBalance + delta) * 100) / 100);
      next.customers[cIdx] = {
        ...next.customers[cIdx],
        udharBalance: newBal,
        lastActivityAt: String(p.createdAt || op.clientTimestamp),
      };
      next.udharEntries.unshift({
        id: String(p.id),
        shopId: op.shopId,
        customerId,
        customerName: next.customers[cIdx].name,
        type,
        amount,
        balanceAfter: newBal,
        note: p.note ? String(p.note) : undefined,
        source: p.source === 'voice' ? 'voice' : 'manual',
        createdAt: String(p.createdAt || op.clientTimestamp),
        synced: false,
      });
    }
  } else if (op.entityType === 'expense' && op.action === 'create') {
    const exp: Expense = {
      id: String(p.id),
      shopId: op.shopId,
      title: String(p.title),
      category: String(p.category || 'Other'),
      amount: Number(p.amount) || 0,
      paymentMode: (p.paymentMode as Expense['paymentMode']) || 'cash',
      note: p.note ? String(p.note) : undefined,
      source: p.source === 'voice' ? 'voice' : 'manual',
      createdAt: String(p.createdAt || op.clientTimestamp),
      synced: false,
    };
    if (!next.expenses.some((e) => e.id === exp.id)) {
      next.expenses.unshift(exp);
    }
  } else if (op.entityType === 'expense' && op.action === 'delete') {
    next.expenses = next.expenses.filter((e) => e.id !== String(p.id));
  } else if (op.entityType === 'settings' && op.action === 'update') {
    next.shop = {
      ...next.shop,
      ...(p as Partial<ShopProfile>),
      updatedAt: op.clientTimestamp,
    };
  }

  return next;
}

export async function recordMutationAndSync(params: {
  snapshot: ShopSnapshot;
  entityType: SyncEntityType;
  action: SyncActionType;
  payload: Record<string, unknown>;
  token?: string | null;
  forceDuplicate?: boolean;
}): Promise<{
  nextSnapshot: ShopSnapshot;
  pendingCount: number;
  warnings: string[];
}> {
  const op: SyncOperation = {
    opId: makeId('op'),
    idempotencyKey: makeId('idem'),
    shopId: params.snapshot.shop.id,
    entityType: params.entityType,
    action: params.action,
    payload: params.payload,
    clientTimestamp: new Date().toISOString(),
    forceDuplicate: params.forceDuplicate,
    status: 'pending',
  };

  const optimistic = applyOpOptimistically(params.snapshot, op);
  await saveSnapshotLocal(optimistic);
  await enqueueOutboxOp(op);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    const synced = await flushOutbox(params.snapshot.shop.id, params.token);
    if (synced) {
      return {
        nextSnapshot: synced.snapshot,
        pendingCount: synced.pendingCount,
        warnings: synced.warnings,
      };
    }
  }

  const outbox = await getOutboxForShop(params.snapshot.shop.id);
  return {
    nextSnapshot: optimistic,
    pendingCount: outbox.length,
    warnings: [],
  };
}

export async function flushOutbox(
  shopId: string,
  token?: string | null
): Promise<{
  snapshot: ShopSnapshot;
  pendingCount: number;
  warnings: string[];
} | null> {
  const ops = await getOutboxForShop(shopId);
  if (ops.length === 0) {
    try {
      const res = await fetch(`/api/shops/${encodeURIComponent(shopId)}/snapshot`, {
        headers: buildAuthHeaders(token),
      });
      if (!res.ok) return null;
      const snapshot = (await res.json()) as ShopSnapshot;
      await saveSnapshotLocal(snapshot);
      return { snapshot, pendingCount: 0, warnings: [] };
    } catch {
      return null;
    }
  }

  try {
    const res = await fetch(`/api/shops/${encodeURIComponent(shopId)}/sync`, {
      method: 'POST',
      headers: buildAuthHeaders(token),
      body: JSON.stringify({ operations: ops }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      appliedOpIds: string[];
      skippedDuplicates: { opId: string; reason: string }[];
      warnings: string[];
      snapshot: ShopSnapshot;
    };

    const doneIds = [
      ...data.appliedOpIds,
      ...data.skippedDuplicates.map((d) => d.opId),
    ];
    await removeOutboxOps(doneIds);
    await saveSnapshotLocal(data.snapshot);
    const remaining = await getOutboxForShop(shopId);
    const dupReasons = data.skippedDuplicates.map((d) => d.reason);

    return {
      snapshot: data.snapshot,
      pendingCount: remaining.length,
      warnings: [...dupReasons, ...data.warnings],
    };
  } catch {
    return null;
  }
}
