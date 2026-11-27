import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, MessageSquare, Plus } from 'lucide-react';
import type { Customer, Language, ShopSnapshot } from '../types';
import { UI_TEXT, formatINR, formatShortDate, formatTime } from '../lib/i18n';
import { makeId } from '../lib/syncEngine';

interface UdharViewProps {
  snapshot: ShopSnapshot;
  language: Language;
  onCommitMutation: (
    entityType: 'udhar',
    action: 'create',
    payload: Record<string, unknown>
  ) => Promise<{ warnings: string[] }>;
}

export const UdharView: React.FC<UdharViewProps> = ({
  snapshot,
  language,
  onCommitMutation,
}) => {
  const t = UI_TEXT[language];
  const [selectedCustomerId, setSelectedCustomerId] = useState(snapshot.customers[0]?.id || '');
  const [entryType, setEntryType] = useState<'credit' | 'repayment'>('credit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const totalPending = useMemo(
    () => snapshot.customers.reduce((sum, c) => sum + c.udharBalance, 0),
    [snapshot.customers]
  );

  const handleRecordUdhar = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = snapshot.customers.find((c) => c.id === selectedCustomerId);
    const numAmt = Number(amount);
    if (!cust || !Number.isFinite(numAmt) || numAmt <= 0) return;

    await onCommitMutation('udhar', 'create', {
      id: makeId('udh'),
      customerId: cust.id,
      customerName: cust.name,
      type: entryType,
      amount: numAmt,
      note: note.trim() || undefined,
      source: 'manual',
      createdAt: new Date().toISOString(),
    });
    setAmount('');
    setNote('');
    setShowForm(false);
  };

  const handleSendReminder = async (cust: Customer) => {
    const message =
      language === 'te'
        ? `నమస్కారం ${cust.name} గారు, ${snapshot.shop.name} వద్ద మీ ఉధార్ బాకీ ${formatINR(cust.udharBalance)} ఉంది. వీలైనప్పుడు చెల్లించగలరు.`
        : language === 'hi'
          ? `नमस्ते ${cust.name} जी, ${snapshot.shop.name} पर आपका ${formatINR(cust.udharBalance)} उधार बकाया है। कृपया सुविधा अनुसार जमा करें।`
          : `Namaste ${cust.name}, friendly reminder from ${snapshot.shop.name}: your pending Udhar balance is ${formatINR(cust.udharBalance)}. Thank you!`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Payment Reminder', text: message });
        return;
      } catch {
        // Fallback to copy
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setCopiedId(cust.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t.nav.udhar}</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono-tabular">
            Total Pending Credit: <strong className="text-amber-700">{formatINR(totalPending)}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showForm ? t.actions.cancel : 'Record Credit / Repayment'}</span>
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => void handleRecordUdhar(e)}
          className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4"
        >
          <div className="inline-flex p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setEntryType('credit')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                entryType === 'credit'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Given on Credit (+ Udhar)
            </button>
            <button
              type="button"
              onClick={() => setEntryType('repayment')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                entryType === 'repayment'
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Payment Received (- Udhar)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                required
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm bg-white"
              >
                {snapshot.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Due: {formatINR(c.udharBalance)})
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
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Note (Optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Monthly groceries"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Customer Balances */}
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">Customer Balances</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {snapshot.customers.map((cust) => (
              <div key={cust.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{cust.name}</div>
                  <div className="text-xs text-slate-500 font-mono-tabular">
                    {cust.phone || 'No phone'} · Last {formatShortDate(cust.lastActivityAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <div
                    className={`text-sm font-bold font-mono-tabular ${
                      cust.udharBalance > 0 ? 'text-amber-700' : 'text-teal-700'
                    }`}
                  >
                    {formatINR(cust.udharBalance)}
                  </div>
                  {cust.udharBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleSendReminder(cust)}
                      className="min-h-[38px] px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      {copiedId === cust.id ? (
                        <Check className="w-3.5 h-3.5 text-teal-700" />
                      ) : (
                        <MessageSquare className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedId === cust.id ? 'Copied' : t.actions.sendReminder}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Udhar Ledger Timeline */}
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">Ledger History</h2>
          </div>
          {snapshot.udharEntries.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No Udhar entries recorded yet.</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
              {snapshot.udharEntries.map((entry) => (
                <div key={entry.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        entry.type === 'credit'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-teal-50 text-teal-700'
                      }`}
                    >
                      {entry.type === 'credit' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {entry.customerName}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {entry.type === 'credit' ? 'Credit' : 'Repayment'}
                        {entry.note ? ` · ${entry.note}` : ''} · {formatShortDate(entry.createdAt)}{' '}
                        {formatTime(entry.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-bold font-mono-tabular ${
                        entry.type === 'credit' ? 'text-amber-700' : 'text-teal-700'
                      }`}
                    >
                      {entry.type === 'credit' ? '+' : '-'}
                      {formatINR(entry.amount)}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono-tabular">
                      Bal {formatINR(entry.balanceAfter)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
