export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', onConfirm, onClose, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-navy/50 p-4">
      <div className="w-full max-w-md rounded-md bg-white p-5 shadow-gov">
        <h2 className="text-lg font-extrabold text-navy">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="focus-ring rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} className="focus-ring rounded-md bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {loading ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

