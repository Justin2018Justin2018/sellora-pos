import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  Users,
  Search,
  Plus,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  Trash2,
  FileSpreadsheet,
  Award,
  Calendar
} from 'lucide-react';
import { Customer } from '../../types/pos';

export const CustomersView: React.FC = () => {
  const {
    customers,
    addCustomer,
    deleteCustomer,
    profile,
    formatMoney,
    hasRole,
    addToast,
  } = usePOS();

  const [searchQuery, setSearchQuery] = useState('');

  // Add Customer Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Filtered
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.phone, c.email, c.idNumber, c.address].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    );
  }, [customers, searchQuery]);

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      addToast({ type: 'error', title: 'Name & Phone Required' });
      return;
    }

    addCustomer({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      idNumber: idNumber.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    setName('');
    setPhone('');
    setEmail('');
    setIdNumber('');
    setAddress('');
    setNotes('');
  };

  const handleOpenWhatsApp = (c: Customer, customText?: string) => {
    let cleanPhone = (c.phone || '').replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '254' + cleanPhone.slice(1);
    if (cleanPhone.startsWith('7') && cleanPhone.length === 9) cleanPhone = '254' + cleanPhone;

    const defaultMsg = `Habari ${c.name}, thank you for choosing ${profile.name}! How may we assist you today?`;
    const text = encodeURIComponent(customText || defaultMsg);

    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  };

  const handleRequestDoc = (c: Customer) => {
    const msg =
      `Habari ${c.name} 👋\n\n` +
      `Kindly reply and attach your document, PDF, or photos to this chat for printing, lamination, or scanning at *${profile.name}*.\n\n` +
      `We will notify you immediately once ready for pickup! 📄✨`;
    handleOpenWhatsApp(c, msg);
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'ID Number', 'Address', 'Total Spent', 'Visits', 'Points'];
    const rows = customers.map((c) => [
      `"${c.name}"`,
      `"${c.phone}"`,
      `"${c.email || ''}"`,
      `"${c.idNumber || ''}"`,
      `"${c.address || ''}"`,
      c.totalSpent || 0,
      (c as any).visits || 1,
      (c as any).points || Math.floor((c.totalSpent || 0) / 100),
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `Customer_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-blue-200 border border-white/20 mb-2">
              <Users className="w-3.5 h-3.5" />
              <span>Customer Relationship Management</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              👥 Customer Directory & WhatsApp CRM
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-blue-100 max-w-xl">
              Track repeat clients, request documents directly via WhatsApp, and reward customer loyalty.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add Customer Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-600" />
          <span>Add New Customer</span>
        </h3>

        <form onSubmit={handleAddCustomer} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Customer Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Grace Achieng"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Phone / WhatsApp *</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07xxxxxxxx"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">National ID / Passport</label>
              <input
                type="text"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="e.g. 29482718"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Location / Stage</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Reuben Stage, Plot 4"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@gmail.com"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Notes / Preferences</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Prefers color printing on 80gsm paper"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Save Customer</span>
            </button>
          </div>
        </form>
      </div>

      {/* Customer Directory Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Customer Records</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total {customers.length} clients registered</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, ID..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3">Customer Name</th>
                <th className="py-3 px-3">Phone / WhatsApp</th>
                <th className="py-3 px-3">National ID</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3 text-right">Total Spent</th>
                <th className="py-3 px-3 text-center">Visits</th>
                <th className="py-3 px-3 text-center">Loyalty Points</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCustomers.map((c) => (
                <tr key={c.phone} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{c.name}</td>
                  <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">{c.phone}</td>
                  <td className="py-3 px-3 text-slate-500">{c.idNumber || '-'}</td>
                  <td className="py-3 px-3 text-slate-500">{c.address || '-'}</td>
                  <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                    {formatMoney(c.totalSpent || 0)}
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-blue-600">{c.visits || 1}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      <Award className="w-3 h-3 text-amber-600" />
                      <span>{c.points || 0} pts</span>
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleRequestDoc(c)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]"
                        title="Request doc on WhatsApp"
                      >
                        Request Doc
                      </button>
                      <button
                        onClick={() => handleOpenWhatsApp(c)}
                        className="p-1 text-slate-400 hover:text-emerald-600 rounded-lg"
                        title="Open WhatsApp Chat"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      {hasRole('admin') && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete customer ${c.name}?`)) {
                              deleteCustomer(c.phone);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                          title="Delete Customer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
