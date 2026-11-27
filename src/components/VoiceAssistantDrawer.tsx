import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  Customer,
  Language,
  PaymentMode,
  Product,
  ShopSnapshot,
  VoiceIntentResult,
} from '../types';
import {
  DEMO_VOICE_COMMANDS,
  LANGUAGE_META,
  SPEECH_LOCALE,
  UI_TEXT,
  formatINR,
} from '../lib/i18n';
import { parseCommandOffline } from '../lib/offlineNlu';
import { makeId } from '../lib/syncEngine';

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface VoiceAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  snapshot: ShopSnapshot;
  isOnline: boolean;
  authToken?: string | null;
  onCommitMutation: (
    entityType: 'sale' | 'udhar' | 'product' | 'customer' | 'expense',
    action: 'create' | 'update',
    payload: Record<string, unknown>,
    forceDuplicate?: boolean
  ) => Promise<{ warnings: string[] }>;
  onNavigateTab: (tab: 'dashboard' | 'sales' | 'inventory' | 'udhar' | 'reports') => void;
}

export const VoiceAssistantDrawer: React.FC<VoiceAssistantDrawerProps> = ({
  isOpen,
  onClose,
  language,
  onChangeLanguage,
  snapshot,
  isOnline,
  authToken,
  onCommitMutation,
  onNavigateTab,
}) => {
  const t = UI_TEXT[language];
  const [isListening, setIsListening] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptInput, setTranscriptInput] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [lowConfidenceWarning, setLowConfidenceWarning] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceIntentResult | null>(null);
  const [readbackEnabled, setReadbackEnabled] = useState(
    snapshot.shop.voiceReadbackEnabled ?? true
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Editable confirmation draft fields
  const [draftProductName, setDraftProductName] = useState('');
  const [draftProductId, setDraftProductId] = useState('');
  const [draftQty, setDraftQty] = useState<number>(1);
  const [draftUnit, setDraftUnit] = useState('kg');
  const [draftAmount, setDraftAmount] = useState<number>(0);
  const [draftCustomerName, setDraftCustomerName] = useState('');
  const [draftCustomerId, setDraftCustomerId] = useState('');
  const [draftPaymentMode, setDraftPaymentMode] = useState<PaymentMode>('cash');
  const [draftCategory, setDraftCategory] = useState('Other');
  const [draftTitle, setDraftTitle] = useState('');
  const [createNewProductFlag, setCreateNewProductFlag] = useState(false);
  const [createNewCustomerFlag, setCreateNewCustomerFlag] = useState(false);
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopListening();
    }
  }, [isOpen]);

  const stopListening = () => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const speakResponse = async (text: string, lang: Language) => {
    if (!readbackEnabled || !text.trim()) return;

    // Try Gemini TTS when online for rich Indian multilingual clarity
    if (isOnline) {
      try {
        const res = await fetch('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language: lang }),
        });
        if (res.ok) {
          const data = (await res.json()) as { audioBase64?: string };
          if (data.audioBase64) {
            if (audioPlayerRef.current) {
              audioPlayerRef.current.pause();
            }
            const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
            audioPlayerRef.current = audio;
            await audio.play().catch(() => {
              fallbackBrowserSpeak(text, lang);
            });
            return;
          }
        }
      } catch {
        // Fall back to Web Speech Synthesis
      }
    }

    fallbackBrowserSpeak(text, lang);
  };

  const fallbackBrowserSpeak = (text: string, lang: Language) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = SPEECH_LOCALE[lang];
      utter.rate = 0.96;
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore TTS errors
    }
  };

  const populateDraftFromResult = (res: VoiceIntentResult) => {
    const ext = res.extracted || {};
    const matchedProd =
      snapshot.products.find((p) => p.id === ext.productId) ||
      snapshot.products.find(
        (p) => ext.productName && p.name.toLowerCase() === ext.productName.toLowerCase()
      );
    const matchedCust =
      snapshot.customers.find((c) => c.id === ext.customerId) ||
      snapshot.customers.find(
        (c) => ext.customerName && c.name.toLowerCase() === ext.customerName.toLowerCase()
      );

    setDraftProductId(matchedProd?.id || '');
    setDraftProductName(matchedProd?.name || ext.productName || res.unknownProducts?.[0] || '');
    setDraftQty(ext.quantity && ext.quantity > 0 ? ext.quantity : 1);
    setDraftUnit(matchedProd?.unit || ext.unit || 'kg');

    const calculatedAmt =
      ext.amount && ext.amount > 0
        ? ext.amount
        : matchedProd
          ? Math.round((ext.quantity || 1) * matchedProd.price * 100) / 100
          : 0;
    setDraftAmount(calculatedAmt);

    setDraftCustomerId(matchedCust?.id || '');
    setDraftCustomerName(
      matchedCust?.name || ext.customerName || res.unknownCustomers?.[0] || ''
    );
    setDraftPaymentMode(
      res.intent === 'RECORD_CREDIT'
        ? 'udhar'
        : (ext.paymentMode as PaymentMode) || 'cash'
    );
    setDraftCategory(ext.category || 'Other');
    setDraftTitle(ext.title || `${ext.category || 'Shop'} Expense`);

    setCreateNewProductFlag(
      !matchedProd && Boolean(ext.productName || res.unknownProducts?.length)
    );
    setCreateNewCustomerFlag(
      !matchedCust && Boolean(ext.customerName || res.unknownCustomers?.length)
    );
    setNewCustomerPhone('');

    // Check local duplicate warning (within 90s)
    const nowMs = Date.now();
    if (res.intent === 'RECORD_SALE' && calculatedAmt > 0) {
      const dup = snapshot.sales.find((s) => {
        const dt = nowMs - new Date(s.createdAt).getTime();
        return (
          dt < 90_000 &&
          Math.abs(s.totalAmount - calculatedAmt) < 0.01 &&
          (s.items[0]?.productName?.toLowerCase() || '') ===
            (matchedProd?.name || ext.productName || '').toLowerCase()
        );
      });
      setDuplicateWarning(dup ? `${t.voice.duplicateNotice} (${dup.invoiceNumber})` : null);
    } else if (
      (res.intent === 'RECORD_CREDIT' || res.intent === 'RECORD_REPAYMENT') &&
      calculatedAmt > 0 &&
      matchedCust
    ) {
      const dup = snapshot.udharEntries.find((u) => {
        const dt = nowMs - new Date(u.createdAt).getTime();
        return (
          dt < 90_000 &&
          u.customerId === matchedCust.id &&
          Math.abs(u.amount - calculatedAmt) < 0.01
        );
      });
      setDuplicateWarning(dup ? t.voice.duplicateNotice : null);
    } else {
      setDuplicateWarning(null);
    }
  };

  const processTranscript = async (text: string, confidence = 1) => {
    const clean = text.trim();
    if (!clean) return;
    setLastTranscript(clean);
    setTranscriptInput('');
    setMicError(null);
    setStatusMessage(null);
    setLowConfidenceWarning(confidence < 0.65);
    setIsProcessing(true);

    const pendingConfirmation = Boolean(result?.needsConfirmation);

    try {
      let parsed: VoiceIntentResult;

      if (isOnline) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (authToken) headers.Authorization = `Bearer ${authToken}`;
          const res = await fetch('/api/ai/interpret', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              shopId: snapshot.shop.id,
              transcript: clean,
              language,
              pendingConfirmation,
            }),
          });
          if (!res.ok) {
            throw new Error('AI unavailable');
          }
          parsed = (await res.json()) as VoiceIntentResult;
        } catch {
          parsed = parseCommandOffline({
            transcript: clean,
            language,
            pendingConfirmation,
            products: snapshot.products,
            customers: snapshot.customers,
            sales: snapshot.sales,
            expenses: snapshot.expenses,
          });
        }
      } else {
        parsed = parseCommandOffline({
          transcript: clean,
          language,
          pendingConfirmation,
          products: snapshot.products,
          customers: snapshot.customers,
          sales: snapshot.sales,
          expenses: snapshot.expenses,
        });
      }

      if (parsed.intent === 'CONFIRM_YES' && result?.needsConfirmation) {
        await handleConfirmTransaction(Boolean(duplicateWarning));
        return;
      }

      if (parsed.intent === 'CONFIRM_NO' && result?.needsConfirmation) {
        setResult(null);
        setStatusMessage(parsed.replyText);
        void speakResponse(parsed.replyText, language);
        return;
      }

      setResult(parsed);
      if (parsed.needsConfirmation) {
        populateDraftFromResult(parsed);
        void speakResponse(parsed.confirmationPrompt || parsed.replyText, language);
      } else {
        void speakResponse(parsed.replyText, language);
        if (parsed.intent === 'GENERATE_REPORT') {
          onNavigateTab('reports');
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmTransaction = async (forceDuplicate = false) => {
    if (!result) return;
    setIsProcessing(true);
    try {
      let activeProductId = draftProductId;
      let activeCustomerId = draftCustomerId;

      // Guided creation of unknown product
      if (
        (result.intent === 'RECORD_SALE' ||
          result.intent === 'ADD_PRODUCT' ||
          result.intent === 'UPDATE_STOCK') &&
        !activeProductId &&
        draftProductName.trim()
      ) {
        const newProdId = makeId('prod');
        const unitPrice =
          draftQty > 0 ? Math.round((draftAmount / draftQty) * 100) / 100 : draftAmount;
        const newProd: Product = {
          id: newProdId,
          shopId: snapshot.shop.id,
          name: draftProductName.trim(),
          category: snapshot.shop.categories[0] || 'Grains & Pulses',
          unit: draftUnit || 'kg',
          price: unitPrice || 0,
          costPrice: Math.round((unitPrice || 0) * 0.85),
          stock: result.intent === 'RECORD_SALE' ? Math.max(draftQty, 20) : draftQty,
          minStock: snapshot.shop.lowStockDefault,
          updatedAt: new Date().toISOString(),
        };
        await onCommitMutation('product', 'create', newProd as unknown as Record<string, unknown>);
        activeProductId = newProdId;
      }

      // Guided creation of unknown customer
      if (
        (result.intent === 'RECORD_CREDIT' ||
          result.intent === 'RECORD_REPAYMENT' ||
          (result.intent === 'RECORD_SALE' && draftPaymentMode === 'udhar')) &&
        !activeCustomerId &&
        draftCustomerName.trim()
      ) {
        const newCustId = makeId('cust');
        const newCust: Customer = {
          id: newCustId,
          shopId: snapshot.shop.id,
          name: draftCustomerName.trim(),
          phone: newCustomerPhone.trim(),
          udharBalance: 0,
          lastActivityAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await onCommitMutation('customer', 'create', newCust as unknown as Record<string, unknown>);
        activeCustomerId = newCustId;
      }

      if (result.intent === 'RECORD_SALE') {
        if (!draftAmount || draftAmount <= 0 || !draftProductName.trim()) {
          setStatusMessage('Please enter valid product and amount.');
          return;
        }
        const qty = Math.max(0.1, Number(draftQty) || 1);
        const unitPrice = Math.round((draftAmount / qty) * 100) / 100;
        const salePayload = {
          id: makeId('sale'),
          invoiceNumber: `INV-${1045 + snapshot.sales.length}`,
          items: [
            {
              productId: activeProductId || 'custom',
              productName: draftProductName.trim(),
              quantity: qty,
              unit: draftUnit || 'kg',
              unitPrice,
              lineTotal: draftAmount,
            },
          ],
          totalAmount: draftAmount,
          paymentMode: draftPaymentMode,
          paidAmount: draftPaymentMode === 'udhar' ? 0 : draftAmount,
          creditAmount: draftPaymentMode === 'udhar' ? draftAmount : 0,
          customerId: activeCustomerId || undefined,
          customerName: draftCustomerName.trim() || undefined,
          source: 'voice',
          transcript: lastTranscript,
          createdAt: new Date().toISOString(),
        };
        await onCommitMutation('sale', 'create', salePayload, forceDuplicate);
        const successMsg =
          language === 'te'
            ? 'అమ్మకం విజయవంతంగా నమోదు అయింది.'
            : language === 'hi'
              ? 'बिक्री सफलतापूर्वक दर्ज हो गई है।'
              : 'Sale recorded and inventory updated.';
        setStatusMessage(successMsg);
        setResult(null);
        setDuplicateWarning(null);
        void speakResponse(successMsg, language);
      } else if (result.intent === 'RECORD_CREDIT' || result.intent === 'RECORD_REPAYMENT') {
        if (!activeCustomerId || !draftAmount || draftAmount <= 0) {
          setStatusMessage('Please select or enter a customer name and valid amount.');
          return;
        }
        const entryType = result.intent === 'RECORD_REPAYMENT' ? 'repayment' : 'credit';
        await onCommitMutation(
          'udhar',
          'create',
          {
            id: makeId('udh'),
            customerId: activeCustomerId,
            customerName: draftCustomerName.trim(),
            type: entryType,
            amount: draftAmount,
            note: lastTranscript,
            source: 'voice',
            createdAt: new Date().toISOString(),
          },
          forceDuplicate
        );
        const successMsg =
          language === 'te'
            ? entryType === 'repayment'
              ? 'చెల్లింపు నమోదు అయింది. బ్యాలెన్స్ అప్‌డేట్ చేయబడింది.'
              : 'ఉధార్ ఖాతాలో నమోదు అయింది.'
            : language === 'hi'
              ? entryType === 'repayment'
                ? 'रकम जमा हो गई और बैलेंस अपडेट हो गया।'
                : 'उधार खाते में दर्ज हो गया।'
              : entryType === 'repayment'
                ? 'Repayment recorded and customer balance updated.'
                : 'Credit added to Udhar ledger.';
        setStatusMessage(successMsg);
        setResult(null);
        setDuplicateWarning(null);
        void speakResponse(successMsg, language);
      } else if (result.intent === 'RECORD_EXPENSE') {
        if (!draftAmount || draftAmount <= 0) {
          setStatusMessage('Please enter a valid expense amount.');
          return;
        }
        await onCommitMutation(
          'expense',
          'create',
          {
            id: makeId('exp'),
            title: draftTitle.trim() || 'Shop Expense',
            category: draftCategory || 'Other',
            amount: draftAmount,
            paymentMode: 'cash',
            note: lastTranscript,
            source: 'voice',
            createdAt: new Date().toISOString(),
          },
          forceDuplicate
        );
        const successMsg =
          language === 'te'
            ? 'ఖర్చు విజయవంతంగా నమోదు అయింది.'
            : language === 'hi'
              ? 'खर्च सफलतापूर्वक दर्ज हो गया।'
              : 'Expense recorded successfully.';
        setStatusMessage(successMsg);
        setResult(null);
        setDuplicateWarning(null);
        void speakResponse(successMsg, language);
      } else if (result.intent === 'ADD_PRODUCT' || result.intent === 'UPDATE_STOCK') {
        const existing = snapshot.products.find((p) => p.id === activeProductId);
        if (existing) {
          await onCommitMutation('product', 'update', {
            ...existing,
            stock: existing.stock + (Number(draftQty) || 0),
          });
        }
        const successMsg =
          language === 'te'
            ? 'స్టాక్ అప్‌డేట్ చేయబడింది.'
            : language === 'hi'
              ? 'स्टॉक अपडेट हो गया।'
              : 'Inventory stock updated.';
        setStatusMessage(successMsg);
        setResult(null);
        void speakResponse(successMsg, language);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const startWebSpeech = () => {
    setMicError(null);
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => BrowserSpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => BrowserSpeechRecognition })
        .webkitSpeechRecognition;

    if (!SpeechRec) {
      setMicError(t.voice.micDeniedNotice);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = SPEECH_LOCALE[language];
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      let latestText = '';
      let latestConfidence = 0.9;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (silenceTimerRef.current) {
          window.clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        const lastIdx = event.results.length - 1;
        const alt = event.results[lastIdx][0];
        latestText = alt.transcript;
        latestConfidence = alt.confidence || 0.9;
        setTranscriptInput(latestText);
        if (event.results[lastIdx].isFinal) {
          stopListening();
          void processTranscript(latestText, latestConfidence);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        stopListening();
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setMicError(t.voice.micDeniedNotice);
        } else if (event.error === 'no-speech') {
          setMicError(
            language === 'te'
              ? 'మాట వినిపించలేదు. మళ్ళీ ప్రయత్నించండి.'
              : language === 'hi'
                ? 'आवाज़ नहीं सुनाई दी। कृपया फिर बोलें।'
                : 'No speech detected. Tap the mic and try again.'
          );
        } else {
          setMicError(t.voice.micDeniedNotice);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);

      // Silence timeout guard (8s)
      silenceTimerRef.current = window.setTimeout(() => {
        if (!latestText) {
          stopListening();
          setMicError(
            language === 'te'
              ? 'మాట వినిపించలేదు. మళ్ళీ ప్రయత్నించండి.'
              : language === 'hi'
                ? 'कोई आवाज़ नहीं मिली। फिर से कोशिश करें।'
                : 'Silence timeout — tap mic again or type your command.'
          );
        }
      }, 8000);
    } catch {
      setMicError(t.voice.micDeniedNotice);
      setIsListening(false);
    }
  };

  const toggleAudioClipRecording = async () => {
    if (isRecordingAudio && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      return;
    }
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError(t.voice.micDeniedNotice);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = String(reader.result || '');
          const base64 = dataUrl.split(',')[1];
          if (!base64) return;
          setIsProcessing(true);
          try {
            const res = await fetch('/api/ai/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: base64,
                mimeType: blob.type || 'audio/webm',
                language,
              }),
            });
            if (res.ok) {
              const data = (await res.json()) as { transcript?: string };
              if (data.transcript) {
                await processTranscript(data.transcript, 0.9);
              } else {
                setMicError('Could not hear clearly. Please try again.');
              }
            } else {
              setMicError('Audio transcription unavailable offline.');
            }
          } catch {
            setMicError('Network error during audio transcription.');
          } finally {
            setIsProcessing(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingAudio(true);
    } catch {
      setMicError(t.voice.micDeniedNotice);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/50 backdrop-blur-xs">
      <div className="w-full md:max-w-xl bg-white rounded-t-3xl md:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Mobile grab handle */}
        <div className="md:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate">{t.voice.title}</h2>
            <p className="text-xs text-slate-500 truncate">{t.voice.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setReadbackEnabled((v) => !v)}
              title={readbackEnabled ? t.voice.readbackOn : t.voice.readbackOff}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              {readbackEnabled ? <Volume2 className="w-4 h-4 text-teal-700" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close voice assistant"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Language Segmented Switcher */}
        <div className="px-5 pt-3 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['en', 'hi', 'te'] as Language[]).map((langCode) => (
              <button
                key={langCode}
                type="button"
                onClick={() => onChangeLanguage(langCode)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  language === langCode
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {LANGUAGE_META[langCode].nativeLabel}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {isOnline ? 'Gemini AI Ready' : 'Offline Local NLU'}
          </span>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Mic Controls */}
          <div className="flex flex-col items-center py-3 px-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => (isListening ? stopListening() : startWebSpeech())}
                className={`h-16 w-16 rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-md ${
                  isListening
                    ? 'bg-rose-600 text-white ring-4 ring-rose-200'
                    : 'bg-teal-700 text-white hover:bg-teal-800'
                }`}
                aria-label={isListening ? 'Stop listening' : 'Start speaking'}
              >
                {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
              </button>

              {isOnline && (
                <button
                  type="button"
                  onClick={() => void toggleAudioClipRecording()}
                  className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                    isRecordingAudio
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {isRecordingAudio ? 'Stop Clip' : 'Record Clip'}
                </button>
              )}
            </div>

            <p className="mt-2.5 text-xs font-medium text-slate-700 text-center">
              {isProcessing
                ? t.voice.processing
                : isListening
                  ? t.voice.listening
                  : isRecordingAudio
                    ? 'Recording audio clip... tap Stop Clip when done'
                    : t.voice.tapToSpeak}
            </p>
          </div>

          {/* Text fallback input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void processTranscript(transcriptInput, 1);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={transcriptInput}
              onChange={(e) => setTranscriptInput(e.target.value)}
              placeholder={t.voice.typePlaceholder}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-600"
            />
            <button
              type="submit"
              disabled={!transcriptInput.trim() || isProcessing}
              aria-label="Send command"
              className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Mic / Noise / Error alerts */}
          {micError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">{micError}</div>
              <button
                type="button"
                onClick={startWebSpeech}
                className="text-xs font-semibold text-amber-900 underline shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {lowConfidenceWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{t.voice.lowConfidenceNotice}</span>
            </div>
          )}

          {lastTranscript && (
            <div className="text-xs text-slate-500">
              Heard: <span className="font-medium text-slate-800">“{lastTranscript}”</span>
            </div>
          )}

          {statusMessage && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-3.5 text-sm font-medium text-teal-900 flex items-center gap-2">
              <Check className="w-4 h-4 text-teal-700 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Confirmation Card for Financial Transactions */}
          {result && result.needsConfirmation && (
            <div className="rounded-2xl border border-slate-300 bg-white p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-teal-800">
                  {t.voice.confirmPromptTitle}
                </span>
                <span className="text-xs text-slate-500">
                  {result.intent.replace('RECORD_', '')}
                </span>
              </div>

              <p className="text-sm font-semibold text-slate-900">
                {result.confirmationPrompt || result.replyText}
              </p>

              {duplicateWarning && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{duplicateWarning}</span>
                </div>
              )}

              {/* Editable fields */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {(result.intent === 'RECORD_SALE' ||
                  result.intent === 'ADD_PRODUCT' ||
                  result.intent === 'UPDATE_STOCK') && (
                  <>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        Product {createNewProductFlag ? '(New item will be added)' : ''}
                      </label>
                      <input
                        type="text"
                        value={draftProductName}
                        onChange={(e) => {
                          setDraftProductName(e.target.value);
                          const match = snapshot.products.find(
                            (p) => p.name.toLowerCase() === e.target.value.toLowerCase()
                          );
                          setDraftProductId(match?.id || '');
                          setCreateNewProductFlag(!match);
                        }}
                        className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        Qty ({draftUnit})
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={draftQty}
                        onChange={(e) => setDraftQty(Number(e.target.value))}
                        className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm font-mono-tabular"
                      />
                    </div>
                  </>
                )}

                {result.intent === 'RECORD_EXPENSE' && (
                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Expense Title
                    </label>
                    <input
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm"
                    />
                  </div>
                )}

                {(result.intent === 'RECORD_CREDIT' ||
                  result.intent === 'RECORD_REPAYMENT' ||
                  (result.intent === 'RECORD_SALE' && draftPaymentMode === 'udhar')) && (
                  <div className="col-span-2 space-y-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        Customer {createNewCustomerFlag ? '(New customer will be created)' : ''}
                      </label>
                      <input
                        type="text"
                        value={draftCustomerName}
                        onChange={(e) => {
                          setDraftCustomerName(e.target.value);
                          const match = snapshot.customers.find(
                            (c) => c.name.toLowerCase() === e.target.value.toLowerCase()
                          );
                          setDraftCustomerId(match?.id || '');
                          setCreateNewCustomerFlag(!match);
                        }}
                        className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm"
                      />
                    </div>
                    {createNewCustomerFlag && (
                      <input
                        type="tel"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="Customer phone (optional)"
                        className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm"
                      />
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={draftAmount}
                    onChange={(e) => setDraftAmount(Number(e.target.value))}
                    className="w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm font-semibold font-mono-tabular"
                  />
                </div>

                {result.intent === 'RECORD_SALE' && (
                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Payment Mode
                    </label>
                    <div className="flex gap-1.5">
                      {(['cash', 'upi', 'udhar'] as PaymentMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setDraftPaymentMode(mode)}
                          className={`flex-1 min-h-[40px] rounded-lg text-xs font-semibold uppercase border ${
                            draftPaymentMode === mode
                              ? 'bg-teal-700 text-white border-teal-700'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-500">{t.voice.confirmYesHint}</p>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="flex-1 min-h-[44px] rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => void handleConfirmTransaction(Boolean(duplicateWarning))}
                  className="flex-2 min-h-[44px] px-4 rounded-xl bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800 inline-flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{duplicateWarning ? 'Save Anyway' : t.actions.confirmSave}</span>
                </button>
              </div>
            </div>
          )}

          {/* Non-mutating Query Answer or Clarification */}
          {result && !result.needsConfirmation && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
              <p className="text-sm font-semibold text-slate-900">{result.replyText}</p>
              {result.queryAnswer?.metrics && result.queryAnswer.metrics.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {result.queryAnswer.metrics.map((m, idx) => (
                    <div key={idx} className="rounded-lg bg-white border border-slate-200 p-2.5">
                      <div className="text-[11px] text-slate-500">{m.label}</div>
                      <div className="text-base font-bold text-slate-900 font-mono-tabular">
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {result.queryAnswer?.items && result.queryAnswer.items.length > 0 && (
                <ul className="space-y-1 text-xs text-slate-700 pt-1">
                  {result.queryAnswer.items.map((it, idx) => (
                    <li key={idx} className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                      {it}
                    </li>
                  ))}
                </ul>
              )}
              {result.offlineParsed && (
                <div className="text-[11px] text-amber-700">
                  Parsed locally in Offline Mode
                </div>
              )}
            </div>
          )}

          {/* Demo Voice Command Chips */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600">
                Try Sample Commands (Demo Mode)
              </span>
              {result && (
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setStatusMessage(null);
                    setLastTranscript('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DEMO_VOICE_COMMANDS.map((demo, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (demo.lang !== language) onChangeLanguage(demo.lang);
                    void processTranscript(demo.command, 1);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-left text-xs text-slate-700 transition-colors"
                >
                  <span className="font-semibold text-teal-800">{demo.label}: </span>
                  <span>{demo.command}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
