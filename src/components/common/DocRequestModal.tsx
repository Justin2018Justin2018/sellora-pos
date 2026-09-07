import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  MessageSquareShare,
  X,
  Send,
  User,
  Phone,
  FileText,
  Sparkles
} from 'lucide-react';

interface DocRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocRequestModal: React.FC<DocRequestModalProps> = ({ isOpen, onClose }) => {
  const { profile, customers, addToast } = usePOS();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [docType, setDocType] = useState('PDF / Document for Printing');

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone.trim()) {
      addToast({ type: 'error', title: 'Phone Number Required' });
      return;
    }

    let phone = customerPhone.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '254' + phone.slice(1);
    if (phone.startsWith('7') && phone.length === 9) phone = '254' + phone;

    const message =
      `Habari ${customerName.trim() || 'esteemed customer'} 👋\n\n` +
      `This is *${profile.name}* (${profile.address}).\n\n` +
      `Kindly reply and attach your *${docType}* directly here on WhatsApp.\n` +
      `We will prepare, print, and pack your documents for quick pickup without queueing!\n\n` +
      `Asante sana for choosing our shop! ✨📄`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
    addToast({ type: 'success', title: 'WhatsApp Chat Opened' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <MessageSquareShare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Request Customer Document
              </h3>
              <p className="text-xs text-slate-500">Send WhatsApp document upload prompt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-4 pt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Customer Phone / WhatsApp Number *
            </label>
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="07xxxxxxxx"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Customer Name (Optional)
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Kelvin Mutua"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Document Type Needed
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="PDF / Document for Printing">PDF / Document for Printing</option>
              <option value="Passport Photo / Portrait">Passport Photo / Portrait</option>
              <option value="Curriculum Vitae (CV) & Cover Letter">Curriculum Vitae (CV) & Cover Letter</option>
              <option value="ID Card / Certificate Photocopy">ID Card / Certificate Photocopy</option>
              <option value="KRA PIN Certificate / Tax Returns Slip">KRA PIN Certificate / Tax Returns Slip</option>
              <option value="School Assignment / Project Report">School Assignment / Project Report</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Launch WhatsApp</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
