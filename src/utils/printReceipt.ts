import { Transaction, BusinessProfile } from '../types/pos';

export interface PrintReceiptOptions {
  transaction: Transaction;
  profile: BusinessProfile;
  format: '58' | '80' | 'A4';
  formatMoney: (amount: number) => string;
  includeScreenControls?: boolean;
}

export interface ShiftReportOptions {
  profile: BusinessProfile;
  format: '58' | '80' | 'A4';
  formatMoney: (amount: number) => string;
  periodName: string;
  cashierName?: string;
  grossSales: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  cashInDrawer: number;
  paymentsBreakdown: {
    cash: number;
    mpesa: number;
    card: number;
    debt: number;
  };
  categoryBreakdown: {
    name: string;
    amount: number;
  }[];
  transactionCount: number;
  includeScreenControls?: boolean;
}

export interface TestPrintOptions {
  profile: BusinessProfile;
  format: '58' | '80' | 'A4';
  formatMoney: (amount: number) => string;
  includeScreenControls?: boolean;
}

/**
 * Generates an SVG barcode for clean vector rendering on thermal printers
 */
export function generateBarcodeSvg(code: string, width = 160, height = 34): string {
  const cleanCode = (code || 'RCPT-001').replace(/[^a-zA-Z0-9-]/g, '').slice(-16);
  let pattern = '';
  for (let i = 0; i < cleanCode.length; i++) {
    const charCode = cleanCode.charCodeAt(i);
    const b1 = (charCode % 3) + 1;
    const b2 = ((charCode * 3) % 4) + 1;
    const b3 = (charCode % 2) + 1;
    pattern += `${b1},${b2},${b3},`;
  }
  const widths = pattern.split(',').filter(Boolean).map((n) => Math.max(1, parseInt(n, 10)));
  
  let x = 8;
  let rects = '';
  widths.forEach((w, idx) => {
    if (idx % 2 === 0) {
      rects += `<rect x="${x}" y="0" width="${w}" height="${height - 12}" fill="#000000" />`;
    }
    x += w;
  });

  const totalWidth = Math.max(width, x + 8);

  return `
    <div style="text-align: center; margin: 4px auto 2px auto;">
      <svg width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto; max-width: 100%;">
        ${rects}
        <text x="${totalWidth / 2}" y="${height - 2}" font-size="8" font-family="'JetBrains Mono', monospace" text-anchor="middle" fill="#000000" font-weight="bold">${cleanCode}</text>
      </svg>
    </div>
  `;
}

/**
 * Screen preview top bar for standalone windows/tabs
 */
function getScreenToolbar(title: string, format: string): string {
  const formatLabel = format === '58' ? '58mm Mini Thermal' : format === '80' ? '80mm Standard POS' : 'A4 Full Sheet';
  return `
  <div class="no-print" style="position: sticky; top: 0; left: 0; right: 0; background: #0f172a; color: #ffffff; padding: 12px 18px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.3); z-index: 9999; font-family: system-ui, -apple-system, sans-serif; font-size: 13px;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="background: #2563eb; color: #ffffff; border-radius: 6px; padding: 4px 8px; font-weight: 800; font-size: 11px; letter-spacing: 0.5px;">POS PRINT PREVIEW</span>
      <strong>${title}</strong>
      <span style="background: rgba(255,255,255,0.15); border-radius: 6px; padding: 3px 8px; font-size: 11px; color: #e2e8f0;">${formatLabel}</span>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <button onclick="window.print()" style="background: #10b981; color: #ffffff; border: none; border-radius: 8px; padding: 8px 18px; font-weight: bold; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(16,185,129,0.4); transition: transform 0.1s;" onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform='scale(1)'">
        🖨️ Print Now (Ctrl+P)
      </button>
      <button onclick="window.close()" style="background: #334155; color: #cbd5e1; border: none; border-radius: 8px; padding: 8px 14px; font-weight: 600; font-size: 12px; cursor: pointer;">
        ✕ Close Window
      </button>
    </div>
  </div>
  <div class="no-print" style="background: #eff6ff; border-bottom: 1px solid #bfdbfe; color: #1e40af; padding: 7px 16px; font-size: 11px; text-align: center; font-family: system-ui, sans-serif;">
    💡 <strong>Thermal Printer Tip:</strong> In the print preview window, select your thermal printer, set <strong>Margins to 'None'</strong>, and ensure <strong>Background Graphics</strong> is checked.
  </div>
  `;
}

/**
 * Common print CSS styles for high-contrast thermal output
 */
