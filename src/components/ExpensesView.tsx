import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ExpensePaymentMode, Language, ShopSnapshot } from '../types';
import { UI_TEXT, formatINR, formatShortDate, formatTime } from '../lib/i18n';
import { makeId } from '../lib/syncEngine';

interface ExpensesViewProps {
  snapshot: ShopSnapshot;
  language: Language;
  onCommitMutation: (
    entityType: 'expense',
    action: 'create' | 'delete',
    payload: Record<string, unknown>
  ) => Promise<{ warnings: string[] }>;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  snapshot,
  language,
  onCommitMutation,
}) => {
  const t = UI_TEXT[language];
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(snapshot.shop.expenseCategories[0] || 'Electricity');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<ExpensePaymentMode>('cash');
  const [note, setNote] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(amount);
    if (!title.trim() || !Number.isFinite(numAmt) || numAmt <= 0) return;
    await onCommitMutation('expense', 'create', {
      id: makeId('exp'),
      title: title.trim(),
      category,
      amount: numAmt,
      paymentMode,
      note: note.trim() || undefined,
      source: 'manual',
      createdAt: new Date().toISOString(),
    });
    setTitle('');
    setAmount('');
    setNote('');
    setShowForm(false);
  };

  const filtered = useMemo(
    () => snapshot.expenses.filter((e) => catFilter === 'all' || e.category === catFilter),
    [snapshot.expenses, catFilter]
  );

  const totalExpenses = useMemo(
    () => filtered.reduce((sum, e) => sum + e.amount, 0),
    [filtered]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t.nav.expenses}</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono-tabular">
            Total Shown: <strong className="text-slate-900">{formatINR(totalExpenses)}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showForm ? t.actions.cancel : t.actions.logExpense}</span>
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => void handleSave(e)}
          className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Expense Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Electricity Bill"
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
                {snapshot.shop.expenseCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹)</label>
              <input
                type="number"
                required
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="300"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Paid Via</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as ExpensePaymentMode)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm bg-white"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank Transfer</option>
              </select>
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

      {/* Category Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCatFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
            catFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
          }`}
        >
          All Categories
        </button>
        {snapshot.shop.expenseCategories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCatFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              catFilter === c ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Expense List */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No expenses logged in this category.</div>
        ) : (
          filtered.map((exp) => (
            <div key={exp.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{exp.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {exp.category} · {exp.paymentMode.toUpperCase()} · {formatShortDate(exp.createdAt)}{' '}
                  {formatTime(exp.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-sm font-bold text-slate-900 font-mono-tabular">
                  {formatINR(exp.amount)}
                </div>
                <button
                  type="button"
                  aria-label="Delete expense"
                  onClick={() => void onCommitMutation('expense', 'delete', { id: exp.id })}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
