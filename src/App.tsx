import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CloudOff,
  Home,
  Menu,
  Mic,
  Package,
  Receipt,
  RefreshCw,
  Settings,
  Users,
  Wallet,
  Wifi,
  X,
} from 'lucide-react';
import type {
  ActiveTab,
  Language,
  Sale,
  ShopSnapshot,
  SyncActionType,
  SyncEntityType,
} from './types';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { LANGUAGE_META, UI_TEXT } from './lib/i18n';
import {
  getOutboxForShop,
  getPref,
  getSavedLanguage,
  getSnapshotLocal,
  saveLanguage,
  saveSnapshotLocal,
  setPref,
} from './lib/offlineDb';
import {
  fetchShopSnapshot,
  flushOutbox,
  recordMutationAndSync,
} from './lib/syncEngine';
import { DashboardView } from './components/DashboardView';
import { SalesBillingView } from './components/SalesBillingView';
import { InventoryView } from './components/InventoryView';
import { UdharView } from './components/UdharView';
import { CustomersView } from './components/CustomersView';
import { ExpensesView } from './components/ExpensesView';
import { ReportsInsightsView } from './components/ReportsInsightsView';
import { SettingsView } from './components/SettingsView';
import { VoiceAssistantDrawer } from './components/VoiceAssistantDrawer';
import { InvoiceModal } from './components/InvoiceModal';
import { PWAInstallButton } from './components/PWAInstallButton';

