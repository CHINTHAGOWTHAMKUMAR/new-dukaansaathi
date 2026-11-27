import type { Customer, Expense, Language, Product, Sale, VoiceIntentResult } from '../types';
import { formatINR } from './i18n';

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5, panch: 5, che: 6, saat: 7, aath: 8, nau: 9, das: 10,
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  'ఒక': 1, 'ఒకటి': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5, 'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10,
};

function extractNumbers(text: string): number[] {
  const nums: number[] = [];
  const digitMatches = text.match(/\d+(?:\.\d+)?/g);
  if (digitMatches) {
    for (const m of digitMatches) {
      const n = Number(m);
      if (Number.isFinite(n)) nums.push(n);
    }
  }
  const tokens = text.toLowerCase().split(/[\s,।.?!]+/);
  for (const t of tokens) {
    if (WORD_NUMBERS[t] !== undefined) {
      nums.push(WORD_NUMBERS[t]);
    }
  }
  return nums;
}

function findMatchingProduct(text: string, products: Product[]): Product | undefined {
  const lower = text.toLowerCase();
  const aliasMap: Record<string, string[]> = {
    rice: ['rice', 'biyyam', 'బియ్యం', 'chawal', 'चावल', 'sona'],
    dal: ['dal', 'toor', 'pappu', 'కందిపప్పు', 'दाल', 'तूर'],
    sugar: ['sugar', 'cheeni', 'shakkar', 'చక్కెర', 'పంచదార', 'चीनी', 'शक्कर'],
    oil: ['oil', 'nune', 'నూనె', 'tel', 'तेल', 'sunflower'],
    milk: ['milk', 'paalu', 'పాలు', 'doodh', 'दूध'],
    atta: ['atta', 'flour', 'pindi', 'పిండి', 'आटा'],
    tea: ['tea', 'chai', 'టీ', 'चाय'],
    biscuit: ['biscuit', 'parle', 'బిస్కెట్', 'बिस्कुट'],
    soap: ['soap', 'dettol', 'sabbu', 'సబ్బు', 'साबुन'],
    onion: ['onion', 'ulli', 'ఉల్లి', 'pyaz', 'प्याज'],
    tomato: ['tomato', 'టమాటా', 'टमाटर'],
  };

  for (const p of products) {
    if (lower.includes(p.name.toLowerCase())) return p;
    if (p.localNames?.hi && lower.includes(p.localNames.hi.toLowerCase())) return p;
    if (p.localNames?.te && lower.includes(p.localNames.te.toLowerCase())) return p;
    for (const key of Object.keys(aliasMap)) {
      const aliases = aliasMap[key];
      const matchesText = aliases.some((a) => lower.includes(a));
      const matchesProduct =
        p.name.toLowerCase().includes(key) ||
        aliases.some((a) => p.name.toLowerCase().includes(a));
      if (matchesText && matchesProduct) return p;
    }
  }
  return undefined;
}

function findMatchingCustomer(text: string, customers: Customer[]): Customer | undefined {
  const lower = text.toLowerCase();
  return customers.find((c) => {
    const parts = c.name.toLowerCase().split(' ');
    return lower.includes(c.name.toLowerCase()) || parts.some((p) => p.length > 2 && lower.includes(p));
  });
}

