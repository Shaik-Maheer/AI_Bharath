import { AlertTriangle } from 'lucide-react';

export default function ConfidenceBar({ value }) {
  const color = value < 70 ? 'bg-red-600' : value < 85 ? 'bg-amber-500' : 'bg-emerald-600';
  return (
    <div className="w-full min-w-0 sm:min-w-32 sm:max-w-40">
      <div className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-600">
        {value}%
        {value < 75 && <AlertTriangle title="Confidence below 75 percent. Review evidence carefully." className="h-3.5 w-3.5 text-amber-600" />}
      </div>
      <div className="h-2 rounded-full bg-slate-200">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}
