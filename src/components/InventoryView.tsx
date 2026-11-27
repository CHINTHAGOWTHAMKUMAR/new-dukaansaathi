import React, { useMemo, useState } from 'react';
import { AlertTriangle, Edit3, Minus, Plus, Search, Trash2 } from 'lucide-react';
import type { Language, Product, ShopSnapshot } from '../types';
import { UI_TEXT, formatINR } from '../lib/i18n';
import { makeId } from '../lib/syncEngine';

interface InventoryViewProps {
  snapshot: ShopSnapshot;
  language: Language;
  onCommitMutation: (
    entityType: 'product',
    action: 'create' | 'update' | 'delete',
    payload: Record<string, unknown>
  ) => Promise<{ warnings: string[] }>;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  snapshot,
  language,
  onCommitMutation,
}) => {
  const t = UI_TEXT[language];
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [hiName, setHiName] = useState('');
  const [teName, setTeName] = useState('');
  const [category, setCategory] = useState(snapshot.shop.categories[0] || 'Grains & Pulses');
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState(String(snapshot.shop.lowStockDefault || 8));

  const openNewForm = () => {
    setEditing(null);
    setName('');
    setHiName('');
    setTeName('');
    setCategory(snapshot.shop.categories[0] || 'Grains & Pulses');
    setUnit('kg');
    setPrice('');
    setCostPrice('');
    setStock('');
    setMinStock(String(snapshot.shop.lowStockDefault || 8));
    setShowForm(true);
  };

  const openEditForm = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setHiName(p.localNames?.hi || '');
    setTeName(p.localNames?.te || '');
    setCategory(p.category);
    setUnit(p.unit);
    setPrice(String(p.price));
    setCostPrice(String(p.costPrice));
    setStock(String(p.stock));
    setMinStock(String(p.minStock));
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload: Product = {
      id: editing?.id || makeId('prod'),
      shopId: snapshot.shop.id,
      name: name.trim(),
      localNames:
        hiName.trim() || teName.trim()
          ? { hi: hiName.trim() || undefined, te: teName.trim() || undefined }
          : undefined,
      category,
      unit: unit.trim() || 'kg',
      price: Math.max(0, Number(price) || 0),
      costPrice: Math.max(0, Number(costPrice) || 0),
      stock: Math.max(0, Number(stock) || 0),
      minStock: Math.max(0, Number(minStock) || 5),
      updatedAt: new Date().toISOString(),
    };
    await onCommitMutation(
      'product',
      editing ? 'update' : 'create',
      payload as unknown as Record<string, unknown>
    );
    setShowForm(false);
    setEditing(null);
  };

  const adjustStock = async (prod: Product, delta: number) => {
    const nextStock = Math.max(0, Math.round((prod.stock + delta) * 100) / 100);
    await onCommitMutation('product', 'update', {
      ...prod,
      stock: nextStock,
      updatedAt: new Date().toISOString(),
    });
  };

  const lowCount = snapshot.products.filter((p) => p.stock <= p.minStock).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return snapshot.products.filter((p) => {
      if (lowStockOnly && p.stock > p.minStock) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.localNames?.hi || '').toLowerCase().includes(q) ||
        (p.localNames?.te || '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [snapshot.products, search, categoryFilter, lowStockOnly]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t.nav.inventory}</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono-tabular">
            {snapshot.products.length} products · {lowCount} low stock
          </p>
        </div>
        <button
          type="button"
          onClick={openNewForm}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t.actions.addProduct}</span>
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => void handleSave(e)}
          className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4"
        >
          <h2 className="text-sm font-bold text-slate-900">
            {editing ? 'Update Product' : 'Add New Product'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Product Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sona Masoori Rice"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Hindi Name (Optional)</label>
              <input
                type="text"
                value={hiName}
                onChange={(e) => setHiName(e.target.value)}
                placeholder="चावल"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Telugu Name (Optional)</label>
              <input
                type="text"
                value={teName}
                onChange={(e) => setTeName(e.target.value)}
                placeholder="బియ్యం"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm bg-white"
              >
                {snapshot.shop.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm bg-white"
              >
                <option value="kg">kg</option>
                <option value="litre">litre</option>
                <option value="pkt">pkt</option>
                <option value="pcs">pcs</option>
                <option value="box">box</option>
                <option value="dozen">dozen</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Selling Price (₹)</label>
              <input
                type="number"
                step="0.5"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cost Price (₹)</label>
              <input
                type="number"
                step="0.5"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Current Stock</label>
              <input
                type="number"
                step="0.5"
                required
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Low Stock Alert At</label>
              <input
                type="number"
                step="1"
                required
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-700"
            >
              {t.actions.cancel}
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800"
            >
              {t.actions.save}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products in English, Hindi, or Telugu..."
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-teal-600"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
          >
            <option value="all">All Categories</option>
            {snapshot.shop.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setLowStockOnly((v) => !v)}
            className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap ${
              lowStockOnly
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low Stock ({lowCount})</span>
          </button>
        </div>
      </div>

      {/* Product Grid / List */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No products match your search.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((prod) => {
              const isLow = prod.stock <= prod.minStock;
              return (
                <div
                  key={prod.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {prod.name}
                      </span>
                      {isLow && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Low
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span>{prod.category}</span>
                      {(prod.localNames?.te || prod.localNames?.hi) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {[prod.localNames?.te, prod.localNames?.hi].filter(Boolean).join(' / ')}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        Sell {formatINR(prod.price)}/{prod.unit}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <div className="flex items-center border border-slate-200 rounded-xl bg-white overflow-hidden">
                      <button
                        type="button"
                        aria-label="Decrease stock"
                        onClick={() => void adjustStock(prod, -1)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-600 hover:bg-slate-100"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span
                        className={`px-3 text-xs font-bold font-mono-tabular ${
                          isLow ? 'text-amber-700' : 'text-slate-900'
                        }`}
                      >
                        {prod.stock} {prod.unit}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase stock"
                        onClick={() => void adjustStock(prod, 1)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-600 hover:bg-slate-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      aria-label="Edit product"
                      onClick={() => openEditForm(prod)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete product"
                      onClick={() => void onCommitMutation('product', 'delete', { id: prod.id })}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
