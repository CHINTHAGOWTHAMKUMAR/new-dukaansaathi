import React, { useState } from 'react';
import { Check, Printer, Share2, X } from 'lucide-react';
import type { Sale, ShopProfile } from '../types';
import { formatINR, formatShortDate, formatTime } from '../lib/i18n';

interface InvoiceModalProps {
  sale: Sale | null;
  shop: ShopProfile;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ sale, shop, onClose }) => {
  const [copied, setCopied] = useState(false);
  if (!sale) return null;

  const billText = [
    `${shop.name}`,
    `${shop.address ? `${shop.address}, ` : ''}${shop.city}`,
    `Invoice: ${sale.invoiceNumber} · ${formatShortDate(sale.createdAt)} ${formatTime(sale.createdAt)}`,
    sale.customerName ? `Customer: ${sale.customerName}` : '',
    '--------------------------------',
    ...sale.items.map(
      (it) => `${it.productName} (${it.quantity} ${it.unit} x ${formatINR(it.unitPrice)}) = ${formatINR(it.lineTotal)}`
    ),
    '--------------------------------',
    `Total: ${formatINR(sale.totalAmount)}`,
    `Payment: ${sale.paymentMode.toUpperCase()} · Paid: ${formatINR(sale.paidAmount)}${
      sale.creditAmount > 0 ? ` · Udhar: ${formatINR(sale.creditAmount)}` : ''
    }`,
    'Thank you for shopping with us.',
  ]
    .filter(Boolean)
    .join('\n');

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bill ${sale.invoiceNumber} - ${shop.name}`,
          text: billText,
        });
        return;
      } catch {
        // User cancelled or unsupported, fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(billText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Tax / Retail Bill</h3>
            <p className="text-xs text-slate-500 font-mono-tabular">
              {sale.invoiceNumber} · {formatShortDate(sale.createdAt)} {formatTime(sale.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close invoice"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="text-center pb-3 border-b border-dashed border-slate-200">
            <div className="text-base font-bold text-slate-900">{shop.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {shop.address ? `${shop.address}, ` : ''}
              {shop.city}
            </div>
            {shop.phone && (
              <div className="text-xs text-slate-500 font-mono-tabular mt-0.5">
                Ph: {shop.phone}
              </div>
            )}
          </div>

          {sale.customerName && (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Customer</span>
              <span className="font-semibold text-slate-900">{sale.customerName}</span>
            </div>
          )}

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 text-left font-medium">Item</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Rate</th>
                <th className="py-2 text-right font-medium">Amt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sale.items.map((item, i) => (
                <tr key={`${item.productId}-${i}`}>
                  <td className="py-2.5 text-slate-900 font-medium">{item.productName}</td>
                  <td className="py-2.5 text-right text-slate-600 font-mono-tabular">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-2.5 text-right text-slate-600 font-mono-tabular">
                    {formatINR(item.unitPrice)}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-900 font-mono-tabular">
                    {formatINR(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pt-3 border-t border-dashed border-slate-200 space-y-1.5 text-sm">
            <div className="flex items-center justify-between font-bold text-slate-900">
              <span>Grand Total</span>
              <span className="text-lg font-mono-tabular">{formatINR(sale.totalAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Payment Mode · {sale.paymentMode.toUpperCase()}</span>
              <span className="font-mono-tabular">Paid {formatINR(sale.paidAmount)}</span>
            </div>
            {sale.creditAmount > 0 && (
              <div className="flex items-center justify-between text-xs font-medium text-amber-700">
                <span>Added to Udhar Ledger</span>
                <span className="font-mono-tabular">{formatINR(sale.creditAmount)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 whitespace-nowrap"
          >
            {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            <span>{copied ? 'Copied Bill' : 'Share Bill'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
