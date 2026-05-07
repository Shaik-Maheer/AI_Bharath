import { AlertTriangle, X } from 'lucide-react';

export default function RiskModal({ open, text, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-navy/50 p-4">
      <div className="w-full max-w-2xl rounded-md bg-white p-5 shadow-gov">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-700" />
            <h2 className="text-lg font-extrabold text-navy">What-If Risk Simulation</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-4 leading-7 text-slate-700">{text}</p>
      </div>
    </div>
  );
}

