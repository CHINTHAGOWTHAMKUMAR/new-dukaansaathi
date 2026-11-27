import React, { useMemo, useState } from 'react';
import { FileText, Plus, Search, Trash2 } from 'lucide-react';
import type { Language, PaymentMode, Sale, SaleItem, ShopSnapshot } from '../types';
import { UI_TEXT, formatINR, formatShortDate, formatTime } from '../lib/i18n';
import { makeId } from '../lib/syncEngine';

interface SalesBillingViewProps {
  snapshot: ShopSnapshot;
  language: Language;
  onCommitMutation: (
    entityType: 'sale',
    action: 'create' | 'delete',
    payload: Record<string, unknown>,
    forceDuplicate?: boolean
  ) => Promise<{ warnings: string[] }>;
  onViewInvoice: (sale: Sale) => void;
}

export const SalesBillingView: React.FC<SalesBillingViewProps> = ({
  snapshot,
  language,
  onCommitMutation,
  onViewInvoice,
}) => {
  const t = UI_TEXT[language];
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | PaymentMode>('all');
  const [showNewBill, setShowNewBill] = useState(false);

  // New Bill Builder State
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(snapshot.products[0]?.id || '');
  const [qty, setQty] = useState(1);
  const [customPrice, setCustomPrice] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [customerId, setCustomerId] = useState('');
  const [paidInput, setPaidInput] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedProduct = snapshot.products.find((p) => p.id === selectedProductId);
  const cartTotal = useMemo(
    () => Math.round(cart.reduce((sum, it) => sum + it.lineTotal, 0) * 100) / 100,
    [cart]
  );

  const addItemToCart = () => {
    if (!selectedProduct || qty <= 0) return;
    const unitPrice =
      customPrice.trim() !== '' && Number(customPrice) >= 0
        ? Number(customPrice)
        : selectedProduct.price;
    const lineTotal = Math.round(qty * unitPrice * 100) / 100;

    setCart((prev) => {
      const existingIdx = prev.findIndex((i) => i.productId === selectedProduct.id && i.unitPrice === unitPrice);
      if (existingIdx >= 0) {
        const next = [...prev];
        const nextQty = Math.round((next[existingIdx].quantity + qty) * 100) / 100;
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: nextQty,
          lineTotal: Math.round(nextQty * unitPrice * 100) / 100,
        };
        return next;
      }
      return [
        ...prev,
        {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantity: qty,
          unit: selectedProduct.unit,
          unitPrice,
          lineTotal,
        },
      ];
    });
    setQty(1);
    setCustomPrice('');
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || cartTotal <= 0) return;
    if ((paymentMode === 'udhar' || paymentMode === 'mixed') && !customerId) {
      return;
    }

    setSaving(true);
    try {
      const cust = snapshot.customers.find((c) => c.id === customerId);
      const paidAmt =
        paymentMode === 'udhar'
          ? 0
          : paymentMode === 'mixed'
            ? Math.min(cartTotal, Math.max(0, Number(paidInput) || 0))
            : cartTotal;
      const creditAmt = Math.round((cartTotal - paidAmt) * 100) / 100;

      const salePayload: Sale = {
        id: makeId('sale'),
        shopId: snapshot.shop.id,
        invoiceNumber: `INV-${1045 + snapshot.sales.length}`,
        items: cart,
        totalAmount: cartTotal,
        paymentMode,
        paidAmount: paidAmt,
        creditAmount: creditAmt,
        customerId: cust?.id,
        customerName: cust?.name,
        notes: notes.trim() || undefined,
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onCommitMutation('sale', 'create', salePayload as unknown as Record<string, unknown>);
      setCart([]);
      setNotes('');
      setPaidInput('');
      setShowNewBill(false);
      onViewInvoice(salePayload);
    } finally {
      setSaving(false);
    }
  };

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return snapshot.sales.filter((s) => {
      if (modeFilter !== 'all' && s.paymentMode !== modeFilter) return false;
      if (!q) return true;
      return (
        s.invoiceNumber.toLowerCase().includes(q) ||
        (s.customerName || '').toLowerCase().includes(q) ||
        s.items.some((i) => i.productName.toLowerCase().includes(q))
      );
    });
  }, [snapshot.sales, search, modeFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t.nav.sales}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create bills, generate receipts, and search transaction history
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewBill((v) => !v)}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showNewBill ? t.actions.cancel : t.actions.recordSale}</span>
        </button>
      </div>

      {/* Bill Builder */}
      {showNewBill && (
        <form
          onSubmit={(e) => void handleCreateBill(e)}
          className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4"
        >
          <h2 className="text-sm font-bold text-slate-900">New Sale / Bill</h2>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-5">
              <label className="block text-xs font-medium text-slate-600 mb-1">Product</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm bg-white"
              >
                {snapshot.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatINR(p.price)}/{p.unit} · {p.stock} left)
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Qty ({selectedProduct?.unit || 'unit'})
              </label>
              <input
                type="number"
                step="0.5"
                min="0.1"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Rate ₹ (default {selectedProduct ? formatINR(selectedProduct.price) : '₹0'})
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder={String(selectedProduct?.price || 0)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={addItemToCart}
                disabled={!selectedProduct}
                className="w-full min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40"
              >
                Add Item
              </button>
            </div>
          </div>

          {/* Cart items */}
          {cart.length > 0 && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Item</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Rate</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.map((item, idx) => (
                    <tr key={`${item.productId}-${idx}`}>
                      <td className="px-3 py-2.5 font-medium text-slate-900">{item.productName}</td>
                      <td className="px-3 py-2.5 text-right font-mono-tabular">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-tabular">
                        {formatINR(item.unitPrice)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold font-mono-tabular">
                        {formatINR(item.lineTotal)}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <button
                          type="button"
                          aria-label="Remove item"
                          onClick={() => setCart((c) => c.filter((_, i) => i !== idx))}
                          className="p-1.5 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Bill Total</span>
                <span className="text-lg font-bold text-slate-900 font-mono-tabular">
                  {formatINR(cartTotal)}
                </span>
              </div>
            </div>
          )}

          {/* Payment & Customer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode</label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">
                {(['cash', 'upi', 'udhar', 'mixed'] as PaymentMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`min-h-[36px] rounded-lg text-xs font-semibold uppercase transition-colors ${
                      paymentMode === mode
                        ? 'bg-white text-teal-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Customer {paymentMode === 'udhar' || paymentMode === 'mixed' ? '(Required)' : '(Optional)'}
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required={paymentMode === 'udhar' || paymentMode === 'mixed'}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm bg-white"
              >
                <option value="">Walk-in Customer</option>
                {snapshot.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Bal: {formatINR(c.udharBalance)})
                  </option>
                ))}
              </select>
            </div>

            {paymentMode === 'mixed' ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Paid Now (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  max={cartTotal}
                  value={paidInput}
                  onChange={(e) => setPaidInput(e.target.value)}
                  placeholder="Amount paid now"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional bill note"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowNewBill(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t.actions.cancel}
            </button>
            <button
              type="submit"
              disabled={cart.length === 0 || saving}
              className="min-h-[44px] px-5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-40"
            >
              {saving ? 'Saving...' : `Save Bill (${formatINR(cartTotal)})`}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, product, or customer..."
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start">
          {(['all', 'cash', 'upi', 'udhar', 'mixed'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModeFilter(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase whitespace-nowrap transition-colors ${
                modeFilter === m
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Table / List */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        {filteredSales.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No matching sales transactions found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredSales.map((sale) => (
              <div
                key={sale.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {sale.items.map((i) => `${i.productName} (${i.quantity} ${i.unit})`).join(', ')}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono-tabular font-medium text-slate-700">
                      {sale.invoiceNumber}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="uppercase">{sale.paymentMode}</span>
                    {sale.customerName && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{sale.customerName}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>
                      {formatShortDate(sale.createdAt)} {formatTime(sale.createdAt)}
                    </span>
                    {sale.synced === false && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-700 font-medium">Pending Sync</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900 font-mono-tabular">
                      {formatINR(sale.totalAmount)}
                    </div>
                    {sale.creditAmount > 0 && (
                      <div className="text-[11px] text-amber-700 font-mono-tabular">
                        Udhar {formatINR(sale.creditAmount)}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onViewInvoice(sale)}
                    className="min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{t.actions.printBill}</span>
                  </button>

                  <button
                    type="button"
                    aria-label="Delete sale"
                    onClick={() => void onCommitMutation('sale', 'delete', { id: sale.id })}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
