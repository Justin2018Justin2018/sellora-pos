import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, ShieldAlert, ScanLine } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called once with the decoded code, right before the modal closes itself. */
  onScan: (code: string) => void;
  title?: string;
}

const SCANNER_ELEMENT_ID = 'sellora-barcode-scanner-region';

/**
 * Camera-based barcode scanning, reusable across any view. Existing
 * barcode inputs across the app (Electronics, General Shop products/
 * sale) already work by typing or a physical USB scanner (which just
 * types characters) - this adds a genuine phone/laptop-camera option
 * that feeds into those exact same inputs, so none of the existing
 * lookup/matching logic needed to change.
 *
 * Uses html5-qrcode, which reads camera frames directly in the browser
 * - nothing is uploaded anywhere, the whole scan happens on-device.
 */
export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Barcode',
}) => {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const scannerRef = useRef<any>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    stoppedRef.current = false;
    setError(null);
    setStarting(true);

    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 140 } },
          (decodedText: string) => {
            if (stoppedRef.current) return;
            stoppedRef.current = true;
            onScan(decodedText.trim());
            scanner.stop().catch(() => {});
          },
          () => {
            // Per-frame "nothing found yet" callback - expected constantly, not an error.
          }
        );
        if (!cancelled) setStarting(false);
      } catch (err) {
        if (!cancelled) {
          setStarting(false);
          setError(
            err instanceof Error && err.message.toLowerCase().includes('permission')
              ? 'Camera permission was denied. Allow camera access to scan barcodes, or type the code manually.'
              : 'Could not access the camera on this device. You can type the code manually instead.'
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      stoppedRef.current = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [isOpen, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-blue-400" />
            <span>{title}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-900/50 rounded-lg px-3 py-2.5">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              <div id={SCANNER_ELEMENT_ID} className="rounded-xl overflow-hidden bg-black min-h-[220px]" />
              {starting && (
                <p className="text-xs text-slate-400 text-center mt-3 flex items-center justify-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 animate-pulse" />
                  <span>Starting camera…</span>
                </p>
              )}
              {!starting && (
                <p className="text-xs text-slate-400 text-center mt-3">Point the camera at a barcode to scan it.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
