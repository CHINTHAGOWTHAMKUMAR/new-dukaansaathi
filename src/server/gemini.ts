import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AIInsightReport,
  Customer,
  Expense,
  Language,
  Product,
  Sale,
  ShopProfile,
  VoiceIntentResult,
} from '../types.ts';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const LANG_LABEL: Record<Language, string> = {
  en: 'English (simple Indian retail English)',
  hi: 'Hindi (Devanagari script, natural everyday Hindustani spoken by shopkeepers)',
  te: 'Telugu (Telugu script, natural conversational Telugu spoken by shopkeepers)',
};

export async function interpretVoiceCommand(params: {
  transcript: string;
  language: Language;
  pendingConfirmation: boolean;
  shop: ShopProfile;
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  expenses: Expense[];
}): Promise<VoiceIntentResult> {
  const ai = getClient();

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySales = params.sales.filter((s) => s.createdAt.slice(0, 10) === todayStr);
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
  const todayExpenses = params.expenses
    .filter((e) => e.createdAt.slice(0, 10) === todayStr)
    .reduce((sum, e) => sum + e.amount, 0);
  const lowStockProducts = params.products.filter((p) => p.stock <= p.minStock);

  const productListSummary = params.products
    .map(
      (p) =>
        `{id:"${p.id}", name:"${p.name}", hi:"${p.localNames?.hi || ''}", te:"${p.localNames?.te || ''}", unit:"${p.unit}", price:${p.price}, stock:${p.stock}, minStock:${p.minStock}}`
    )
    .join('\n');

  const customerListSummary = params.customers
    .map((c) => `{id:"${c.id}", name:"${c.name}", phone:"${c.phone}", udharBalance:${c.udharBalance}}`)
    .join('\n');

  const systemInstruction = `You are DukaanSaathi, a warm, reliable multilingual voice business assistant for a small Indian shopkeeper.
Shop: "${params.shop.name}" (${params.shop.shopType}).
Selected response language: ${LANG_LABEL[params.language]}.
ALL spoken replies ("replyText", "confirmationPrompt", and "queryAnswer.title") MUST be written in ${LANG_LABEL[params.language]}!

CRITICAL RULES:
1. Understand Telugu, Hindi, English, Tenglish (Telugu+English), and Hinglish (Hindi+English) natural speech and regional Indian accents.
2. NEVER invent missing financial numbers (amounts or quantities). If a sale or expense is missing an amount or quantity and cannot be calculated from catalog price * quantity, set intent to "CLARIFY", list missing fields in "missingFields", and ask a targeted, polite question in the selected language.
3. For ALL financial/inventory mutations (RECORD_SALE, RECORD_CREDIT, RECORD_REPAYMENT, RECORD_EXPENSE, ADD_PRODUCT, UPDATE_STOCK), ALWAYS set "needsConfirmation": true and write a clear read-back confirmation question in "confirmationPrompt" (for example in Telugu: "మీరు 5 కిలోల బియ్యాన్ని ₹260కి అమ్మినట్లు నమోదు చేయనా?" or using the exact amount spoken by the shopkeeper if they specified a total).
4. If pendingConfirmation is true and the user says yes/confirm ("అవును", "హా", "हाँ", "yes", "ok", "సరే", "ठीक है", "confirm", "save"), return intent "CONFIRM_YES". If they say no/cancel ("కాదు", "వద్దు", "नहीं", "no", "cancel"), return intent "CONFIRM_NO".
5. Match product names against the catalog below (including Hindi/Telugu local names like బియ్యం/चावल -> Sona Masoori Rice, కందిపప్పు/तूर दाल -> Toor Dal, నూనె/तेल -> Sunflower Cooking Oil, పాలు/दूध -> Fresh Milk Packet). If the user explicitly gave a total amount (e.g. "5 kg rice 250 rupees"), preserve their exact total amount! If they gave quantity and the product is in catalog without a spoken total, compute amount = quantity * price.
6. If a spoken product is NOT in the catalog, put the spoken product name in "unknownProducts". If a spoken customer is NOT in the customer list, put their name in "unknownCustomers".
7. For queries ("What are today's total sales?", "Show products running low", "Ravi's balance", "Generate this month's report"):
   Use the real live metrics provided below! Do NOT invent numbers.

LIVE SHOP DATA:
- Today (${todayStr}) Sales Count: ${todaySales.length}, Total Sales Revenue: ₹${todayRevenue}, Today Expenses: ₹${todayExpenses}
- Low Stock Products (${lowStockProducts.length}): ${lowStockProducts.map((p) => `${p.name} (${p.stock} ${p.unit} left, min ${p.minStock})`).join('; ') || 'None'}
- Products Catalog:
${productListSummary || 'No products yet'}
- Customers Ledger:
${customerListSummary || 'No customers yet'}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Pending confirmation awaiting user reply: ${params.pendingConfirmation}\nShopkeeper utterance: "${params.transcript}"`,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intent: {
            type: Type.STRING,
            description:
              'One of: RECORD_SALE, RECORD_CREDIT, RECORD_REPAYMENT, RECORD_EXPENSE, QUERY_SALES, QUERY_LOW_STOCK, QUERY_CUSTOMER_BALANCE, GENERATE_REPORT, ADD_PRODUCT, UPDATE_STOCK, CONFIRM_YES, CONFIRM_NO, CLARIFY, UNKNOWN',
          },
          confidence: { type: Type.NUMBER },
          needsConfirmation: { type: Type.BOOLEAN },
          replyText: { type: Type.STRING },
          confirmationPrompt: { type: Type.STRING },
          missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
          unknownProducts: { type: Type.ARRAY, items: { type: Type.STRING } },
          unknownCustomers: { type: Type.ARRAY, items: { type: Type.STRING } },
          extracted: {
            type: Type.OBJECT,
            properties: {
              productId: { type: Type.STRING },
              productName: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              unit: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              unitPrice: { type: Type.NUMBER },
              customerId: { type: Type.STRING },
              customerName: { type: Type.STRING },
              paymentMode: { type: Type.STRING },
              category: { type: Type.STRING },
              title: { type: Type.STRING },
              note: { type: Type.STRING },
              reportPeriod: { type: Type.STRING },
            },
          },
          queryAnswer: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              metrics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    value: { type: Type.STRING },
                  },
                },
              },
              items: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
        required: ['intent', 'confidence', 'needsConfirmation', 'replyText', 'missingFields', 'unknownProducts', 'unknownCustomers', 'extracted'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as VoiceIntentResult;
  return parsed;
}

