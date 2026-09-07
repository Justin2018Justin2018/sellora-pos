import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  Megaphone,
  Share2,
  Copy,
  Printer,
  Sparkles,
  Send,
  MessageCircle,
  FileText,
  CheckCircle2
} from 'lucide-react';

export const AdvertisingView: React.FC = () => {
  const { profile, customers, formatMoney, addToast } = usePOS();

  const [campaignTitle, setCampaignTitle] = useState('Weekend Printing & KRA Offer');
  const [campaignMessage, setCampaignMessage] = useState(
    `🔥 *SPECIAL OFFER AT ${profile.name.toUpperCase()}* 🔥\n\n` +
    `Hello neighbors & friends! Looking for fast, clean, high-quality cyber & printing services in Mukuru kwa Reuben?\n\n` +
    `✅ Color & B/W Printing from KSh 5\n` +
    `✅ KRA PIN Registration & Annual Tax Returns: KSh 150\n` +
    `✅ Instant High-Gloss Passport Photos: KSh 25\n` +
    `✅ Heavy Duty Document Lamination: KSh 50\n` +
    `✅ Total & K-Gas Refills available all day!\n\n` +
    `📍 Location: ${profile.address}\n` +
    `☎ Call / WhatsApp: ${profile.phone}\n\n` +
    `_Send your documents directly via WhatsApp for quick pickup!_`
  );

  const [copied, setCopied] = useState(false);

  // Ready-made campaign templates
  const templates = [
    {
      title: 'Back to School Stationery & Printing',
      text:
        `📚 *BACK TO SCHOOL PRINTING & BINDING AT ${profile.name.toUpperCase()}* 🎒\n\n` +
        `Get your school revision past papers, notes, CBC assignments, and reports printed and spiral bound at the lowest rates!\n\n` +
        `• Photocopy: KSh 5 per page\n` +
        `• Spiral Binding: from KSh 50\n` +
        `• Plastic Envelopes & Covers: KSh 30\n\n` +
        `Visit us at ${profile.address} or WhatsApp: ${profile.phone}.`,
    },
    {
      title: 'Gas Refill Discount Notification',
      text:
        `⛽ *GENUINE GAS REFILL SERVICE — ${profile.name.toUpperCase()}* ⛽\n\n` +
        `Ran out of gas? We have genuine, weighed, and sealed gas refills:\n\n` +
        `• 6 KG Cylinder Refill: KSh 950\n` +
        `• 13 KG Cylinder Refill: KSh 2,600\n` +
        `Brands: Total Gas, K-Gas, ProGas, Afrigas.\n\n` +
        `Free safety seal inspection on every cylinder! Call ${profile.phone}.`,
    },
    {
      title: 'KRA Tax Returns & E-Citizen',
      text:
        `🌐 *BE TAX COMPLIANT! KRA & GOVERNMENT SERVICES* 🌐\n\n` +
        `Don't get penalized! File your KRA returns early at *${profile.name}*:\n\n` +
        `• KRA Nil Returns & Employment Returns\n` +
        `• New KRA PIN Registration with Email Setup\n` +
        `• Good Conduct (DCI) Application\n` +
        `• NTSA / Driving License Renewal\n\n` +
        `Fast, confidential, and error-free! WhatsApp us on ${profile.phone}.`,
    },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(campaignMessage);
    setCopied(true);
    addToast({ type: 'success', title: 'Copied to Clipboard', message: 'Paste into WhatsApp Status or Groups!' });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsAppStatus = () => {
    const encoded = encodeURIComponent(campaignMessage);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handlePrintFlyer = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-blue-200 border border-white/20 mb-2">
              <Megaphone className="w-3.5 h-3.5 text-amber-300" />
              <span>Customer Growth & Revenue Booster</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              📢 Advertising & WhatsApp Broadcast Engine
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-blue-100 max-w-xl">
              Post high-converting WhatsApp status updates, share seasonal offers, and print window notice posters for your shop front.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintFlyer}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print Window Flyer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Templates Row */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          1-Click Campaign Templates (Pre-formatted for WhatsApp)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {templates.map((tpl) => (
            <button
              key={tpl.title}
              onClick={() => {
                setCampaignTitle(tpl.title);
                setCampaignMessage(tpl.text);
              }}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-300 text-left transition-all group"
            >
              <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 mb-1">
                {tpl.title}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-3">
                {tpl.text}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Campaign Editor & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor */}
        <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Campaign Message Composer</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Campaign Headline</label>
            <input
              type="text"
              value={campaignTitle}
              onChange={(e) => setCampaignTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Message Body (Markdown supported)</label>
            <textarea
              rows={9}
              value={campaignMessage}
              onChange={(e) => setCampaignMessage(e.target.value)}
              className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono leading-relaxed outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Text'}</span>
            </button>

            <button
              onClick={handleShareWhatsAppStatus}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 transition-transform active:scale-98"
            >
              <Share2 className="w-4 h-4" />
              <span>Broadcast to WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Live Phone Preview */}
        <div className="lg:col-span-5 rounded-3xl bg-slate-900 p-6 text-white shadow-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs">
                  MJ
                </div>
                <div>
                  <h4 className="text-xs font-bold">{profile.name}</h4>
                  <span className="text-[10px] text-emerald-400">Online • WhatsApp Status</span>
                </div>
              </div>
              <span className="text-[10px] text-slate-400">Preview</span>
            </div>

            {/* Bubble */}
            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-xs leading-relaxed whitespace-pre-wrap font-sans text-slate-100">
              {campaignMessage}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Direct to {customers.length} registered customers</span>
            <span className="text-emerald-400 font-bold">100% Free Organic Reach</span>
          </div>
        </div>
      </div>
    </div>
  );
};