export default function App() {
  const isOnline = useOnlineStatus();
  const [language, setLanguage] = useState<Language>('en');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [snapshot, setSnapshot] = useState<ShopSnapshot | null>(null);
  const [activeShopId, setActiveShopId] = useState<string>('demo-kirana');
  const [authToken, setAuthToken] = useState<string | null>(null); // Held in memory only
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [voiceOpen, setVoiceOpen] = useState<boolean>(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState<boolean>(false);
  const [activeInvoice, setActiveInvoice] = useState<Sale | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const t = UI_TEXT[language];

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((cur) => (cur === msg ? null : cur));
    }, 4000);
  }, []);

  // Load initial preferences & shop snapshot (offline-first!)
  useEffect(() => {
    let mounted = true;
    async function init() {
      const savedLang = await getSavedLanguage();
      const savedShopId = await getPref<string>('activeShopId', 'demo-kirana');
      if (!mounted) return;
      setLanguage(savedLang);
      setActiveShopId(savedShopId);

      // Instant local cache hydration
      const cached = await getSnapshotLocal(savedShopId);
      if (cached && mounted) {
        setSnapshot(cached);
        setLoading(false);
      }

      try {
        const { snapshot: fresh } = await fetchShopSnapshot(savedShopId, authToken);
        const outbox = await getOutboxForShop(savedShopId);
        if (mounted) {
          setSnapshot(fresh);
          setPendingSyncCount(outbox.length);
          setLoadError(null);
        }
      } catch (err) {
        if (!cached && mounted) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load shop data.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void init();
    return () => {
      mounted = false;
    };
  }, [activeShopId, authToken]);

  const handleManualSync = useCallback(async () => {
    if (!snapshot || !isOnline) return;
    setIsSyncing(true);
    try {
      const res = await flushOutbox(snapshot.shop.id, authToken);
      if (res) {
        setSnapshot(res.snapshot);
        setPendingSyncCount(res.pendingCount);
        if (res.warnings.length > 0) {
          showToast(res.warnings[0]);
        }
      }
    } finally {
      setIsSyncing(false);
    }
  }, [snapshot, isOnline, authToken, showToast]);

  // Automatic background sync when coming back online
  useEffect(() => {
    if (isOnline && snapshot) {
      void handleManualSync();
    }
  }, [isOnline]);

  // Periodic sync check every 30s if pending operations exist
  useEffect(() => {
    if (!isOnline || pendingSyncCount === 0) return;
    const timer = window.setInterval(() => {
      void handleManualSync();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [isOnline, pendingSyncCount, handleManualSync]);

  const handleChangeLanguage = (lang: Language) => {
    setLanguage(lang);
    void saveLanguage(lang);
  };

  const handleCommitMutation = useCallback(
    async (
      entityType: SyncEntityType,
      action: SyncActionType,
      payload: Record<string, unknown>,
      forceDuplicate = false
    ) => {
      if (!snapshot) return { warnings: [] };
      const res = await recordMutationAndSync({
        snapshot,
        entityType,
        action,
        payload,
        token: authToken,
        forceDuplicate,
      });
      setSnapshot(res.nextSnapshot);
      setPendingSyncCount(res.pendingCount);
      if (res.warnings.length > 0) {
        showToast(res.warnings[0]);
      }
      return { warnings: res.warnings };
    },
    [snapshot, authToken, showToast]
  );

  const handleSwitchShop = async (nextSnapshot: ShopSnapshot, token?: string | null) => {
    setAuthToken(token || null);
    setActiveShopId(nextSnapshot.shop.id);
    setSnapshot(nextSnapshot);
    await setPref('activeShopId', nextSnapshot.shop.id);
    await saveSnapshotLocal(nextSnapshot);
    const outbox = await getOutboxForShop(nextSnapshot.shop.id);
    setPendingSyncCount(outbox.length);
    setActiveTab('dashboard');
  };

  const handleResetDemo = async () => {
    try {
      const res = await fetch('/api/shops/demo-kirana/reset-demo', { method: 'POST' });
      if (res.ok) {
        const fresh = (await res.json()) as ShopSnapshot;
        setSnapshot(fresh);
        await saveSnapshotLocal(fresh);
        setPendingSyncCount(0);
        showToast('Demo data restored.');
      }
    } catch {
      showToast('Connect to internet to reset demo data.');
    }
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: t.nav.dashboard, icon: <Home className="w-4 h-4" /> },
    { id: 'sales', label: t.nav.sales, icon: <Receipt className="w-4 h-4" /> },
    { id: 'inventory', label: t.nav.inventory, icon: <Package className="w-4 h-4" /> },
    { id: 'udhar', label: t.nav.udhar, icon: <Wallet className="w-4 h-4" /> },
    { id: 'customers', label: t.nav.customers, icon: <Users className="w-4 h-4" /> },
    { id: 'expenses', label: t.nav.expenses, icon: <BookOpen className="w-4 h-4" /> },
    { id: 'reports', label: t.nav.reports, icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'settings', label: t.nav.settings, icon: <Settings className="w-4 h-4" /> },
  ];

  if (loading && !snapshot) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <div className="h-8 w-44 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
            <div className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError && !snapshot) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 text-center space-y-4">
          <h1 className="text-lg font-bold text-slate-900">Unable to Open Shop</h1>
          <p className="text-sm text-slate-600">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setActiveShopId('demo-kirana');
              setAuthToken(null);
              void setPref('activeShopId', 'demo-kirana');
            }}
            className="min-h-[44px] px-5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800"
          >
            Open Public Demo Shop
          </button>
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop / Tablet Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200 min-h-screen sticky top-0 max-h-screen">
        <div className="px-5 py-4 border-b border-slate-200">
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('dashboard');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap block"
          >
            DukaanSaathi
          </a>
          <div className="text-xs text-slate-500 truncate mt-0.5">{snapshot.shop.name}</div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[42px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-50 text-teal-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              {isOnline ? (
                <Wifi className="w-3.5 h-3.5 text-teal-700" />
              ) : (
                <CloudOff className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>
                {isOnline
                  ? pendingSyncCount > 0
                    ? `${pendingSyncCount} ${t.status.pendingSync}`
                    : t.status.synced
                  : `${t.status.offline}${pendingSyncCount > 0 ? ` · ${pendingSyncCount}` : ''}`}
              </span>
            </span>
            {isOnline && (
              <button
                type="button"
                onClick={() => void handleManualSync()}
                disabled={isSyncing}
                aria-label="Sync now"
                className="text-teal-700 hover:text-teal-900 p-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
          <PWAInstallButton label={t.actions.installApp} />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract (Desktop & Mobile <= 52px on mobile) */}
        <header className="sticky top-0 z-30 h-[52px] lg:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              DukaanSaathi
            </span>
            <span className="hidden lg:inline text-sm font-semibold text-slate-900 whitespace-nowrap truncate">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg">
              {(['en', 'hi', 'te'] as Language[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleChangeLanguage(lang)}
                  className={`px-2 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    language === lang
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {LANGUAGE_META[lang].nativeLabel}
                </button>
              ))}
            </div>

            {/* Mobile Connectivity Dot/Label */}
            {!isOnline && (
              <span
                className="lg:hidden inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 whitespace-nowrap"
                title="Offline Mode"
              >
                <CloudOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.status.offline}</span>
              </span>
            )}

            {/* Desktop Primary CTA */}
            <button
              type="button"
              onClick={() => setVoiceOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
            >
              <Mic className="w-4 h-4" />
              <span>{t.actions.speak}</span>
            </button>
          </div>
        </header>

        {/* Scrollable View Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              snapshot={snapshot}
              language={language}
              onOpenVoice={() => setVoiceOpen(true)}
              onNavigate={setActiveTab}
              onViewInvoice={setActiveInvoice}
            />
          )}
          {activeTab === 'sales' && (
            <SalesBillingView
              snapshot={snapshot}
              language={language}
              onCommitMutation={(entity, action, payload, force) =>
                handleCommitMutation(entity, action, payload, force)
              }
              onViewInvoice={setActiveInvoice}
            />
          )}
          {activeTab === 'inventory' && (
            <InventoryView
              snapshot={snapshot}
              language={language}
              onCommitMutation={(entity, action, payload) =>
                handleCommitMutation(entity, action, payload)
              }
            />
          )}
          {activeTab === 'udhar' && (
            <UdharView
              snapshot={snapshot}
              language={language}
              onCommitMutation={(entity, action, payload) =>
                handleCommitMutation(entity, action, payload)
              }
            />
          )}
          {activeTab === 'customers' && (
            <CustomersView
              snapshot={snapshot}
              language={language}
              onCommitMutation={(entity, action, payload) =>
                handleCommitMutation(entity, action, payload)
              }
            />
          )}
          {activeTab === 'expenses' && (
            <ExpensesView
              snapshot={snapshot}
              language={language}
              onCommitMutation={(entity, action, payload) =>
                handleCommitMutation(entity, action, payload)
              }
            />
          )}
          {activeTab === 'reports' && (
            <ReportsInsightsView
              snapshot={snapshot}
              language={language}
              isOnline={isOnline}
              authToken={authToken}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsView
              snapshot={snapshot}
              language={language}
              onChangeLanguage={handleChangeLanguage}
              isOnline={isOnline}
              pendingSyncCount={pendingSyncCount}
              onManualSync={handleManualSync}
              onCommitSettings={async (payload) => {
                await handleCommitMutation('settings', 'update', payload);
              }}
              onSwitchShop={handleSwitchShop}
              onResetDemo={handleResetDemo}
            />
          )}
        </main>
      </div>

      {/* Floating Ergonomic Mic Button on Mobile */}
      <button
        type="button"
        onClick={() => setVoiceOpen(true)}
        aria-label={t.voice.tapToSpeak}
        className="sm:hidden fixed bottom-[70px] right-4 z-40 h-14 w-14 rounded-full bg-teal-700 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        <Mic className="w-6 h-6" />
      </button>

      {/* Mobile Bottom Thumb-Zone Navigation (56px height) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-[56px] pb-safe bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 items-center"
        aria-label="Mobile navigation"
      >
        {(
          [
            { id: 'dashboard', label: t.nav.dashboard, icon: Home },
            { id: 'sales', label: t.nav.sales, icon: Receipt },
            { id: 'udhar', label: t.nav.udhar, icon: Wallet },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setMoreDrawerOpen(false);
              }}
              className={`h-full flex flex-col items-center justify-center gap-0.5 ${
                active ? 'text-teal-700 font-semibold' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] leading-tight truncate max-w-[76px]">{tab.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreDrawerOpen((v) => !v)}
          className={`h-full flex flex-col items-center justify-center gap-0.5 ${
            ['inventory', 'customers', 'expenses', 'reports', 'settings'].includes(activeTab)
              ? 'text-teal-700 font-semibold'
              : 'text-slate-500'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] leading-tight">{t.nav.more}</span>
        </button>
      </nav>

      {/* Mobile "More" Bottom Sheet */}
      {moreDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-end"
          onClick={() => setMoreDrawerOpen(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl p-5 pb-8 space-y-3 border-t border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-sm font-bold text-slate-900">All Modules</span>
              <button
                type="button"
                onClick={() => setMoreDrawerOpen(false)}
                aria-label="Close menu"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {navItems
                .filter((i) => !['dashboard', 'sales', 'udhar'].includes(i.id))
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMoreDrawerOpen(false);
                    }}
                    className={`min-h-[48px] px-4 rounded-xl border flex items-center gap-2.5 text-sm font-medium ${
                      activeTab === item.id
                        ? 'border-teal-600 bg-teal-50 text-teal-900'
                        : 'border-slate-200 bg-white text-slate-800'
                    }`}
                  >
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
            </div>
            <div className="pt-2">
              <PWAInstallButton label={t.actions.installApp} />
            </div>
          </div>
        </div>
      )}

      {/* Voice Assistant Drawer */}
      <VoiceAssistantDrawer
        isOpen={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        language={language}
        onChangeLanguage={handleChangeLanguage}
        snapshot={snapshot}
        isOnline={isOnline}
        authToken={authToken}
        onCommitMutation={handleCommitMutation}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setVoiceOpen(false);
        }}
      />

      {/* Printable / Shareable Invoice Modal */}
      <InvoiceModal
        sale={activeInvoice}
        shop={snapshot.shop}
        onClose={() => setActiveInvoice(null)}
      />

      {/* Non-intrusive Toast Notification */}
      {toast && (
        <div className="fixed top-16 right-4 z-50 max-w-sm rounded-xl bg-slate-900 text-white px-4 py-3 text-xs font-medium shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
