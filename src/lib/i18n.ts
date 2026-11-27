import type { Language } from '../types';

export const SPEECH_LOCALE: Record<Language, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
};

export const LANGUAGE_META: Record<Language, { label: string; nativeLabel: string }> = {
  en: { label: 'English', nativeLabel: 'English' },
  hi: { label: 'Hindi', nativeLabel: 'हिंदी' },
  te: { label: 'Telugu', nativeLabel: 'తెలుగు' },
};

export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: safe % 1 === 0 ? 0 : 2,
  }).format(safe);
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export const DEMO_VOICE_COMMANDS: { lang: Language; label: string; command: string }[] = [
  {
    lang: 'te',
    label: 'తెలుగు Sale',
    command: 'ఈరోజు ఐదు కిలోల బియ్యం అమ్మాను, 250 రూపాయలు.',
  },
  {
    lang: 'en',
    label: 'Today Sales',
    command: "What are today's total sales?",
  },
  {
    lang: 'en',
    label: 'Expense',
    command: 'Add ₹300 electricity expense.',
  },
  {
    lang: 'en',
    label: 'Udhar Credit',
    command: 'Ravi purchased goods worth ₹500 on credit.',
  },
  {
    lang: 'en',
    label: 'Low Stock',
    command: 'Show products running low.',
  },
  {
    lang: 'en',
    label: 'Repayment',
    command: 'Ravi paid ₹200. Update his balance.',
  },
  {
    lang: 'hi',
    label: 'हिंदी Sale',
    command: 'आज 2 किलो तूर दाल बेची, 310 रुपये नकद।',
  },
  {
    lang: 'hi',
    label: 'हिंदी रिपोर्ट',
    command: 'इस महीने की रिपोर्ट दिखाओ।',
  },
];

export const UI_TEXT: Record<
  Language,
  {
    appName: string;
    publicDemoTag: string;
    nav: {
      dashboard: string;
      sales: string;
      inventory: string;
      udhar: string;
      customers: string;
      expenses: string;
      reports: string;
      settings: string;
      more: string;
    };
    status: {
      synced: string;
      offline: string;
      syncing: string;
      pendingSync: string;
      syncNow: string;
    };
    actions: {
      speak: string;
      recordSale: string;
      addUdhar: string;
      logExpense: string;
      addProduct: string;
      addCustomer: string;
      confirmSave: string;
      cancel: string;
      save: string;
      edit: string;
      delete: string;
      printBill: string;
      sendReminder: string;
      generateInsights: string;
      resetDemo: string;
      installApp: string;
    };
    dashboard: {
      todaySales: string;
      todayExpenses: string;
      estProfit: string;
      pendingUdhar: string;
      lowStockItems: string;
      recentSales: string;
      quickActions: string;
      lowStockTitle: string;
      demoBannerTitle: string;
      demoBannerBody: string;
    };
    voice: {
      title: string;
      subtitle: string;
      tapToSpeak: string;
      listening: string;
      processing: string;
      typePlaceholder: string;
      confirmPromptTitle: string;
      confirmYesHint: string;
      lowConfidenceNotice: string;
      micDeniedNotice: string;
      duplicateNotice: string;
      unknownProductNotice: string;
      unknownCustomerNotice: string;
      readbackOn: string;
      readbackOff: string;
    };
  }
