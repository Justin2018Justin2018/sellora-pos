import React, { useState, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import { Transaction } from '../../types/pos';
import {
  Printer,
  FileText,
  Share2,
  X,
  CheckCircle2,
  Download,
  Copy,
  Receipt,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { DeleteTransactionModal } from '../common/DeleteTransactionModal';
import {
  executeReceiptPrint,
  openReceiptInNewTab,
  downloadReceiptFile,
  generateBarcodeSvg,
} from '../../utils/printReceipt';

interface ReceiptModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, onClose }) => {
  const { profile, formatMoney, addToast } = usePOS();
  
  const initialFormat = profile.receiptFormat === '58mm' ? '58' : profile.receiptFormat === 'a4' ? 'A4' : '80';
  const [printFormat, setPrintFormat] = useState<'A4' | '80' | '58'>(initialFormat);
  const [copied, setCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Auto-print receipt if enabled in settings
  useEffect(() => {
    if (transaction && profile.autoPrintReceipt) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [transaction?.receipt]);

  if (!transaction) return null;

  const dateObj = new Date(transaction.date);
  const formattedDate = dateObj.toLocaleDateString();
  const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const lineItems = Array.isArray(transaction.services) && transaction.services.length > 0
    ? transaction.services
    : [{ service: transaction.service, qty: transaction.qty, price: transaction.price, total: transaction.total, material: transaction.material, materialTotal: transaction.materialTotal }];

  const handlePrint = () => {
    setIsPrinting(true);
    addToast({
      type: 'info',
      title: '🖨️ Printing Receipt...',
      message: `Triggering print dialog for #${transaction.receipt.slice(-8)} (${printFormat} format)`,
    });

    executeReceiptPrint({
      transaction,
      profile,
      format: printFormat,
      formatMoney,
    });

    setTimeout(() => {
      setIsPrinting(false);
    }, 1000);
  };

  const handleOpenCleanWindow = () => {
    openReceiptInNewTab({
      transaction,
      profile,
      format: printFormat,
      formatMoney,
    });
    addToast({
      type: 'success',
      title: 'Opened Clean Print Page',
      message: 'Dedicated print tab opened for physical thermal or desktop printer.',
    });
  };

  const handleDownloadHtml = () => {
    downloadReceiptFile({
      transaction,
      profile,
      format: printFormat,
      formatMoney,
    });
    addToast({
      type: 'success',
      title: 'Receipt Downloaded',
      message: `Saved receipt_${transaction.receipt}.html`,
    });
  };

  const generateWhatsAppText = () => {
    const divider = '────────────────────────';
    const itemsList = lineItems
      .map((item, i) => `${i + 1}. ${item.service}  x${item.qty}  ${formatMoney(item.total)}`)
      .join('\n');

    return (
      `*${profile.name.toUpperCase()}*\n` +
      `${profile.tagline || 'Your Reliable Business Solutions'}\n` +
      `${divider}\n` +
      `*SALES RECEIPT*\n` +
      `Receipt No: ${transaction.receipt}\n` +
      `Date: ${formattedDate}  Time: ${formattedTime}\n` +
      `${divider}\n` +
      `Customer: ${transaction.customer || 'Walk-in Customer'}\n` +
      `Phone: ${transaction.phone || '-'}\n` +
      `${divider}\n` +
      `*ITEMS / SERVICES:*\n` +
      `${itemsList}\n` +
      `${divider}\n` +
      ((transaction.discount || 0) > 0 ? `Discount: -${formatMoney(transaction.discount)}\n` : '') +
      `*TOTAL AMOUNT: ${formatMoney(transaction.total)}*\n` +
      `Amount Paid: ${formatMoney(transaction.paid)}\n` +
      `Change / Balance: ${formatMoney(transaction.change)}\n` +
      `Payment Method: ${transaction.payment}\n` +
      `Served By: ${transaction.staff || 'Cashier'}\n` +
      `${divider}\n` +
      `*Asante Sana! Thank you for your business.*\n` +
      `Mukuru kwa Reuben, Nairobi\n` +
      `${profile.phone}`
    );
  };

  const handleWhatsAppShare = () => {
    let phone = (transaction.phone || '').replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '254' + phone.slice(1);
    if (phone.startsWith('7') && phone.length === 9) phone = '254' + phone;

    const text = encodeURIComponent(generateWhatsAppText());
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(generateWhatsAppText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Top Control Bar (Screen only, hidden in print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Customer Receipt</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Receipt #{transaction.receipt}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format toggle */}
            <div className="flex items-center p-1 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold">
              <button
                onClick={() => setPrintFormat('A4')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  printFormat === 'A4'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                A4 Invoice
              </button>
              <button
                onClick={() => setPrintFormat('80')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  printFormat === '80'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                80mm Thermal
              </button>
              <button
                onClick={() => setPrintFormat('58')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  printFormat === '58'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                58mm Pocket
              </button>
            </div>

            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 transition-transform active:scale-95 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Printing...' : 'Print Now'}</span>
            </button>

            <button
              onClick={handleOpenCleanWindow}
              title="Open standalone print tab (Direct printer output)"
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-transform active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/50 dark:bg-slate-950/50 flex justify-center">
          {/* FORMAT 1: A4 Corporate Tax & Official Invoice */}
          {printFormat === 'A4' && (
            <div className="a4-print-container w-full max-w-[210mm] bg-white text-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 relative overflow-hidden font-sans">
              {/* Header Gradient Top Banner */}
              <div className="h-2.5 -mx-8 -mt-8 bg-gradient-to-r from-emerald-800 via-emerald-600 to-lime-500 mb-6" />

              {/* Brand & Contact Head */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pb-6 border-b border-emerald-800/20">
                <div className="sm:col-span-7">
                  <h1 className="text-3xl font-black tracking-tight text-emerald-900 leading-none">
                    {profile.name.toUpperCase()}
                  </h1>
                  <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-800 text-white tracking-wide uppercase">
                    {profile.tagline || 'Smart Business & Cyber Solutions'}
                  </span>
                </div>
                <div className="sm:col-span-5 text-right sm:border-l sm:border-emerald-800/30 sm:pl-4 text-xs text-slate-700 space-y-1">
                  <p className="font-bold text-emerald-950">☎ {profile.phone}</p>
                  <p>📍 {profile.address}</p>
                  <p>✉ {profile.email}</p>
                  <p className="font-mono text-[11px] text-slate-500">TIN/PIN: {profile.tinNumber || 'P051234567Z'}</p>
                </div>
              </div>

              {/* Receipt Title Pill */}
              <div className="text-center my-5">
                <span className="inline-block px-8 py-2 rounded-lg bg-emerald-800 text-white font-serif font-black tracking-widest text-lg shadow-sm">
                  OFFICIAL RECEIPT
                </span>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs pb-4 border-b border-slate-200">
                <div className="space-y-1">
                  <p className="text-slate-500 uppercase tracking-wider font-bold text-[10px]">Receipt Number</p>
                  <p className="font-mono font-bold text-sm text-slate-900">{transaction.receipt}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-slate-500 uppercase tracking-wider font-bold text-[10px]">Date & Time</p>
                  <p className="font-semibold text-slate-800">{formattedDate} • {formattedTime}</p>
                </div>
              </div>

              {/* Customer Box */}
              <div className="my-4 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="block text-slate-500 text-[10px] uppercase font-bold">Customer Name</span>
                  <p className="font-bold text-emerald-950 truncate">{transaction.customer || 'Walk-in Customer'}</p>
                </div>
                <div>
                  <span className="block text-slate-500 text-[10px] uppercase font-bold">Phone Number</span>
                  <p className="font-semibold text-slate-800">{transaction.phone || 'N/A'}</p>
                </div>
                <div>
                  <span className="block text-slate-500 text-[10px] uppercase font-bold">ID / Document No.</span>
                  <p className="font-semibold text-slate-800">{transaction.idNumber || 'N/A'}</p>
                </div>
                <div>
                  <span className="block text-slate-500 text-[10px] uppercase font-bold">Location / Branch</span>
                  <p className="font-semibold text-slate-800">{transaction.address || 'Main Branch'}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="my-4 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-emerald-800 text-white font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Service / Item Description</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{item.service}</td>
                        <td className="py-2 px-3 text-center font-semibold text-slate-700">{item.qty}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">{formatMoney(item.price)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatMoney(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total & Summary Area */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 my-6">
                <div className="w-full sm:w-1/2 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Method:</span>
                    <span className="font-bold text-slate-900">{transaction.payment}</span>
                  </div>
                  {(transaction.discount || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Discount:</span>
                      <span className="font-mono font-semibold text-rose-600">-{formatMoney(transaction.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount Tendered:</span>
                    <span className="font-mono font-semibold text-slate-900">{formatMoney(transaction.paid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Change Due:</span>
                    <span className="font-mono font-semibold text-slate-900">{formatMoney(transaction.change)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="text-slate-500">Cashier / Staff:</span>
                    <span className="font-semibold text-slate-900">{transaction.staff}</span>
                  </div>
                </div>

                <div className="w-full sm:w-1/2 space-y-2">
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-800 to-lime-600 text-white flex items-center justify-between shadow-md">
                    <span className="text-sm font-black tracking-wider uppercase">Grand Total</span>
                    <span className="text-2xl font-black font-mono tracking-tight">{formatMoney(transaction.total)}</span>
                  </div>
                </div>
              </div>

              {/* Thank You Note */}
              <div className="text-center py-4 border-t border-b border-emerald-800/20 my-4">
                <h3 className="font-serif italic text-2xl font-black text-emerald-900">Thank You!</h3>
                <p className="text-xs text-slate-600 italic mt-0.5">{profile.receiptFooter || 'We appreciate your business. Welcome again!'}</p>
              </div>

              {/* Footer 3-Column */}
              <div className="grid grid-cols-3 gap-2 text-[10px] text-center text-white bg-emerald-900 p-2.5 rounded-xl font-medium">
                <div className="border-r border-emerald-700/50">🛡️ FAST | RELIABLE | SECURE</div>
                <div className="border-r border-emerald-700/50">🖨️ PRINT • COPY • ONLINE SERVICES</div>
                <div>✓ OFFICIAL RECEIPT</div>
              </div>

              {/* Watermark in background */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none text-6xl font-black text-emerald-950 uppercase rotate-[-25deg]">
                {profile.name}
              </div>
            </div>
          )}

          {/* FORMAT 2: 80mm Standard Desktop POS Thermal Slip */}
          {printFormat === '80' && (
            <div className="thermal-80-container w-[80mm] max-w-[80mm] bg-white text-black p-4 rounded-lg shadow-xl border border-slate-300 font-mono text-xs leading-tight">
              <div className="text-center font-bold text-sm">{profile.name.toUpperCase()}</div>
              <div className="text-center text-[10px] mt-0.5">{profile.tagline || 'Cyber, Gas & Electronics'}</div>
              <div className="text-center text-[10px]">{profile.phone}</div>
              <div className="text-center text-[10px]">{profile.address}</div>
              <div className="border-t border-dashed border-black my-2" />

              <div className="flex justify-between text-[11px]">
                <span>Rcpt:</span>
                <span className="font-bold">{transaction.receipt}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Date:</span>
                <span>{formattedDate} {formattedTime}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Cust:</span>
                <span className="truncate max-w-[140px]">{transaction.customer || 'Walk-in'}</span>
              </div>
              <div className="border-t border-dashed border-black my-2" />

              {/* Items */}
              <div className="space-y-1.5">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[150px]">
                      {item.service} x{item.qty}
                    </span>
                    <span className="font-bold">{formatMoney(item.total)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-black my-2" />

              <div className="flex justify-between text-xs font-extrabold">
                <span>TOTAL:</span>
                <span>{formatMoney(transaction.total)}</span>
              </div>
              {(transaction.discount || 0) > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span>Discount:</span>
                  <span>-{formatMoney(transaction.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[11px]">
                <span>Paid ({transaction.payment}):</span>
                <span>{formatMoney(transaction.paid)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Change:</span>
                <span>{formatMoney(transaction.change)}</span>
              </div>

              <div className="border-t border-dashed border-black my-2" />
              <div className="text-center text-[11px]">Served by: {transaction.staff}</div>

              {transaction.notes && (
                <div className="mt-2 p-1 bg-slate-50 border border-dashed border-slate-300 rounded text-[10px] text-slate-700">
                  <strong>Notes:</strong> {transaction.notes}
                </div>
              )}

              <div
                className="my-2 flex justify-center"
                dangerouslySetInnerHTML={{ __html: generateBarcodeSvg(transaction.receipt, 210, 32) }}
              />

              <div className="text-center font-bold text-xs mt-1">*** ASANTE SANA ***</div>
              <div className="text-center text-[10px] mt-0.5">{profile.receiptFooter || 'Please retain receipt'}</div>
            </div>
          )}

          {/* FORMAT 3: 58mm Handheld Pocket Thermal Slip */}
          {printFormat === '58' && (
            <div className="thermal-58-container w-[58mm] max-w-[58mm] bg-white text-black p-3 rounded-lg shadow-xl border border-slate-300 font-mono text-[10px] leading-snug">
              <div className="text-center font-bold text-xs">{profile.name.toUpperCase()}</div>
              <div className="text-center text-[9px]">{profile.phone}</div>
              <div className="border-t border-dashed border-black my-1.5" />

              <div className="flex justify-between text-[9px]">
                <span>Rcpt:</span>
                <span>{transaction.receipt.slice(-8)}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span>Date:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="border-t border-dashed border-black my-1.5" />

              <div className="space-y-1">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[10px]">
                    <span className="truncate max-w-[110px]">{item.service} x{item.qty}</span>
                    <span>{formatMoney(item.total)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-black my-1.5" />
              <div className="flex justify-between font-bold text-[11px]">
                <span>TOTAL:</span>
                <span>{formatMoney(transaction.total)}</span>
              </div>
              {(transaction.discount || 0) > 0 && (
                <div className="flex justify-between text-[9px]">
                  <span>Discount:</span>
                  <span>-{formatMoney(transaction.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[9px]">
                <span>Paid:</span>
                <span>{formatMoney(transaction.paid)}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span>Change:</span>
                <span>{formatMoney(transaction.change)}</span>
              </div>

              {transaction.notes && (
                <div className="mt-1 text-[8px] text-slate-700">
                  {transaction.notes}
                </div>
              )}

              <div
                className="my-1.5 flex justify-center scale-90 origin-center"
                dangerouslySetInnerHTML={{ __html: generateBarcodeSvg(transaction.receipt, 160, 26) }}
              />

              <div className="border-t border-dashed border-black my-1.5" />
              <div className="text-center text-[9px]">*** THANK YOU ***</div>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="no-print p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied Receipt' : 'Copy Text'}</span>
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors"
              title="Delete this transaction (Requires password)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Receipt</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadHtml}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Download standalone printable HTML file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save HTML</span>
            </button>
            <button
              onClick={handleOpenCleanWindow}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Open full-page clean print preview in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Tab</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-transform active:scale-95 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Printing...' : `Print ${printFormat} Receipt`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Password-Protected Delete Transaction Modal */}
      <DeleteTransactionModal
        isOpen={showDeleteModal}
        transaction={transaction}
        onClose={() => setShowDeleteModal(false)}
        onSuccess={() => {
          setShowDeleteModal(false);
          onClose();
        }}
      />
    </div>
  );
};
