import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import type { AIInsightReport, Language, ShopSnapshot } from '../types';
import { UI_TEXT, formatINR } from '../lib/i18n';
import { getInsightLocal, saveInsightLocal } from '../lib/offlineDb';

interface ReportsInsightsViewProps {
  snapshot: ShopSnapshot;
  language: Language;
  isOnline: boolean;
  authToken?: string | null;
}

export const ReportsInsightsView: React.FC<ReportsInsightsViewProps> = ({
  snapshot,
  language,
  isOnline,
  authToken,
}) => {
  const t = UI_TEXT[language];
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [insights, setInsights] = useState<AIInsightReport | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  useEffect(() => {
    void getInsightLocal(snapshot.shop.id).then((cached) => {
      if (cached) setInsights(cached);
    });
  }, [snapshot.shop.id]);

  const cutoffMs = useMemo(() => {
    const now = Date.now();
    if (period === 'daily') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return start.getTime();
    }
    if (period === 'weekly') return now - 7 * 24 * 3600 * 1000;
    return now - 30 * 24 * 3600 * 1000;
  }, [period]);

  const periodSales = useMemo(
    () => snapshot.sales.filter((s) => new Date(s.createdAt).getTime() >= cutoffMs),
    [snapshot.sales, cutoffMs]
  );

  const periodExpenses = useMemo(
    () => snapshot.expenses.filter((e) => new Date(e.createdAt).getTime() >= cutoffMs),
    [snapshot.expenses, cutoffMs]
  );

  const metrics = useMemo(() => {
    const revenue = periodSales.reduce((s, x) => s + x.totalAmount, 0);
    const cashPaid = periodSales.reduce((s, x) => s + x.paidAmount, 0);
    const creditGiven = periodSales.reduce((s, x) => s + x.creditAmount, 0);
    const expenses = periodExpenses.reduce((s, x) => s + x.amount, 0);
    const cogs = periodSales.reduce((s, sale) => {
      return (
        s +
        sale.items.reduce((isum, it) => {
          const prod = snapshot.products.find((p) => p.id === it.productId);
          return isum + (prod ? prod.costPrice : it.unitPrice * 0.84) * it.quantity;
        }, 0)
      );
    }, 0);
    const netProfit = Math.round(revenue - cogs - expenses);

    const productMap = new Map<string, { name: string; qty: number; rev: number; unit: string }>();
    for (const s of periodSales) {
      for (const it of s.items) {
        const cur = productMap.get(it.productName) || {
          name: it.productName,
          qty: 0,
          rev: 0,
          unit: it.unit,
        };
        cur.qty += it.quantity;
        cur.rev += it.lineTotal;
        productMap.set(it.productName, cur);
      }
    }
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 5);

    return { revenue, cashPaid, creditGiven, expenses, netProfit, topProducts };
  }, [periodSales, periodExpenses, snapshot.products]);

  const handleExportCsv = () => {
    const rows = [
      ['Invoice', 'Date', 'PaymentMode', 'TotalAmount', 'PaidAmount', 'CreditAmount', 'Customer', 'Items'],
      ...periodSales.map((s) => [
        s.invoiceNumber,
        s.createdAt,
        s.paymentMode,
        String(s.totalAmount),
        String(s.paidAmount),
        String(s.creditAmount),
        s.customerName || 'Walk-in',
        s.items.map((i) => `${i.productName} (${i.quantity} ${i.unit})`).join('; '),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${snapshot.shop.code}-${period}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    setInsightError(null);

    if (!isOnline) {
      const low = snapshot.products.filter((p) => p.stock <= p.minStock);
      const localReport: AIInsightReport = {
        id: `ins-local-${Date.now()}`,
        shopId: snapshot.shop.id,
        language,
        summary: `Offline summary: ${periodSales.length} sales (${formatINR(metrics.revenue)}) and ${formatINR(metrics.expenses)} expenses recorded.`,
        restockingAlerts: low.map((p) => ({
          productName: p.name,
          currentStock: p.stock,
          minStock: p.minStock,
          suggestion: `Restock at least ${Math.max(p.minStock * 2 - p.stock, 5)} ${p.unit}.`,
        })),
        salesTrends: metrics.topProducts.map(
          (tp) => `${tp.name} generated ${formatINR(tp.rev)} (${tp.qty} ${tp.unit} sold).`
        ),
        creditAlerts: snapshot.customers
          .filter((c) => c.udharBalance > 0)
          .map((c) => `${c.name} has ${formatINR(c.udharBalance)} pending Udhar.`),
        generatedAt: new Date().toISOString(),
      };
      setInsights(localReport);
      await saveInsightLocal(localReport);
      setLoadingInsights(false);
      return;
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers,
        body: JSON.stringify({ shopId: snapshot.shop.id, language }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'Could not generate AI insights');
      }
      const data = (await res.json()) as AIInsightReport;
      setInsights(data);
      await saveInsightLocal(data);
    } catch (err) {
      setInsightError(err instanceof Error ? err.message : 'Insights unavailable');
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t.nav.reports}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily, weekly, and monthly profit reports with AI restocking advice
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl">
            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                  period === p
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="min-h-[40px] px-3.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Period Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Total Revenue</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 font-mono-tabular">
            {formatINR(metrics.revenue)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono-tabular">
            {periodSales.length} invoices
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Cash / UPI Collected</div>
          <div className="mt-1.5 text-2xl font-bold text-teal-700 font-mono-tabular">
            {formatINR(metrics.cashPaid)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono-tabular">
            Credit: {formatINR(metrics.creditGiven)}
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Operating Expenses</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 font-mono-tabular">
            {formatINR(metrics.expenses)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono-tabular">
            {periodExpenses.length} entries
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Est. Net Profit</div>
          <div
            className={`mt-1.5 text-2xl font-bold font-mono-tabular ${
              metrics.netProfit >= 0 ? 'text-teal-700' : 'text-rose-600'
            }`}
          >
            {formatINR(metrics.netProfit)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Margin after expenses</div>
        </div>
      </div>

      {/* Top Selling Products */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-700" />
            <span>Top Selling Items ({period})</span>
          </h2>
        </div>
        {metrics.topProducts.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No sales recorded in this period yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {metrics.topProducts.map((tp, idx) => (
              <div key={idx} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-900">{tp.name}</div>
                <div className="flex items-center gap-4 text-xs font-mono-tabular">
                  <span className="text-slate-500">
                    {tp.qty} {tp.unit}
                  </span>
                  <span className="font-bold text-slate-900">{formatINR(tp.rev)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Business Advisor */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-700" />
              <span>DukaanSaathi AI Insights</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Restocking suggestions, sales trends, and Udhar recovery priorities
            </p>
          </div>
          <button
            type="button"
            disabled={loadingInsights}
            onClick={() => void handleGenerateInsights()}
            className="min-h-[44px] px-4 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loadingInsights ? 'animate-spin' : ''}`} />
            <span>{loadingInsights ? 'Analyzing...' : t.actions.generateInsights}</span>
          </button>
        </div>

        {insightError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
            {insightError}
          </div>
        )}

        {insights ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 rounded-xl p-4 border border-slate-200">
              {insights.summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                <h3 className="text-xs font-bold text-amber-800 inline-flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Restocking Priority</span>
                </h3>
                {insights.restockingAlerts.length === 0 ? (
                  <p className="text-xs text-slate-500">Stock levels look healthy.</p>
                ) : (
                  <ul className="space-y-2 text-xs text-slate-700">
                    {insights.restockingAlerts.map((r, i) => (
                      <li key={i}>
                        <strong className="text-slate-900">{r.productName}</strong> ({r.currentStock} left) —{' '}
                        {r.suggestion}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                <h3 className="text-xs font-bold text-teal-800">Sales Trends</h3>
                <ul className="space-y-2 text-xs text-slate-700">
                  {insights.salesTrends.map((st, i) => (
                    <li key={i}>• {st}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                <h3 className="text-xs font-bold text-slate-900">Udhar & Cash Flow</h3>
                <ul className="space-y-2 text-xs text-slate-700">
                  {insights.creditAlerts.map((ca, i) => (
                    <li key={i}>• {ca}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 py-4">
            Click “{t.actions.generateInsights}” to analyze your live sales, inventory, and Udhar data.
          </div>
        )}
      </div>
    </div>
  );
};