> = {
  en: {
    appName: 'DukaanSaathi',
    publicDemoTag: 'Public Demo Shop',
    nav: {
      dashboard: 'Dashboard',
      sales: 'Sales & Bills',
      inventory: 'Inventory',
      udhar: 'Udhar Ledger',
      customers: 'Customers',
      expenses: 'Expenses',
      reports: 'Reports & AI',
      settings: 'Settings',
      more: 'More',
    },
    status: {
      synced: 'Synced',
      offline: 'Offline',
      syncing: 'Syncing...',
      pendingSync: 'pending sync',
      syncNow: 'Sync Now',
    },
    actions: {
      speak: 'Speak',
      recordSale: 'New Sale',
      addUdhar: 'Add Udhar',
      logExpense: 'Log Expense',
      addProduct: 'Add Product',
      addCustomer: 'Add Customer',
      confirmSave: 'Confirm & Save',
      cancel: 'Cancel',
      save: 'Save',
      edit: 'Edit',
      delete: 'Delete',
      printBill: 'Invoice',
      sendReminder: 'Remind',
      generateInsights: 'Generate AI Insights',
      resetDemo: 'Reset Demo Data',
      installApp: 'Install App',
    },
    dashboard: {
      todaySales: "Today's Sales",
      todayExpenses: "Today's Expenses",
      estProfit: 'Est. Gross Profit',
      pendingUdhar: 'Pending Udhar',
      lowStockItems: 'Low Stock Alerts',
      recentSales: 'Recent Transactions',
      quickActions: 'Quick Actions',
      lowStockTitle: 'Items Running Low',
      demoBannerTitle: 'Public Demonstration Mode Active',
      demoBannerBody:
        'Try voice commands in Telugu, Hindi, or English, test offline mode, or switch to your own PIN-protected shop in Settings.',
    },
    voice: {
      title: 'Voice Assistant',
      subtitle: 'Speak in Telugu, Hindi, English, or mixed speech',
      tapToSpeak: 'Tap Mic to Speak',
      listening: 'Listening... speak naturally',
      processing: 'Understanding your request...',
      typePlaceholder: 'Or type a command (e.g. 5 kg rice sold ₹250)...',
      confirmPromptTitle: 'Please Confirm Before Saving',
      confirmYesHint: 'Say "Yes" / "అవును" / "हाँ" or tap Confirm',
      lowConfidenceNotice: 'Shop background noise detected — please review the numbers below before saving.',
      micDeniedNotice: 'Microphone access is unavailable. Use "Record Clip" or type your command below.',
      duplicateNotice: 'A similar transaction was just recorded. Verify before saving again.',
      unknownProductNotice: 'Product not in catalog yet — you can add it on save.',
      unknownCustomerNotice: 'Customer not in ledger yet — you can create their profile on save.',
      readbackOn: 'Voice Reply On',
      readbackOff: 'Voice Reply Muted',
    },
  },
  hi: {
    appName: 'दुकानसाथी',
    publicDemoTag: 'पब्लिक डेमो दुकान',
    nav: {
      dashboard: 'डैशबोर्ड',
      sales: 'बिक्री और बिल',
      inventory: 'स्टॉक',
      udhar: 'उधार खाता',
      customers: 'ग्राहक',
      expenses: 'खर्च',
      reports: 'रिपोर्ट और AI',
      settings: 'सेटिंग्स',
      more: 'अन्य',
    },
    status: {
      synced: 'सिंक हो गया',
      offline: 'ऑफ़लाइन',
      syncing: 'सिंक हो रहा है...',
      pendingSync: 'सिंक बाकी',
      syncNow: 'अभी सिंक करें',
    },
    actions: {
      speak: 'बोलें',
      recordSale: 'नई बिक्री',
      addUdhar: 'उधार लिखें',
      logExpense: 'खर्च जोड़ें',
      addProduct: 'नया सामान',
      addCustomer: 'नया ग्राहक',
      confirmSave: 'पुष्टि करें और सहेजें',
      cancel: 'रद्द करें',
      save: 'सहेजें',
      edit: 'बदलें',
      delete: 'हटाएं',
      printBill: 'बिल देखें',
      sendReminder: 'याद दिलाएं',
      generateInsights: 'AI सुझाव पाएं',
      resetDemo: 'डेमो डेटा रीसेट',
      installApp: 'ऐप इंस्टॉल करें',
    },
    dashboard: {
      todaySales: 'आज की बिक्री',
      todayExpenses: 'आज का खर्च',
      estProfit: 'अनुमानित मुनाफा',
      pendingUdhar: 'बकाया उधार',
      lowStockItems: 'कम स्टॉक अलर्ट',
      recentSales: 'हाल के लेन-देन',
      quickActions: 'त्वरित कार्य',
      lowStockTitle: 'कम हो रहा सामान',
      demoBannerTitle: 'पब्लिक डेमो मोड चालू है',
      demoBannerBody:
        'तेलुगु, हिंदी या अंग्रेज़ी में बोलकर बिक्री दर्ज करें, ऑफ़लाइन काम करें, या सेटिंग्स में अपनी दुकान बनाएं।',
    },
    voice: {
      title: 'वॉयस असिस्टेंट',
      subtitle: 'हिंदी, तेलुगु या अंग्रेज़ी में बोलें',
      tapToSpeak: 'बोलने के लिए माइक दबाएं',
      listening: 'सुन रहा हूँ... आराम से बोलें',
      processing: 'आपकी बात समझ रहा हूँ...',
      typePlaceholder: 'या यहाँ लिखें (जैसे: 5 किलो चावल 250 रुपये)...',
      confirmPromptTitle: 'सहेजने से पहले जांचें',
      confirmYesHint: '"हाँ" बोलें या नीचे बटन दबाएं',
      lowConfidenceNotice: 'आसपास शोर है — कृपया सहेजने से पहले रकम और मात्रा जांच लें।',
      micDeniedNotice: 'माइक उपलब्ध नहीं है। नीचे टाइप करें या ऑडियो क्लिप रिकॉर्ड करें।',
      duplicateNotice: 'ऐसा ही लेन-देन अभी दर्ज हुआ है। कृपया दोबारा जांचें।',
      unknownProductNotice: 'यह सामान सूची में नहीं है — सहेजते समय जोड़ सकते हैं।',
      unknownCustomerNotice: 'यह ग्राहक खाते में नहीं है — सहेजते समय जोड़ सकते हैं।',
      readbackOn: 'आवाज़ चालू',
      readbackOff: 'आवाज़ बंद',
    },
  },
  te: {
    appName: 'దుకాణ్‌సాథి',
    publicDemoTag: 'పబ్లిక్ డెమో షాప్',
    nav: {
      dashboard: 'డ్యాష్‌బోర్డ్',
      sales: 'అమ్మకాలు & బిల్లులు',
      inventory: 'సరుకు (స్టాక్)',
      udhar: 'ఉధార్ ఖాతా',
      customers: 'కస్టమర్లు',
      expenses: 'ఖర్చులు',
      reports: 'రిపోర్టులు & AI',
      settings: 'సెట్టింగ్స్',
      more: 'మరిన్ని',
    },
    status: {
      synced: 'సింక్ అయింది',
      offline: 'ఆఫ్‌లైన్',
      syncing: 'సింక్ అవుతోంది...',
      pendingSync: 'సింక్ పెండింగ్',
      syncNow: 'ఇప్పుడు సింక్ చేయండి',
    },
    actions: {
      speak: 'మాట్లాడండి',
      recordSale: 'కొత్త అమ్మకం',
      addUdhar: 'ఉధార్ రాయండి',
      logExpense: 'ఖర్చు నమోదు',
      addProduct: 'కొత్త సరుకు',
      addCustomer: 'కొత్త కస్టమర్',
      confirmSave: 'నిర్ధారించి సేవ్ చేయండి',
      cancel: 'రద్దు చేయండి',
      save: 'సేవ్ చేయండి',
      edit: 'మార్చండి',
      delete: 'తొలగించండి',
      printBill: 'బిల్లు',
      sendReminder: 'గుర్తు చేయండి',
      generateInsights: 'AI సూచనలు పొందండి',
      resetDemo: 'డెమో డేటా రీసెట్',
      installApp: 'యాప్ ఇన్‌స్టాల్',
    },
    dashboard: {
      todaySales: 'ఈరోజు అమ్మకాలు',
      todayExpenses: 'ఈరోజు ఖర్చులు',
      estProfit: 'అంచనా లాభం',
      pendingUdhar: 'రావలసిన బాకీ (ఉధార్)',
      lowStockItems: 'తక్కువ స్టాక్ అలర్ట్',
      recentSales: 'ఇటీవలి అమ్మకాలు',
      quickActions: 'త్వరిత పనులు',
      lowStockTitle: 'తక్కువగా ఉన్న సరుకులు',
      demoBannerTitle: 'పబ్లిక్ డెమో మోడ్ యాక్టివ్‌గా ఉంది',
      demoBannerBody:
        'తెలుగు, హిందీ లేదా ఇంగ్లీష్‌లో మాట్లాడి అమ్మకాలు నమోదు చేయండి. ఇంటర్నెట్ లేకపోయినా పనిచేస్తుంది.',
    },
    voice: {
      title: 'వాయిస్ అసిస్టెంట్',
      subtitle: 'తెలుగు, హిందీ లేదా ఇంగ్లీష్‌లో మాట్లాడండి',
      tapToSpeak: 'మాట్లాడటానికి మైక్ నొక్కండి',
      listening: 'వింటున్నాను... స్పష్టంగా మాట్లాడండి',
      processing: 'మీ మాటను అర్థం చేసుకుంటున్నాను...',
      typePlaceholder: 'లేదా టైప్ చేయండి (ఉదా: 5 కిలోల బియ్యం 250 రూపాయలు)...',
      confirmPromptTitle: 'సేవ్ చేసే ముందు సరిచూడండి',
      confirmYesHint: '"అవును" అని చెప్పండి లేదా బటన్ నొక్కండి',
      lowConfidenceNotice: 'చుట్టుపక్కల శబ్దం ఉంది — దయచేసి సంఖ్యలను సరిచూసుకోండి.',
      micDeniedNotice: 'మైక్రోఫోన్ అందుబాటులో లేదు. క్రింద టైప్ చేయండి లేదా క్లిప్ రికార్డ్ చేయండి.',
      duplicateNotice: 'ఇలాంటి లావాదేవీ ఇప్పుడే నమోదైంది. దయచేసి మళ్ళీ సరిచూడండి.',
      unknownProductNotice: 'ఈ సరుకు జాబితాలో లేదు — సేవ్ చేసేటప్పుడు జోడించవచ్చు.',
      unknownCustomerNotice: 'ఈ కస్టమర్ ఖాతాలో లేరు — సేవ్ చేసేటప్పుడు జోడించవచ్చు.',
      readbackOn: 'వాయిస్ జవాబు ఆన్',
      readbackOff: 'వాయిస్ జవాబు మ్యూట్',
    },
  },
};