export function parseCommandOffline(params: {
  transcript: string;
  language: Language;
  pendingConfirmation: boolean;
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  expenses: Expense[];
}): VoiceIntentResult {
  const t = params.transcript.trim();
  const lower = t.toLowerCase();
  const lang = params.language;

  if (params.pendingConfirmation) {
    if (/(yes|ok|confirm|save|అవును|సరే|हाँ|हां|ठीक)/i.test(lower)) {
      return {
        intent: 'CONFIRM_YES',
        confidence: 0.9,
        needsConfirmation: false,
        replyText: lang === 'te' ? 'సరే, సేవ్ చేస్తున్నాను.' : lang === 'hi' ? 'ठीक है, सहेज रहा हूँ।' : 'Confirmed, saving now.',
        missingFields: [],
        unknownProducts: [],
        unknownCustomers: [],
        extracted: {},
        offlineParsed: true,
      };
    }
    if (/(no|cancel|వద్దు|కాదు|नहीं|रद्द)/i.test(lower)) {
      return {
        intent: 'CONFIRM_NO',
        confidence: 0.9,
        needsConfirmation: false,
        replyText: lang === 'te' ? 'రద్దు చేయబడింది.' : lang === 'hi' ? 'रद्द किया गया।' : 'Cancelled.',
        missingFields: [],
        unknownProducts: [],
        unknownCustomers: [],
        extracted: {},
        offlineParsed: true,
      };
    }
  }

  // Query: low stock
  if (/(low|running low|कम|తక్కువ|stock|స్టాక్)/i.test(lower)) {
    const low = params.products.filter((p) => p.stock <= p.minStock);
    return {
      intent: 'QUERY_LOW_STOCK',
      confidence: 0.85,
      needsConfirmation: false,
      replyText:
        lang === 'te'
          ? `${low.length} సరుకులు తక్కువ స్టాక్‌లో ఉన్నాయి.`
          : lang === 'hi'
            ? `${low.length} सामान कम स्टॉक में हैं।`
            : `${low.length} products are running low on stock.`,
      missingFields: [],
      unknownProducts: [],
      unknownCustomers: [],
      extracted: {},
      queryAnswer: {
        title: lang === 'te' ? 'తక్కువ స్టాక్ సరుకులు' : lang === 'hi' ? 'कम स्टॉक अलर्ट' : 'Low Stock Items',
        items: low.map((p) => `${p.name}: ${p.stock} ${p.unit} (min ${p.minStock})`),
      },
      offlineParsed: true,
    };
  }

  // Query: today sales
  if (/(today|total sale|sales|बिक्री|అమ్మకాలు|ఈరోజు|आज)/i.test(lower) && !/(sold|అమ్మాను|बेच|add|record)/i.test(lower)) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todaySales = params.sales.filter((s) => s.createdAt.slice(0, 10) === todayStr);
    const total = todaySales.reduce((s, x) => s + x.totalAmount, 0);
    return {
      intent: 'QUERY_SALES',
      confidence: 0.85,
      needsConfirmation: false,
      replyText:
        lang === 'te'
          ? `ఈరోజు మొత్తం అమ్మకాలు ${formatINR(total)} (${todaySales.length} బిల్లులు).`
          : lang === 'hi'
            ? `आज की कुल बिक्री ${formatINR(total)} है (${todaySales.length} बिल)।`
            : `Today's total sales are ${formatINR(total)} across ${todaySales.length} bills.`,
      missingFields: [],
      unknownProducts: [],
      unknownCustomers: [],
      extracted: {},
      queryAnswer: {
        title: lang === 'te' ? 'ఈరోజు అమ్మకాలు' : lang === 'hi' ? 'आज की बिक्री' : "Today's Sales Summary",
        metrics: [
          { label: 'Total Sales', value: formatINR(total) },
          { label: 'Bills Count', value: String(todaySales.length) },
        ],
      },
      offlineParsed: true,
    };
  }

  const nums = extractNumbers(t);
  const cust = findMatchingCustomer(t, params.customers);
  const prod = findMatchingProduct(t, params.products);

  // Repayment
  if (/(paid|repay|returned|చెల్లించ|ఇచ్చారు|दिए|जमा)/i.test(lower)) {
    const amount = nums[nums.length - 1] || 0;
    if (!amount || !cust) {
      return {
        intent: 'CLARIFY',
        confidence: 0.6,
        needsConfirmation: false,
        replyText:
          lang === 'te'
            ? 'దయచేసి కస్టమర్ పేరు మరియు చెల్లించిన మొత్తం చెప్పండి.'
            : lang === 'hi'
              ? 'कृपया ग्राहक का नाम और जमा राशि बताएं।'
              : 'Please specify the customer name and repayment amount.',
        missingFields: [!cust ? 'customerName' : '', !amount ? 'amount' : ''].filter(Boolean),
        unknownProducts: [],
        unknownCustomers: [],
        extracted: { customerName: cust?.name, amount: amount || undefined },
        offlineParsed: true,
      };
    }
    const prompt =
      lang === 'te'
        ? `${cust.name} ₹${amount} చెల్లించినట్లు నమోదు చేయనా?`
        : lang === 'hi'
          ? `${cust.name} ने ₹${amount} जमा किए, अपडेट कर दूँ?`
          : `Record ₹${amount} repayment from ${cust.name}?`;
    return {
      intent: 'RECORD_REPAYMENT',
      confidence: 0.85,
      needsConfirmation: true,
      replyText: prompt,
      confirmationPrompt: prompt,
      missingFields: [],
      unknownProducts: [],
      unknownCustomers: [],
      extracted: { customerId: cust.id, customerName: cust.name, amount },
      offlineParsed: true,
    };
  }

  // Udhar / Credit
  if (/(credit|udhar|baaki|उधार|అప్పు|బాకీ)/i.test(lower)) {
    const amount = nums[nums.length - 1] || 0;
    if (!amount) {
      return {
        intent: 'CLARIFY',
        confidence: 0.6,
        needsConfirmation: false,
        replyText: 'Please specify the credit amount.',
        missingFields: ['amount'],
        unknownProducts: [],
        unknownCustomers: [],
        extracted: { customerId: cust?.id, customerName: cust?.name },
        offlineParsed: true,
      };
    }
    const prompt =
      lang === 'te'
        ? `${cust?.name || 'Customer'} పేరు మీద ₹${amount} ఉధార్ నమోదు చేయనా?`
        : lang === 'hi'
          ? `${cust?.name || 'Customer'} के नाम ₹${amount} उधार लिख दूँ?`
          : `Record ₹${amount} credit (Udhar) for ${cust?.name || 'Customer'}?`;
    return {
      intent: 'RECORD_CREDIT',
      confidence: 0.82,
      needsConfirmation: true,
      replyText: prompt,
      confirmationPrompt: prompt,
      missingFields: [],
      unknownProducts: [],
      unknownCustomers: cust ? [] : ['Customer'],
      extracted: { customerId: cust?.id, customerName: cust?.name || 'New Customer', amount, paymentMode: 'udhar' },
      offlineParsed: true,
    };
  }

  // Expense
  if (/(expense|bill|electricity|rent|kharcha|खर्च|ఖర్చు|కరెంట్)/i.test(lower)) {
    const amount = nums[nums.length - 1] || 0;
    const category = /electric|కరెంట్|बिजली/i.test(lower)
      ? 'Electricity'
      : /rent|అద్దె|किराया/i.test(lower)
        ? 'Shop Rent'
        : 'Other';
    const title = category === 'Electricity' ? 'Electricity Expense' : `${category} Expense`;
    if (!amount) {
      return {
        intent: 'CLARIFY',
        confidence: 0.6,
        needsConfirmation: false,
        replyText: 'Please mention the expense amount.',
        missingFields: ['amount'],
        unknownProducts: [],
        unknownCustomers: [],
        extracted: { category, title },
        offlineParsed: true,
      };
    }
    const prompt =
      lang === 'te'
        ? `₹${amount} ${title} ఖర్చు నమోదు చేయనా?`
        : lang === 'hi'
          ? `₹${amount} का ${title} खर्च जोड़ दूँ?`
          : `Add ₹${amount} ${title}?`;
    return {
      intent: 'RECORD_EXPENSE',
      confidence: 0.85,
      needsConfirmation: true,
      replyText: prompt,
      confirmationPrompt: prompt,
      missingFields: [],
      unknownProducts: [],
      unknownCustomers: [],
      extracted: { title, category, amount, paymentMode: 'cash' },
      offlineParsed: true,
    };
  }

  // Sale fallback
  if (prod || nums.length >= 1) {
    const qty = nums.length >= 2 ? nums[0] : 1;
    const amount = nums.length >= 2 ? nums[nums.length - 1] : prod ? qty * prod.price : nums[0] || 0;
    if (!prod || !amount) {
      return {
        intent: 'CLARIFY',
        confidence: 0.55,
        needsConfirmation: false,
        replyText:
          lang === 'te'
            ? 'దయచేసి సరుకు పేరు, పరిమాణం మరియు మొత్తం చెప్పండి.'
            : lang === 'hi'
              ? 'कृपया सामान का नाम, मात्रा और रकम बताएं।'
              : 'Please clarify the product name, quantity, and total amount.',
        missingFields: [!prod ? 'productName' : '', !amount ? 'amount' : ''].filter(Boolean),
        unknownProducts: [],
        unknownCustomers: [],
        extracted: { quantity: qty, amount: amount || undefined },
        offlineParsed: true,
      };
    }
    const prompt =
      lang === 'te'
        ? `మీరు ${qty} ${prod.unit} ${prod.name} ₹${amount}కి అమ్మినట్లు నమోదు చేయనా?`
        : lang === 'hi'
          ? `क्या मैं ${qty} ${prod.unit} ${prod.name} की बिक्री ₹${amount} में दर्ज करूँ?`
          : `Record sale of ${qty} ${prod.unit} ${prod.name} for ₹${amount}?`;
    return {
      intent: 'RECORD_SALE',
      confidence: 0.8,
      needsConfirmation: true,
      replyText: prompt,
      confirmationPrompt: prompt,
      missingFields: [],
      unknownProducts: [],
      unknownCustomers: [],
      extracted: {
        productId: prod.id,
        productName: prod.name,
        quantity: qty,
        unit: prod.unit,
        amount,
        unitPrice: Math.round((amount / Math.max(1, qty)) * 100) / 100,
        paymentMode: 'cash',
      },
      offlineParsed: true,
    };
  }

  return {
    intent: 'UNKNOWN',
    confidence: 0.3,
    needsConfirmation: false,
    replyText:
      lang === 'te'
        ? 'ఆఫ్‌లైన్ మోడ్‌లో ఉన్నాము. దయచేసి స్పష్టంగా సరుకు మరియు మొత్తం చెప్పండి.'
        : lang === 'hi'
          ? 'अभी ऑफ़लाइन हैं। कृपया सामान, मात्रा और रकम साफ़ बोलें।'
          : 'Could not recognize that command offline. Please include product, quantity, and amount.',
    missingFields: [],
    unknownProducts: [],
    unknownCustomers: [],
    extracted: {},
    offlineParsed: true,
  };
}