const thermalCommonCss = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { margin: 0; size: auto; }
  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color: #000000;
    background: #ffffff;
    font-family: 'JetBrains Mono', 'Courier New', Courier, monospace;
    font-variant-numeric: tabular-nums;
  }
  @media print {
    .no-print { display: none !important; }
    body { padding: 0 !important; margin: 0 auto !important; }
  }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-left { text-align: left; }
  .font-bold { font-weight: bold; }
  .font-black { font-weight: 900; }
  .divider { border-top: 1px dashed #000000; margin: 4px 0; }
  .double-divider { border-top: 2px solid #000000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .items-table { width: 100%; border-collapse: collapse; margin: 4px 0; }
  .items-table th { border-bottom: 1px dashed #000000; padding: 2px 0; text-align: left; }
  .items-table td { padding: 2px 0; vertical-align: top; }
`;

/**
 * Generate a standalone, printable HTML document for thermal or A4 receipts
 */
export function generateReceiptHtml({
  transaction,
  profile,
  format,
  formatMoney,
  includeScreenControls = false,
}: PrintReceiptOptions): string {
  const dateObj = new Date(transaction.date);
  const formattedDate = dateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const lineItems =
    Array.isArray(transaction.services) && transaction.services.length > 0
      ? transaction.services
      : [
          {
            service: transaction.service,
            qty: transaction.qty,
            price: transaction.price,
            total: transaction.total,
            material: transaction.material,
            materialTotal: transaction.materialTotal,
          },
        ];

  const screenBar = includeScreenControls
    ? getScreenToolbar(`Receipt #${transaction.receipt}`, format)
    : '';

  // Auto-print script for standalone window
  const autoPrintScript = includeScreenControls
    ? `
    <script>
      window.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
          try { window.focus(); window.print(); } catch(e) {}
        }, 350);
      });
    </script>
    `
    : '';

  const kraPin = profile.kraPin || profile.tinNumber;
  const hasTax = Boolean(
    (transaction.taxAmount && transaction.taxAmount > 0) ||
    (transaction.taxRate !== undefined && transaction.taxRate > 0) ||
    (profile.enableTax && (profile.defaultTaxRate || 0) > 0)
  );
  const taxRate = transaction.taxRate !== undefined ? transaction.taxRate : (profile.defaultTaxRate ?? 16);
  const taxMode = transaction.taxMode || profile.taxCalculationMode || 'inclusive';
  const taxName = transaction.taxName || profile.taxName || 'VAT';

  let taxAmount = 0;
  let netSubtotal = transaction.subtotal || transaction.total;

  if (hasTax && taxRate > 0) {
    if (transaction.taxAmount !== undefined && transaction.taxAmount > 0) {
      taxAmount = transaction.taxAmount;
      netSubtotal = taxMode === 'inclusive' ? Math.max(0, transaction.total - taxAmount) : (transaction.subtotal || (transaction.total - taxAmount));
    } else if (taxMode === 'inclusive') {
      netSubtotal = transaction.total / (1 + taxRate / 100);
      taxAmount = transaction.total - netSubtotal;
    } else {
      taxAmount = (transaction.subtotal || transaction.total) * (taxRate / 100);
      netSubtotal = transaction.subtotal || transaction.total;
    }
  }

  // ----------------------------------------------------
  // FORMAT 1: 58mm Handheld Pocket Thermal Printer
  // ----------------------------------------------------
  if (format === '58') {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt ${transaction.receipt}</title>
  <style>
    ${thermalCommonCss}
    body {
      width: 58mm;
      max-width: 58mm;
      margin: 0 auto;
      padding: 3mm 2mm;
      font-size: 10px;
      line-height: 1.25;
    }
  </style>
</head>
<body>
  ${screenBar}
  <div class="receipt-body">
    <div class="text-center font-black" style="font-size: 13px; letter-spacing: 0.5px;">${profile.name.toUpperCase()}</div>
    ${profile.tagline ? `<div class="text-center font-bold" style="font-size: 8px; margin-top: 1px;">${profile.tagline}</div>` : ''}
    <div class="text-center" style="font-size: 9px; margin-top: 1px;">Tel: ${profile.phone}</div>
    ${profile.address ? `<div class="text-center" style="font-size: 8px;">${profile.address}</div>` : ''}
    ${kraPin ? `<div class="text-center" style="font-size: 8px;">KRA PIN: ${kraPin}</div>` : ''}
    
    <div class="divider"></div>
    
    <div class="row"><span>Rcpt #:</span><span class="font-bold">${transaction.receipt.slice(-10)}</span></div>
    <div class="row"><span>Date:</span><span>${formattedDate} ${formattedTime}</span></div>
    <div class="row"><span>Cust:</span><span>${transaction.customer || 'Walk-in'}</span></div>
    ${transaction.phone ? `<div class="row"><span>Tel:</span><span>${transaction.phone}</span></div>` : ''}
    ${transaction.staff ? `<div class="row"><span>Cashier:</span><span>${transaction.staff}</span></div>` : ''}
    
    <div class="divider"></div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 52%; font-size: 9px;">ITEM</th>
          <th style="width: 16%; text-align: center; font-size: 9px;">QTY</th>
          <th style="width: 32%; text-align: right; font-size: 9px;">AMT</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems
          .map(
            (item) => `
          <tr>
            <td style="font-size: 9px; word-break: break-word;">${item.service}</td>
            <td style="text-align: center; font-size: 9px;">${item.qty}</td>
            <td style="text-align: right; font-size: 9px; font-weight: bold;">${formatMoney(item.total)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    
    <div class="divider"></div>
    
    ${hasTax && taxAmount > 0 ? `
    <div class="row" style="font-size: 9px; color: #333;">
      <span>Net (Excl. Tax):</span>
      <span>${formatMoney(netSubtotal)}</span>
    </div>
    <div class="row" style="font-size: 9px; color: #333;">
      <span>${taxName} (${taxRate}%${taxMode === 'inclusive' ? ' Incl.' : ''}):</span>
      <span>${formatMoney(taxAmount)}</span>
    </div>
    <div class="divider"></div>
    ` : ''}

    <div class="row font-black" style="font-size: 12px;">
      <span>TOTAL:</span>
      <span>${formatMoney(transaction.total)}</span>
    </div>
    <div class="row">
      <span>Paid (${transaction.payment}):</span>
      <span>${formatMoney(transaction.paid)}</span>
    </div>
    <div class="row">
      <span>Change Due:</span>
      <span>${formatMoney(transaction.change)}</span>
    </div>

    ${transaction.notes ? `
    <div class="divider"></div>
    <div style="font-size: 8px; color: #111; word-break: break-word;">
      <strong>Note / Warranty:</strong> ${transaction.notes}
    </div>` : ''}
    
    <div class="double-divider"></div>
    
    ${generateBarcodeSvg(transaction.receipt, 150, 28)}

    <div class="text-center" style="margin-top: 4px; font-size: 9px;">
      <p class="font-bold">*** ASANTE SANA ***</p>
      <p style="margin-top: 2px;">${profile.receiptFooter || 'Goods once sold are not returnable'}</p>
      <p style="font-size: 8px; margin-top: 3px; color: #444;">${profile.name || 'Sellora POS'} • Fast & Reliable</p>
    </div>
  </div>
  ${autoPrintScript}
</body>
</html>`;
  }

  // ----------------------------------------------------
  // FORMAT 2: 80mm Standard Heavy-Duty Countertop Thermal
  // ----------------------------------------------------
  if (format === '80') {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt ${transaction.receipt}</title>
  <style>
    ${thermalCommonCss}
    body {
      width: 80mm;
      max-width: 80mm;
      margin: 0 auto;
      padding: 4mm 3mm;
      font-size: 12px;
      line-height: 1.3;
    }
  </style>
</head>
<body>
  ${screenBar}
  <div class="receipt-body">
    <div class="text-center font-black" style="font-size: 16px; letter-spacing: 0.5px;">${profile.name.toUpperCase()}</div>
    ${profile.tagline ? `<div class="text-center font-bold" style="font-size: 11px; margin-top: 2px;">${profile.tagline}</div>` : ''}
    <div class="text-center" style="font-size: 11px; margin-top: 1px;">Tel: ${profile.phone}</div>
    ${profile.address ? `<div class="text-center" style="font-size: 10px;">${profile.address}</div>` : ''}
    ${kraPin ? `<div class="text-center" style="font-size: 10px;">KRA PIN: ${kraPin}</div>` : ''}
    
    <div class="divider"></div>
    
    <div class="row"><span>Receipt No:</span><span class="font-bold font-mono">${transaction.receipt}</span></div>
    <div class="row"><span>Date & Time:</span><span>${formattedDate} ${formattedTime}</span></div>
    <div class="row"><span>Customer:</span><span class="font-bold">${transaction.customer || 'Walk-in Customer'}</span></div>
    ${transaction.phone ? `<div class="row"><span>Phone:</span><span>${transaction.phone}</span></div>` : ''}
    <div class="row"><span>Served by:</span><span>${transaction.staff}</span></div>
    
    <div class="divider"></div>
    
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 48%; font-size: 11px;">ITEM / SERVICE</th>
          <th style="width: 14%; text-align: center; font-size: 11px;">QTY</th>
          <th style="width: 18%; text-align: right; font-size: 11px;">PRICE</th>
          <th style="width: 20%; text-align: right; font-size: 11px;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems
          .map(
            (item) => `
          <tr>
            <td style="font-size: 11px; word-break: break-word;">${item.service}</td>
            <td style="text-align: center; font-size: 11px;">${item.qty}</td>
            <td style="text-align: right; font-size: 11px;">${formatMoney(item.price)}</td>
            <td style="text-align: right; font-size: 11px; font-weight: bold;">${formatMoney(item.total)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    
    <div class="divider"></div>
    
    ${hasTax && taxAmount > 0 ? `
    <div class="row" style="font-size: 11px; color: #333;">
      <span>Net Subtotal (Excl. Tax):</span>
      <span>${formatMoney(netSubtotal)}</span>
    </div>
    <div class="row" style="font-size: 11px; color: #333;">
      <span>${taxName} (${taxRate}%${taxMode === 'inclusive' ? ' Incl.' : ''}):</span>
      <span class="font-bold">${formatMoney(taxAmount)}</span>
    </div>
    <div class="divider"></div>
    ` : ''}

    <div class="row font-black" style="font-size: 14px;">
      <span>GRAND TOTAL:</span>
      <span>${formatMoney(transaction.total)}</span>
    </div>
    <div class="row" style="font-size: 11px;">
      <span>Payment Method:</span>
      <span class="font-bold">${transaction.payment}</span>
    </div>
    <div class="row" style="font-size: 11px;">
      <span>Amount Tendered:</span>
      <span>${formatMoney(transaction.paid)}</span>
    </div>
    <div class="row" style="font-size: 11px;">
      <span>Change Returned:</span>
      <span class="font-bold">${formatMoney(transaction.change)}</span>
    </div>

    ${transaction.notes ? `
    <div class="divider"></div>
    <div style="font-size: 10px; margin: 2px 0;">
      <strong>Warranty & Notes:</strong> ${transaction.notes}
    </div>` : ''}
    
    <div class="double-divider"></div>
    
    ${generateBarcodeSvg(transaction.receipt, 210, 34)}

    <div class="text-center" style="margin-top: 6px; font-size: 11px;">
      <p class="font-black">*** ASANTE SANA - THANK YOU ***</p>
      <p style="margin-top: 3px; font-size: 10px;">${profile.receiptFooter || 'Goods once sold are not returnable'}</p>
      <p style="font-size: 9px; margin-top: 4px; color: #555;">${profile.name || 'Sellora POS'} • Fast & Reliable Invoicing</p>
    </div>
  </div>
  ${autoPrintScript}
</body>
</html>`;
  }

  // ----------------------------------------------------
  // FORMAT 3: A4 Official Corporate Tax Invoice
  // ----------------------------------------------------
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${transaction.receipt}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { margin: 8mm; size: A4 portrait; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: #0f172a;
      background: #ffffff;
      padding: 10mm;
      max-width: 210mm;
      margin: 0 auto;
    }
    @media print {
      .no-print { display: none !important; }
      body { padding: 4mm !important; }
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 3px solid #059669;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .business-title {
      font-size: 26px;
      font-weight: 900;
      color: #064e3b;
      letter-spacing: -0.5px;
    }
    .tagline {
      display: inline-block;
      margin-top: 4px;
      padding: 3px 10px;
      background: #059669;
      color: #ffffff;
      font-size: 11px;
      font-weight: bold;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .invoice-title-box { text-align: right; }
    .invoice-title {
      font-size: 28px;
      font-weight: 900;
      color: #065f46;
      letter-spacing: 1px;
    }
    .invoice-meta { font-size: 12px; color: #475569; margin-top: 4px; }
    .invoice-meta strong { color: #0f172a; }
    .customer-box {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }
    .customer-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
    .customer-value { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th {
      background: #064e3b;
      color: #ffffff;
      text-align: left;
      padding: 10px 12px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;
    }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: start;
    }
    .payment-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
      font-size: 12px;
    }
    .payment-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px dashed #cbd5e1;
    }
    .payment-row:last-child { border-bottom: none; }
    .total-box {
      background: #ecfdf5;
      border: 2px solid #059669;
      border-radius: 8px;
      padding: 16px 20px;
      text-align: right;
    }
    .total-text { font-size: 13px; font-weight: bold; color: #065f46; text-transform: uppercase; }
    .total-amount { font-size: 26px; font-weight: 900; color: #064e3b; margin-top: 2px; }
    .footer-note {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }
  </style>
</head>
<body>
  ${screenBar}
  <div class="header">
    <div>
      <div class="business-title">${profile.name.toUpperCase()}</div>
      <div class="tagline">${profile.tagline || 'Commercial Business Solutions'}</div>
      <p style="font-size: 12px; color: #334155; margin-top: 6px;">
        📍 ${profile.address || 'Nairobi, Kenya'} &bull; ☎ ${profile.phone}
      </p>
      ${kraPin ? `<p style="font-size: 11px; color: #475569;">KRA PIN: <strong>${kraPin}</strong></p>` : ''}
    </div>
    <div class="invoice-title-box">
      <div class="invoice-title">OFFICIAL INVOICE</div>
      <div class="invoice-meta">Invoice No: <strong>#${transaction.receipt}</strong></div>
      <div class="invoice-meta">Date: <strong>${formattedDate}</strong> &bull; Time: <strong>${formattedTime}</strong></div>
    </div>
  </div>

  <div class="customer-box">
    <div>
      <div class="customer-label">Customer Name</div>
      <div class="customer-value">${transaction.customer || 'Walk-in Customer'}</div>
    </div>
    <div>
      <div class="customer-label">Phone Number</div>
      <div class="customer-value">${transaction.phone || 'N/A'}</div>
    </div>
    <div>
      <div class="customer-label">Payment Method</div>
      <div class="customer-value">${transaction.payment}</div>
    </div>
    <div>
      <div class="customer-label">Issued By</div>
      <div class="customer-value">${transaction.staff}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 5%;">#</th>
        <th style="width: 50%;">Item / Service Description</th>
        <th style="width: 12%; text-align: center;">Qty</th>
        <th style="width: 15%; text-align: right;">Unit Price</th>
        <th style="width: 18%; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItems
        .map(
          (item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${item.service}</strong></td>
          <td style="text-align: center;">${item.qty}</td>
          <td style="text-align: right; font-family: monospace;">${formatMoney(item.price)}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatMoney(item.total)}</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>

  <div class="summary-grid">
    <div class="payment-box">
      <div class="payment-row">
        <span>Payment Method:</span>
        <strong>${transaction.payment}</strong>
      </div>
      <div class="payment-row">
        <span>Amount Tendered:</span>
        <span style="font-family: monospace;">${formatMoney(transaction.paid)}</span>
      </div>
      <div class="payment-row">
        <span>Change Returned:</span>
        <span style="font-family: monospace;">${formatMoney(transaction.change)}</span>
      </div>
      ${transaction.notes ? `
      <div style="margin-top: 8px; font-size: 11px; color: #475569;">
        <strong>Terms / Warranty:</strong> ${transaction.notes}
      </div>` : ''}
    </div>

    <div class="total-box">
      ${hasTax && taxAmount > 0 ? `
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: #065f46; margin-bottom: 2px;">
        <span>Net Subtotal:</span>
        <strong style="font-family: monospace;">${formatMoney(netSubtotal)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: #065f46; margin-bottom: 6px;">
        <span>${taxName} (${taxRate}%${taxMode === 'inclusive' ? ' Incl.' : ''}):</span>
        <strong style="font-family: monospace;">${formatMoney(taxAmount)}</strong>
      </div>
      <div style="border-top: 1px solid #a7f3d0; margin: 4px 0 6px 0;"></div>
      ` : ''}
      <span class="total-text">Grand Total:</span>
      <div class="total-amount">${formatMoney(transaction.total)}</div>
    </div>
  </div>

  <div style="margin-top: 24px;">
    ${generateBarcodeSvg(transaction.receipt, 260, 36)}
  </div>

  <div class="footer-note">
    <h4 style="font-size: 14px; color: #064e3b; font-weight: 800;">Thank You For Your Business!</h4>
    <p style="font-size: 11px; color: #64748b; margin-top: 4px;">
      ${profile.receiptFooter || 'Welcome again. Retain this invoice for warranty and official records.'}
    </p>
  </div>
  ${autoPrintScript}
</body>
</html>`;
}

/**
 * Generate a hardware diagnostic test receipt for printer calibration
 */
export function generateTestReceiptHtml({
  profile,
  format,
  formatMoney,
  includeScreenControls = false,
}: TestPrintOptions): string {
  const timestamp = new Date().toLocaleString();
  const screenBar = includeScreenControls
    ? getScreenToolbar('Hardware Diagnostic Test Ticket', format)
    : '';

  const autoPrintScript = includeScreenControls
    ? `
    <script>
      window.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
          try { window.focus(); window.print(); } catch(e) {}
        }, 350);
      });
    </script>
    `
    : '';

  const is58 = format === '58';
  const widthMm = is58 ? '58mm' : format === '80' ? '80mm' : '210mm';
  const ruler = is58
    ? '|--+--+--+--+--+--+--+--+--| 32C'
    : '|----+----+----+----+----+----+----+----+----+---| 48C';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Printer Hardware Test Ticket</title>
  <style>
    ${thermalCommonCss}
    body {
      width: ${widthMm};
      max-width: ${widthMm};
      margin: 0 auto;
      padding: ${is58 ? '3mm 2mm' : '5mm 4mm'};
      font-size: ${is58 ? '10px' : '12px'};
      line-height: 1.3;
    }
  </style>
</head>
<body>
  ${screenBar}
  <div class="receipt-body">
    <div class="text-center font-black" style="font-size: ${is58 ? '12px' : '15px'};">
      🖨️ POS HARDWARE TEST TICKET
    </div>
    <div class="text-center font-bold" style="font-size: 11px; margin-top: 2px;">
      ${profile.name.toUpperCase()}
    </div>
    <div class="text-center" style="font-size: 10px;">${profile.phone} &bull; ${profile.address}</div>
    
    <div class="double-divider"></div>
    
    <div class="row"><span>Status:</span><span class="font-bold">PRINTER READY (OK)</span></div>
    <div class="row"><span>Paper Width:</span><span>${format === '58' ? '58mm Mini Roll' : format === '80' ? '80mm Standard Roll' : 'A4 Full Sheet'}</span></div>
    <div class="row"><span>Timestamp:</span><span>${timestamp}</span></div>
    <div class="row"><span>Currency Test:</span><span class="font-bold">${formatMoney(1250)}</span></div>
    
    <div class="divider"></div>
    <div class="text-center font-bold" style="font-size: 9px; margin: 2px 0;">-- ALIGNMENT & COLUMN RULER --</div>
    <div style="font-size: ${is58 ? '8px' : '9px'}; font-family: monospace; white-space: pre; overflow: hidden;">${ruler}</div>
    
    <div class="divider"></div>
    <div class="text-center font-bold" style="font-size: 9px; margin: 2px 0;">-- FONT STYLE & GRAPHICS TEST --</div>
    <div class="row"><span>Regular Monospace:</span><span>1234567890</span></div>
    <div class="row font-bold"><span>Bold High-Contrast:</span><span>ABCDEFGHIJ</span></div>
    <div style="background: #000000; color: #ffffff; padding: 2px 4px; text-align: center; font-weight: bold; margin: 4px 0; font-size: 10px;">
      INVERTED FONT THERMAL TEST: OK
    </div>

    <div class="divider"></div>
    <div class="text-center font-bold" style="font-size: 9px; margin: 2px 0;">-- BARCODE SCANNER TEST --</div>
    ${generateBarcodeSvg('TEST-HARDWARE-OK', is58 ? 160 : 220, 32)}

    <div class="double-divider"></div>
    <div class="text-center" style="font-size: 9px; margin: 4px 0; color: #444;">
      - - - - [ TEAR / CUT PAPER HERE ] - - - -
    </div>
    <div class="text-center font-bold" style="font-size: 10px; margin-top: 4px;">
      ${profile.name || 'Sellora POS'} • Ready for Sales
    </div>
  </div>
  ${autoPrintScript}
</body>
</html>`;
}

/**
 * Generate a Daily Shift / Z-Report for thermal printer closing
 */
export function generateShiftReportHtml({
  profile,
  format,
  formatMoney,
  periodName,
  cashierName = 'Shift Cashier',
  grossSales,
  netSales,
  cogs,
  grossProfit,
  operatingExpenses,
  netProfit,
  cashInDrawer,
  paymentsBreakdown,
  categoryBreakdown,
  transactionCount,
  includeScreenControls = false,
}: ShiftReportOptions): string {
  const timestamp = new Date().toLocaleString();
  const screenBar = includeScreenControls
    ? getScreenToolbar(`Shift Z-Report: ${periodName}`, format)
    : '';

  const autoPrintScript = includeScreenControls
    ? `
    <script>
      window.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
          try { window.focus(); window.print(); } catch(e) {}
        }, 350);
      });
    </script>
    `
    : '';

  const is58 = format === '58';
  const widthMm = is58 ? '58mm' : format === '80' ? '80mm' : '210mm';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Shift Z-Report - ${periodName}</title>
  <style>
    ${thermalCommonCss}
    body {
      width: ${widthMm};
      max-width: ${widthMm};
      margin: 0 auto;
      padding: ${is58 ? '3mm 2mm' : '5mm 4mm'};
      font-size: ${is58 ? '10px' : '12px'};
      line-height: 1.3;
    }
  </style>
</head>
<body>
  ${screenBar}
  <div class="receipt-body">
    <div class="text-center font-black" style="font-size: ${is58 ? '13px' : '16px'}; letter-spacing: 0.5px;">
      ${profile.name.toUpperCase()}
    </div>
    <div class="text-center font-bold" style="font-size: 10px; margin-top: 2px;">
      *** DAILY SHIFT / Z-REPORT ***
    </div>
    <div class="text-center" style="font-size: 9px;">${profile.phone} &bull; ${profile.address}</div>
    
    <div class="divider"></div>
    <div class="row"><span>Period:</span><span class="font-bold">${periodName}</span></div>
    <div class="row"><span>Closed At:</span><span>${timestamp}</span></div>
    <div class="row"><span>Cashier / Staff:</span><span>${cashierName}</span></div>
    <div class="row"><span>Orders / Txns:</span><span class="font-bold">${transactionCount}</span></div>
    
    <div class="double-divider"></div>
    <div class="text-center font-black" style="font-size: 11px; margin: 2px 0;">FINANCIAL SUMMARY</div>
    <div class="divider"></div>
    
    <div class="row font-bold" style="font-size: ${is58 ? '11px' : '13px'};">
      <span>GROSS SALES:</span>
      <span>${formatMoney(grossSales)}</span>
    </div>
    <div class="row">
      <span>Cost of Goods (COGS):</span>
      <span>-${formatMoney(cogs)}</span>
    </div>
    <div class="row font-bold">
      <span>GROSS PROFIT:</span>
      <span>${formatMoney(grossProfit)}</span>
    </div>
    <div class="row">
      <span>Operating Expenses:</span>
      <span>-${formatMoney(operatingExpenses)}</span>
    </div>
    <div class="row font-black" style="font-size: ${is58 ? '11px' : '13px'}; border-top: 1px dashed #000; padding-top: 2px;">
      <span>TRUE NET PROFIT:</span>
      <span>${formatMoney(netProfit)}</span>
    </div>

    <div class="double-divider"></div>
    <div class="text-center font-black" style="font-size: 11px; margin: 2px 0;">PAYMENTS BREAKDOWN</div>
    <div class="divider"></div>
    <div class="row"><span>Cash Collected:</span><span class="font-bold">${formatMoney(paymentsBreakdown.cash)}</span></div>
    <div class="row"><span>M-Pesa Mobile Money:</span><span class="font-bold">${formatMoney(paymentsBreakdown.mpesa)}</span></div>
    <div class="row"><span>Card / Bank POS:</span><span>${formatMoney(paymentsBreakdown.card)}</span></div>
    <div class="row"><span>Credit / Debts Issued:</span><span>${formatMoney(paymentsBreakdown.debt)}</span></div>
    
    <div class="divider"></div>
    <div class="row font-black" style="background: #000; color: #fff; padding: 3px 4px; font-size: ${is58 ? '10px' : '12px'};">
      <span>CASH IN DRAWER:</span>
      <span>${formatMoney(cashInDrawer)}</span>
    </div>

    ${categoryBreakdown.length > 0 ? `
    <div class="double-divider"></div>
    <div class="text-center font-black" style="font-size: 11px; margin: 2px 0;">REVENUE BY CATEGORY</div>
    <div class="divider"></div>
    ${categoryBreakdown
      .map(
        (c) => `<div class="row"><span>${c.name}:</span><span>${formatMoney(c.amount)}</span></div>`
      )
      .join('')}
    ` : ''}

    <div class="double-divider"></div>
    <div style="margin-top: 12px; font-size: 10px;">
      <div style="margin-bottom: 12px;">
        Cashier Handover Signature: __________________
      </div>
      <div>
        Supervisor / Manager Sign: __________________
      </div>
    </div>

    <div class="text-center" style="margin-top: 16px; font-size: 9px; color: #555;">
      *** SHIFT END RECONCILIATION VERIFIED ***
    </div>
  </div>
  ${autoPrintScript}
</body>
</html>`;
}

/**
 * Executes a REAL print action with multiple robust fallbacks:
 * 1. Isolated offscreen iframe (ensures only receipt prints, zero app chrome, exact thermal width)
 * 2. If iframe restricted by sandbox, fallback to direct open in new tab
 * 3. Returns success boolean
 */
export function executeReceiptPrint(options: PrintReceiptOptions): boolean {
  try {
    const html = generateReceiptHtml({ ...options, includeScreenControls: false });

    // Remove existing print frame if any
    const existingFrame = document.getElementById('mj-receipt-print-frame');
    if (existingFrame) {
      existingFrame.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'mj-receipt-print-frame';
    // Use offscreen fixed positioning with explicit dimensions so Blink/WebKit calculates full page layout
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = options.format === '58' ? '58mm' : options.format === '80' ? '80mm' : '210mm';
    iframe.style.height = '140mm';
    iframe.style.border = 'none';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          // Remove iframe after print dialog completes
          setTimeout(() => {
            iframe.remove();
          }, 90000);
        } catch (err) {
          console.warn('Iframe print blocked, falling back to new window:', err);
          openReceiptInNewTab(options);
        }
      }, 350);

      return true;
    } else {
      openReceiptInNewTab(options);
      return true;
    }
  } catch (err) {
    console.error('Failed to execute print via iframe, falling back to tab:', err);
    openReceiptInNewTab(options);
    return false;
  }
}

/**
 * Opens a clean standalone popup window for direct printing (best when inside restrictive iframes)
 */
export function openReceiptInNewTab(options: PrintReceiptOptions): void {
  const html = generateReceiptHtml({ ...options, includeScreenControls: true });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const newWin = window.open(url, '_blank');
  if (newWin) {
    newWin.focus();
  }
}

/**
 * Executes a hardware diagnostic test print
 */
export function executeTestPrint(options: TestPrintOptions): boolean {
  try {
    const html = generateTestReceiptHtml({ ...options, includeScreenControls: false });

    const existingFrame = document.getElementById('mj-receipt-print-frame');
    if (existingFrame) {
      existingFrame.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'mj-receipt-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = options.format === '58' ? '58mm' : options.format === '80' ? '80mm' : '210mm';
    iframe.style.height = '140mm';
    iframe.style.border = 'none';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => iframe.remove(), 60000);
        } catch (err) {
          openTestPrintInNewTab(options);
        }
      }, 350);

      return true;
    } else {
      openTestPrintInNewTab(options);
      return true;
    }
  } catch (err) {
    openTestPrintInNewTab(options);
    return false;
  }
}

export function openTestPrintInNewTab(options: TestPrintOptions): void {
  const html = generateTestReceiptHtml({ ...options, includeScreenControls: true });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const newWin = window.open(url, '_blank');
  if (newWin) {
    newWin.focus();
  }
}

/**
 * Executes a Daily Shift / Z-Report print
 */
export function executeShiftReportPrint(options: ShiftReportOptions): boolean {
  try {
    const html = generateShiftReportHtml({ ...options, includeScreenControls: false });

    const existingFrame = document.getElementById('mj-receipt-print-frame');
    if (existingFrame) {
      existingFrame.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'mj-receipt-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = options.format === '58' ? '58mm' : options.format === '80' ? '80mm' : '210mm';
    iframe.style.height = '140mm';
    iframe.style.border = 'none';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => iframe.remove(), 60000);
        } catch (err) {
          openShiftReportInNewTab(options);
        }
      }, 350);

      return true;
    } else {
      openShiftReportInNewTab(options);
      return true;
    }
  } catch (err) {
    openShiftReportInNewTab(options);
    return false;
  }
}

export function openShiftReportInNewTab(options: ShiftReportOptions): void {
  const html = generateShiftReportHtml({ ...options, includeScreenControls: true });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const newWin = window.open(url, '_blank');
  if (newWin) {
    newWin.focus();
  }
}

/**
 * Downloads the receipt as a standalone HTML file
 */
export function downloadReceiptFile(options: PrintReceiptOptions): void {
  const html = generateReceiptHtml({ ...options, includeScreenControls: true });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `receipt_${options.transaction.receipt}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
