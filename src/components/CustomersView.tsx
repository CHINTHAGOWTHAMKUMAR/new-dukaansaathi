import React, { useMemo, useState } from 'react';
import { Phone, Plus, Search, UserPlus } from 'lucide-react';
import type { Customer, Language, ShopSnapshot } from '../types';
import { UI_TEXT, formatINR, formatShortDate } from '../lib/i18n';
import { makeId } from '../lib/syncEngine';

interface CustomersViewProps {
  snapshot: ShopSnapshot;
  language: Language;
  onCommitMutation: (
    entityType: 'customer',
    action: 'create' | 'update',
    payload: Record<string, unknown>
  ) => Promise<{ warnings: string[] }>;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  snapshot,
  language,
  onCommitMutation,
}) => {
  const t = UI_TEXT[language];
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const cust: Customer = {
      id: makeId('cust'),
      shopId: snapshot.shop.id,
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim() || undefined,
      udharBalance: 0,
      lastActivityAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onCommitMutation('customer', 'create', cust as unknown as Record<string, unknown>);
    setName('');
    setPhone('');
    setAddress('');
    setShowAdd(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return snapshot.customers.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q)
    );
  }, [snapshot.customers, search]);

  const customerSales = useMemo(() => {
    if (!selected) return [];
    return snapshot.sales.filter((s) => s.customerId === selected.id);
  }, [snapshot.sales, selected]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t.nav.customers}</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono-tabular">
            {snapshot.customers.length} customers registered
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>{showAdd ? t.actions.cancel : t.actions.addCustomer}</span>
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={(e) => void handleAddCustomer(e)}
          className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Customer Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Suresh Babu"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98480 00000"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Address / Locality</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Colony / Street"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-700"
            >
              {t.actions.cancel}
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{t.actions.save}</span>
            </button>
          </div>
        </form>
      )}

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer by name, phone, or area..."
          className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-teal-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No customers found.</div>
          ) : (
            filtered.map((cust) => (
              <button
                key={cust.id}
                type="button"
                onClick={() => setSelected(cust)}
                className={`w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors ${
                  selected?.id === cust.id ? 'bg-teal-50/50' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{cust.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 font-mono-tabular">
                      <Phone className="w-3 h-3" />
                      {cust.phone || 'N/A'}
                    </span>
                    {cust.address && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{cust.address}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`text-sm font-bold font-mono-tabular ${
                      cust.udharBalance > 0 ? 'text-amber-700' : 'text-teal-700'
                    }`}
                  >
                    {formatINR(cust.udharBalance)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {cust.udharBalance > 0 ? 'Pending Udhar' : 'Settled'}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          {selected ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">{selected.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5 font-mono-tabular">
                  {selected.phone || 'No phone'} {selected.address ? `· ${selected.address}` : ''}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                <div className="text-xs text-slate-500">Current Udhar Balance</div>
                <div className="text-xl font-bold text-amber-700 font-mono-tabular mt-1">
                  {formatINR(selected.udharBalance)}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-700 mb-2">
                  Linked Bills ({customerSales.length})
                </h3>
                {customerSales.length === 0 ? (
                  <p className="text-xs text-slate-500">No linked invoices yet.</p>
                ) : (
                  <div className="space-y-2">
                    {customerSales.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-mono-tabular font-semibold text-slate-800">
                            {s.invoiceNumber}
                          </div>
                          <div className="text-slate-500">{formatShortDate(s.createdAt)}</div>
                        </div>
                        <div className="font-mono-tabular font-bold text-slate-900">
                          {formatINR(s.totalAmount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-slate-500">
              Select a customer to view their purchase and Udhar summary.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
