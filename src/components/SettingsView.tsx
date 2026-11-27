import React, { useState } from 'react';
import { Check, KeyRound, RefreshCw, RotateCcw, Store } from 'lucide-react';
import type { Language, ShopSnapshot } from '../types';
import { LANGUAGE_META, UI_TEXT } from '../lib/i18n';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsViewProps {
  snapshot: ShopSnapshot;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  isOnline: boolean;
  pendingSyncCount: number;
  onManualSync: () => Promise<void>;
  onCommitSettings: (payload: Record<string, unknown>) => Promise<void>;
  onSwitchShop: (snapshot: ShopSnapshot, token?: string | null) => Promise<void>;
  onResetDemo: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  snapshot,
  language,
  onChangeLanguage,
  isOnline,
  pendingSyncCount,
  onManualSync,
  onCommitSettings,
  onSwitchShop,
  onResetDemo,
}) => {
  const t = UI_TEXT[language];
  const [name, setName] = useState(snapshot.shop.name);
  const [ownerName, setOwnerName] = useState(snapshot.shop.ownerName);
  const [phone, setPhone] = useState(snapshot.shop.phone);
  const [city, setCity] = useState(snapshot.shop.city);
  const [address, setAddress] = useState(snapshot.shop.address);
  const [lowStockDefault, setLowStockDefault] = useState(String(snapshot.shop.lowStockDefault));
  const [categoriesText, setCategoriesText] = useState(snapshot.shop.categories.join(', '));
  const [voiceReadback, setVoiceReadback] = useState(snapshot.shop.voiceReadbackEnabled);
  const [savedFlag, setSavedFlag] = useState(false);

  // Create or Join Shop
  const [joinCode, setJoinCode] = useState('');
  const [joinPin, setJoinPin] = useState('');
  const [newShopName, setNewShopName] = useState('');
  const [newShopOwner, setNewShopOwner] = useState('');
  const [newShopPin, setNewShopPin] = useState('');
  const [shopSwitchMsg, setShopSwitchMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cats = categoriesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await onCommitSettings({
      name: name.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      city: city.trim(),
      address: address.trim(),
      lowStockDefault: Math.max(1, Number(lowStockDefault) || 8),
      categories: cats.length > 0 ? cats : snapshot.shop.categories,
      voiceReadbackEnabled: voiceReadback,
    });
    setSavedFlag(true);
    setTimeout(() => setSavedFlag(false), 2000);
  };

  const handleJoinShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setBusy(true);
    setShopSwitchMsg(null);
    try {
      const res = await fetch('/api/shops/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode.trim(), pin: joinPin.trim() || undefined }),
      });
      const data = (await res.json()) as {
        snapshot?: ShopSnapshot;
        token?: string;
        error?: string;
      };
      if (!res.ok || !data.snapshot) {
        setShopSwitchMsg(data.error || 'Could not open shop');
        return;
      }
      await onSwitchShop(data.snapshot, data.token || null);
      setJoinCode('');
      setJoinPin('');
      setShopSwitchMsg(`Switched to ${data.snapshot.shop.name}`);
    } catch {
      setShopSwitchMsg('Requires internet connection to join another shop.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim()) return;
    setBusy(true);
    setShopSwitchMsg(null);
    try {
      const res = await fetch('/api/shops/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newShopName.trim(),
          ownerName: newShopOwner.trim() || 'Shopkeeper',
          pin: newShopPin.trim() || undefined,
          isPublic: !newShopPin.trim(),
        }),
      });
      const data = (await res.json()) as {
        snapshot?: ShopSnapshot;
        token?: string;
        error?: string;
      };
      if (!res.ok || !data.snapshot) {
        setShopSwitchMsg(data.error || 'Could not create shop');
        return;
      }
      await onSwitchShop(data.snapshot, data.token || null);
      setNewShopName('');
      setNewShopOwner('');
      setNewShopPin('');
      setShopSwitchMsg(
        `Created shop! Save your code ${data.snapshot.shop.code} to sync across devices.`
      );
    } catch {
      setShopSwitchMsg('Requires internet connection to create a new shop.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t.nav.settings}</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Language preferences, shop details, offline sync, and cross-device shop access
        </p>
      </div>

      {/* Language & Voice */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Assistant & App Language</h2>
            <p className="text-xs text-slate-500">Switch anytime — voice replies follow your choice</p>
          </div>
          <div className="inline-flex p-1 bg-slate-100 rounded-xl">
            {(['en', 'hi', 'te'] as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => onChangeLanguage(lang)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold ${
                  language === lang
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {LANGUAGE_META[lang].nativeLabel}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between pt-3 border-t border-slate-100 cursor-pointer">
          <div>
            <div className="text-sm font-medium text-slate-900">Spoken Voice Read-Back</div>
            <div className="text-xs text-slate-500">Read confirmations and answers aloud</div>
          </div>
          <input
            type="checkbox"
            checked={voiceReadback}
            onChange={(e) => setVoiceReadback(e.target.checked)}
            className="h-5 w-5 accent-teal-700"
          />
        </label>
      </div>

      {/* Offline Synchronization & Device Installation */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Offline Synchronization & PWA</h2>
            <p className="text-xs text-slate-500 font-mono-tabular mt-0.5">
              Status: {isOnline ? t.status.synced : t.status.offline} · Pending queue: {pendingSyncCount}
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              disabled={!isOnline || busy}
              onClick={() => void onManualSync()}
              className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{t.status.syncNow}</span>
            </button>
            <div className="w-auto">
              <PWAInstallButton label={t.actions.installApp} compact />
            </div>
          </div>
        </div>
      </div>

      {/* Shop Profile Form */}
      <form
        onSubmit={(e) => void handleSaveProfile(e)}
        className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Shop Details & Rules</h2>
          <span className="text-xs font-mono-tabular text-slate-500">
            Code: {snapshot.shop.code} · {snapshot.shop.isPublic ? 'Public Mode' : 'PIN Protected'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Shop Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Owner Name</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">City / Region</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Default Low-Stock Alert Threshold
            </label>
            <input
              type="number"
              min="1"
              value={lowStockDefault}
              onChange={(e) => setLowStockDefault(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Product Categories (comma separated)
            </label>
            <input
              type="text"
              value={categoriesText}
              onChange={(e) => setCategoriesText(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {snapshot.shop.id === 'demo-kirana' ? (
            <button
              type="button"
              onClick={() => void onResetDemo()}
              className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.actions.resetDemo}</span>
            </button>
          ) : (
            <span />
          )}

          <button
            type="submit"
            className="min-h-[44px] px-5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 inline-flex items-center gap-2"
          >
            {savedFlag && <Check className="w-4 h-4" />}
            <span>{savedFlag ? 'Saved' : t.actions.save}</span>
          </button>
        </div>
      </form>

      {/* Cross-Device Shop Switcher & Private Shop Isolation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <form
          onSubmit={(e) => void handleJoinShop(e)}
          className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3"
        >
          <h3 className="text-sm font-bold text-slate-900 inline-flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-teal-700" />
            <span>Open Existing Shop (Cross-Device)</span>
          </h3>
          <p className="text-xs text-slate-500">
            Enter <code className="font-mono-tabular font-semibold">DEMO-KIRANA</code> for Public Demo Mode, or your private Shop Code.
          </p>
          <input
            type="text"
            required
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Shop Code (e.g. DEMO-KIRANA)"
            className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular uppercase"
          />
          <input
            type="password"
            value={joinPin}
            onChange={(e) => setJoinPin(e.target.value)}
            placeholder="PIN (leave empty for public shops)"
            className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            Open Shop
          </button>
        </form>

        <form
          onSubmit={(e) => void handleCreateShop(e)}
          className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3"
        >
          <h3 className="text-sm font-bold text-slate-900 inline-flex items-center gap-2">
            <Store className="w-4 h-4 text-teal-700" />
            <span>Create Isolated Shop</span>
          </h3>
          <p className="text-xs text-slate-500">
            Create your own store ledger. Add an optional 4+ digit PIN to keep records private.
          </p>
          <input
            type="text"
            required
            value={newShopName}
            onChange={(e) => setNewShopName(e.target.value)}
            placeholder="Your Shop Name"
            className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newShopOwner}
              onChange={(e) => setNewShopOwner(e.target.value)}
              placeholder="Owner Name"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
            />
            <input
              type="password"
              value={newShopPin}
              onChange={(e) => setNewShopPin(e.target.value)}
              placeholder="Optional PIN (4+)"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[44px] rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-50"
          >
            Create Shop
          </button>
        </form>
      </div>

      {shopSwitchMsg && (
        <div className="rounded-xl bg-teal-50 border border-teal-200 p-3.5 text-sm font-medium text-teal-900">
          {shopSwitchMsg}
        </div>
      )}
    </div>
  );
};
