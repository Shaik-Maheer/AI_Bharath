import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((message, type = 'success') => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, type }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((toast) => {
          const Icon = toast.type === 'error' ? AlertTriangle : toast.type === 'info' ? Info : CheckCircle2;
          const color = toast.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-white text-slate-800';
          return (
            <div key={toast.id} className={`flex min-w-72 items-start gap-3 rounded-md border p-3 shadow-gov ${color}`}>
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{toast.message}</p>
              <button className="ml-auto text-slate-500" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

