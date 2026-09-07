import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { ShieldCheck, Lock, KeyRound } from 'lucide-react';

/**
 * Shown once (until the owner sets their own admin PIN) instead of
 * silently trusting the shipped default 'admin123' / '1234' PIN
 * forever. Not dismissible - updateAdminPassword() is what clears
 * profile.adminPasswordChanged, which is what closes this.
 */
export const SetAdminPasswordModal: React.FC = () => {
  const { updateAdminPassword, addToast } = usePOS();

  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPass.trim().length < 4) {
      setError('PIN must be at least 4 characters.');
      return;
    }
    if (newPass === 'admin123' || newPass === '1234') {
      setError('Please choose something other than the old default PIN.');
      return;
    }
    if (newPass !== confirmPass) {
      setError('PINs do not match.');
      return;
    }

    // The default admin password is 'admin123', which is what every
    // install of this app ships with - verifyAdminPassword() will
    // still accept it as the "current" password for this one-time
    // change.
    const result = updateAdminPassword('admin123', newPass);
    if (!result.success) {
      setError(result.message);
      return;
    }
    addToast({
      type: 'success',
      title: 'Admin PIN Set',
      message: 'Your shop is now protected with your own PIN.',
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-amber-50/70 dark:bg-amber-950/20">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Set Your Admin PIN</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Every install of this app ships with the same default admin PIN
            (<span className="font-mono">admin123</span>). Anyone who knows that
            can delete sales records or change your settings. Set your own PIN
            to lock the shop down - this only takes a moment.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" /> New Admin PIN
            </label>
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="At least 4 characters"
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Confirm PIN
            </label>
            <input
              type="password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              placeholder="Re-enter your PIN"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>

          {error && (
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white transition-colors"
          >
            Save My PIN & Continue
          </button>
        </form>
      </div>
    </div>
  );
};
