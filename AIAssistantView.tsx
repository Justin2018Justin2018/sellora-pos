import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  Bot,
  Calculator,
  Sparkles,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  FileText
} from 'lucide-react';

export const AIAssistantView: React.FC = () => {
  const { formatMoney } = usePOS();

  // Project Quotation Calculator
  const [pagesCount, setPagesCount] = useState<number>(100);
  const [printType, setPrintType] = useState<'bw' | 'color'>('bw');
  const [bindingRequired, setBindingRequired] = useState<boolean>(true);
  const [laminationCover, setLaminationCover] = useState<boolean>(true);
  const [paperType, setPaperType] = useState<'standard' | 'heavy'>('standard');

  // Calculations
  const paperCostPerPage = paperType === 'standard' ? 1.0 : 2.5; // KES
  const inkCostPerPage = printType === 'bw' ? 0.6 : 3.5; // KES
  const totalMaterialPerPage = paperCostPerPage + inkCostPerPage;

  const bindingCost = bindingRequired ? 50 : 0;
  const laminationCost = laminationCover ? 40 : 0;

  const totalCostOfProduction = pagesCount * totalMaterialPerPage + bindingCost + laminationCost;

  // Recommended pricing
  const defaultPagePrice = printType === 'bw' ? 5 : 20;
  const bindingSellingPrice = bindingRequired ? 100 : 0;
  const laminationSellingPrice = laminationCover ? 80 : 0;

  const recommendedClientQuote = pagesCount * defaultPagePrice + bindingSellingPrice + laminationSellingPrice;
  const projectedNetProfit = recommendedClientQuote - totalCostOfProduction;
  const marginPercent = recommendedClientQuote > 0 ? Math.round((projectedNetProfit / recommendedClientQuote) * 100) : 0;

  // FAQs
  const [selectedTip, setSelectedTip] = useState<string | null>(null);

  const tips = [
    {
      title: 'How to price Color Printing profitably?',
      content:
        'A single color cartridge or EcoTank refill bottle yields approximately 6,000 pages at 5% coverage, but graphics and photos consume up to 40% coverage. Never charge less than KSh 15 per page for light color text, and KSh 30 to KSh 50 for high-saturation full photos. Use draft mode for fast flyers to save 30% toner.',
    },
    {
      title: 'How to prevent cyber café staff cash pilferage?',
      content:
        '1. Use Sellora POS shift balancing at every cashier handover.\n2. Always count raw paper reams in the morning. Number of pages printed must match recorded sales.\n3. Keep the cash drawer locked and verify M-Pesa statements directly on the store phone, not staff personal phones.\n4. Avoid allowing unauthorized friends behind the counter.',
    },
    {
      title: 'Protecting machinery from Kenya Power (KPLC) surges',
      content:
        'Printers and photocopiers are sensitive to voltage spikes. Install a quality 1500VA to 2000VA automatic voltage regulator (AVR) or line-interactive UPS on your main Konica Minolta / Kyocera / HP heavy printers. Never plug heating laminators or electric spiral punches into the same backup UPS as computers.',
    },
    {
      title: 'Maximizing KRA Tax Filing Season (May - June)',
      content:
        'During June tax filing deadline, prepare dedicated quick-service stations for KRA Nil returns. Pre-print flyers and post WhatsApp statuses to your customer database. Charge KSh 100-150 for Nil returns and KSh 300 for P9 employment returns. Offer instant PDF WhatsApp delivery so clients do not have to wait in line.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-blue-200 border border-white/20 mb-2">
              <Bot className="w-3.5 h-3.5 text-blue-300" />
              <span>Smart Cyber & Stationery Business Copilot</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              🤖 Smart Shop Advisor & Job Quotation Engine
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-blue-100 max-w-xl">
              Calculate exact profit margins on bulk book printing and tender binding jobs before giving quotes to customers.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Quotation Calculator */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-blue-600" />
          <span>Bulk Printing & Tender Binding Quotation Estimator</span>
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Inputs */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Number of Pages / Copies
                </label>
                <input
                  type="number"
                  min="1"
                  value={pagesCount}
                  onChange={(e) => setPagesCount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Print Mode
                </label>
                <select
                  value={printType}
                  onChange={(e) => setPrintType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                >
                  <option value="bw">Black & White (B/W)</option>
                  <option value="color">Full Color High Res</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Paper Stock Quality
                </label>
                <select
                  value={paperType}
                  onChange={(e) => setPaperType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                >
                  <option value="standard">Standard 70gsm / 80gsm Copy Paper</option>
                  <option value="heavy">Heavy 120gsm / Glossy Photo Paper</option>
                </select>
              </div>

              <div className="space-y-2 pt-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={bindingRequired}
                    onChange={(e) => setBindingRequired(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Include Spiral Coil Binding</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={laminationCover}
                    onChange={(e) => setLaminationCover(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Include Clear PVC Laminated Cover</span>
                </label>
              </div>
            </div>
          </div>

          {/* Results Card */}
          <div className="lg:col-span-5 rounded-2xl bg-gradient-to-br from-blue-950 to-slate-900 p-5 text-white flex flex-col justify-between border border-blue-800/40">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                Job Quotation & Profit Analysis
              </span>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Production Material Cost (COGS):</span>
                  <span className="font-mono text-rose-400 font-bold">{formatMoney(totalCostOfProduction)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Recommended Retail Quote:</span>
                  <span className="font-mono text-emerald-400 font-bold">{formatMoney(recommendedClientQuote)}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/15 flex items-baseline justify-between">
                <div>
                  <span className="text-xs text-blue-200">Estimated Net Profit</span>
                  <p className="text-2xl font-black text-emerald-300 font-mono">
                    +{formatMoney(projectedNetProfit)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-blue-200">Margin</span>
                  <p className="text-xl font-black text-white">{marginPercent}%</p>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-blue-200/70 mt-3 pt-3 border-t border-white/10">
              💡 Pro Tip: For orders exceeding 500 pages, give a 10% volume discount to secure the contract while retaining healthy 60%+ net margins.
            </p>
          </div>
        </div>
      </div>

      {/* Cyber Business Knowledge Base */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span>Cyber & Business Best Practices (East Africa Market)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tips.map((t) => (
            <div
              key={t.title}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
            >
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white mb-1">{t.title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
                {t.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
