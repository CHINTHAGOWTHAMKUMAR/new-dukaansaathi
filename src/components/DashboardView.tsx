import React from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Mic,
  Plus,
  Receipt,
  Sparkles,
  Wallet,
} from 'lucide-react';
import type { ActiveTab, Language, Sale, ShopSnapshot } from '../types';
import { UI_TEXT, formatINR, formatShortDate, formatTime } from '../lib/i18n';

interface DashboardViewProps {
  snapshot: ShopSnapshot;
  language: Language;
  onOpenVoice: () => void;
  onNavigate: (tab: ActiveTab) => void;
  onViewInvoice: (sale: Sale) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  snapshot,
  language,
  onOpenVoice,
  onNavigate,
  onViewInvoice,
}) => {
  const t = UI_TEXT[language];
  const todayStr = new Date().toISOString().slice(0, 10);

  const todaySales = snapshot.sales.filter((s) => s.createdAt.slice(0, 10) === todayStr);
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);

  const todayExpenses = snapshot.expenses
    .filter((e) => e.createdAt.slice(0, 10) === todayStr)
    .reduce((sum, e) => sum + e.amount, 0);

  // Estimate gross margin from product costPrice when available, else ~16% retail margin
  const estimatedCogs = todaySales.reduce((sum, s) => {
    return (
      sum +
      s.items.reduce((itemSum, it) => {
        const prod = snapshot.products.find((p) => p.id === it.productId);
        const unitCost = prod ? prod.costPrice : it.unitPrice * 0.84;
        return itemSum + unitCost * it.quantity;
      }, 0)
    );
  }, 0);
  const estProfit = Math.round(todayRevenue - estimatedCogs - todayExpenses);

  const pendingUdhar = snapshot.customers.reduce((sum, c) => sum + c.udharBalance, 0);
  const lowStockProducts = snapshot.products.filter((p) => p.stock <= p.minStock);

  const recentSales = snapshot.sales.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Shop Identity & Voice Primary Hero Strip */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-14 w-14 rounded-xl overflow-hidden bg-teal-50 border border-slate-200 shrink-0 flex items-center justify-center">
            <img
              src="/src/assets/images/shop_kirana_avatar_1795793425940.jpg"
              alt={snapshot.shop.name}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
              {snapshot.shop.name}
            </h1>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {snapshot.shop.ownerName} · {snapshot.shop.city} · Code{' '}
              <span className="font-mono-tabular font-semibold text-slate-700">
                {snapshot.shop.code}
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenVoice}
          className="min-h-[48px] px-5 py-2.5 rounded-xl bg-teal-700 text-white font-semibold text-sm hover:bg-teal-800 transition-colors inline-flex items-center justify-center gap-2.5 whitespace-nowrap shrink-0 shadow-xs"
        >
          <Mic className="w-5 h-5" />
          <span>{t.voice.tapToSpeak}</span>
        </button>
      </div>

      {/* Public Demo Notice */}
      {snapshot.shop.isPublic && (
        <div className="rounded-xl bg-teal-50/70 border border-teal-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs text-teal-950">
            <span className="font-semibold">{t.dashboard.demoBannerTitle}</span>
            <span className="text-teal-800"> — {t.dashboard.demoBannerBody}</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="text-xs font-semibold text-teal-800 hover:text-teal-950 underline whitespace-nowrap self-start sm:self-auto"
          >
            Shop Settings
          </button>
        </div>
      )}

      {/* 4-Column KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => onNavigate('sales')}
          className="text-left rounded-2xl bg-white border border-slate-200 p-4 hover:border-slate-300 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500">{t.dashboard.todaySales}</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-tabular">
            {formatINR(todayRevenue)}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono-tabular">
            {todaySales.length} bills today
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('expenses')}
          className="text-left rounded-2xl bg-white border border-slate-200 p-4 hover:border-slate-300 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500">{t.dashboard.todayExpenses}</div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono-tabular">
            {formatINR(todayExpenses)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Cash & UPI</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('reports')}
          className="text-left rounded-2xl bg-white border border-slate-200 p-4 hover:border-slate-300 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500">{t.dashboard.estProfit}</div>
          <div
            className={`mt-2 text-2xl font-bold font-mono-tabular ${
              estProfit >= 0 ? 'text-teal-700' : 'text-rose-600'
            }`}
          >
            {formatINR(estProfit)}
          </div>
          <div className="mt-1 text-xs text-slate-500">After stock cost & expenses</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('udhar')}
          className="text-left rounded-2xl bg-white border border-slate-200 p-4 hover:border-slate-300 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500">{t.dashboard.pendingUdhar}</div>
          <div className="mt-2 text-2xl font-bold text-amber-700 font-mono-tabular">
            {formatINR(pendingUdhar)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {snapshot.customers.filter((c) => c.udharBalance > 0).length} customers due
          </div>
        </button>
      </div>

      {/* Quick Actions */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">{t.dashboard.quickActions}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('sales')}
            className="min-h-[56px] rounded-xl bg-white border border-slate-200 px-4 py-3 flex items-center gap-3 hover:border-teal-600 transition-colors"
          >
            <Receipt className="w-5 h-5 text-teal-700 shrink-0" />
            <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">
              {t.actions.recordSale}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('udhar')}
            className="min-h-[56px] rounded-xl bg-white border border-slate-200 px-4 py-3 flex items-center gap-3 hover:border-teal-600 transition-colors"
          >
            <Wallet className="w-5 h-5 text-amber-700 shrink-0" />
            <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">
              {t.actions.addUdhar}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('expenses')}
            className="min-h-[56px] rounded-xl bg-white border border-slate-200 px-4 py-3 flex items-center gap-3 hover:border-teal-600 transition-colors"
          >
            <Plus className="w-5 h-5 text-slate-700 shrink-0" />
            <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">
              {t.actions.logExpense}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="min-h-[56px] rounded-xl bg-white border border-slate-200 px-4 py-3 flex items-center gap-3 hover:border-teal-600 transition-colors"
          >
            <Sparkles className="w-5 h-5 text-teal-700 shrink-0" />
            <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">
              {t.nav.reports}
            </span>
          </button>
        </div>
      </section>

      {/* Two-Column Split: Recent Transactions & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{t.dashboard.recentSales}</h2>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              View All
            </button>
          </div>
          {recentSales.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No sales recorded yet. Tap “{t.actions.recordSale}” or use the Voice Mic.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentSales.map((sale) => (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => onViewInvoice(sale)}
                  className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {sale.items.map((i) => `${i.productName} (${i.quantity} ${i.unit})`).join(', ')}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono-tabular">{sale.invoiceNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span>{sale.paymentMode.toUpperCase()}</span>
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
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-slate-900 font-mono-tabular">
                      {formatINR(sale.totalAmount)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {sale.synced === false ? 'Pending sync' : sale.source === 'voice' ? 'Voice' : 'Manual'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{t.dashboard.lowStockTitle}</h2>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              Manage
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              All products are sufficiently stocked.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStockProducts.slice(0, 6).map((prod) => (
                <div
                  key={prod.id}
                  className="px-5 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{prod.name}</div>
                    <div className="text-xs text-slate-500 font-mono-tabular">
                      Min {prod.minStock} {prod.unit}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-xs font-mono-tabular shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      {prod.stock} {prod.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Udhar Snapshot */}
          <div className="border-t border-slate-200 px-5 py-3 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-700" />
              Credit given: {snapshot.udharEntries.filter((u) => u.type === 'credit').length}
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-teal-700" />
              Repaid: {snapshot.udharEntries.filter((u) => u.type === 'repayment').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