export async function transcribeShopkeeperAudio(params: {
  audioBase64: string;
  mimeType: string;
  language: Language;
}): Promise<string> {
  const ai = getClient();
  const langHint =
    params.language === 'te'
      ? 'Telugu or Telugu-English mixed speech'
      : params.language === 'hi'
        ? 'Hindi or Hindi-English mixed speech'
        : 'Indian English, Hindi, or Telugu speech';

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-transcribe',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: params.mimeType,
            data: params.audioBase64,
          },
        },
        {
          text: `Transcribe this Indian shopkeeper audio accurately (${langHint}). Preserve numbers and currency amounts accurately. Return only the clean transcription text.`,
        },
      ],
    },
  });

  return (response.text ?? '').trim();
}

export async function synthesizeShopkeeperSpeech(params: {
  text: string;
  language: Language;
}): Promise<string | null> {
  const ai = getClient();
  const styleHint =
    params.language === 'te'
      ? 'Warm, clear, friendly Telugu shop assistant voice'
      : params.language === 'hi'
        ? 'Warm, clear, friendly Hindi shop assistant voice'
        : 'Warm, clear, helpful Indian English retail assistant voice';

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: params.text,
            speechMetadata: {
              style: styleHint,
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio ?? null;
}

export async function generateShopInsights(params: {
  language: Language;
  shop: ShopProfile;
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  expenses: Expense[];
}): Promise<AIInsightReport> {
  const ai = getClient();

  const totalSales = params.sales.reduce((s, x) => s + x.totalAmount, 0);
  const totalExpenses = params.expenses.reduce((s, x) => s + x.amount, 0);
  const totalUdhar = params.customers.reduce((s, c) => s + c.udharBalance, 0);
  const lowStock = params.products.filter((p) => p.stock <= p.minStock);

  const productPerf = params.products.map((p) => {
    const soldQty = params.sales.reduce((sum, s) => {
      const found = s.items.find((i) => i.productId === p.id);
      return sum + (found ? found.quantity : 0);
    }, 0);
    return {
      name: p.name,
      stock: p.stock,
      minStock: p.minStock,
      unit: p.unit,
      price: p.price,
      costPrice: p.costPrice,
      soldQty,
    };
  });

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Generate practical retail business insights for "${params.shop.name}" in ${LANG_LABEL[params.language]}.
Metrics:
- Total recorded sales: ₹${totalSales} across ${params.sales.length} bills
- Total expenses: ₹${totalExpenses}
- Total pending Udhar credit: ₹${totalUdhar} across ${params.customers.filter((c) => c.udharBalance > 0).length} customers
- Low stock items (${lowStock.length}): ${JSON.stringify(lowStock.map((l) => ({ name: l.name, stock: l.stock, minStock: l.minStock, unit: l.unit })))}
- Product velocity: ${JSON.stringify(productPerf)}
- Customers with Udhar: ${JSON.stringify(params.customers.filter((c) => c.udharBalance > 0).map((c) => ({ name: c.name, balance: c.udharBalance })))}`,
    config: {
      systemInstruction: `You are DukaanSaathi Business Advisor. Write clear, actionable, encouraging advice for a small Indian retailer in ${LANG_LABEL[params.language]}. Keep points concise and practical.`,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          restockingAlerts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                productName: { type: Type.STRING },
                currentStock: { type: Type.NUMBER },
                minStock: { type: Type.NUMBER },
                suggestion: { type: Type.STRING },
              },
            },
          },
          salesTrends: { type: Type.ARRAY, items: { type: Type.STRING } },
          creditAlerts: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['summary', 'restockingAlerts', 'salesTrends', 'creditAlerts'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as Omit<
    AIInsightReport,
    'id' | 'shopId' | 'language' | 'generatedAt'
  >;

  return {
    id: `ins-${Date.now()}`,
    shopId: params.shop.id,
    language: params.language,
    summary: parsed.summary || '',
    restockingAlerts: Array.isArray(parsed.restockingAlerts) ? parsed.restockingAlerts : [],
    salesTrends: Array.isArray(parsed.salesTrends) ? parsed.salesTrends : [],
    creditAlerts: Array.isArray(parsed.creditAlerts) ? parsed.creditAlerts : [],
    generatedAt: new Date().toISOString(),
  };
}
