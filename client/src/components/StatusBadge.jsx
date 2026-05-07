import { AlertTriangle } from 'lucide-react';

const statusClasses = {
  Pending: 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-blue-100 text-blue-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  Escalated: 'bg-red-100 text-red-800',
  pending_verification: 'bg-amber-100 text-amber-800',
  verified: 'bg-emerald-100 text-emerald-800',
  active: 'bg-blue-100 text-blue-800',
  pending_extraction: 'bg-slate-100 text-slate-700',
  approved: 'bg-emerald-100 text-emerald-800',
  edited: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  pending: 'bg-slate-100 text-slate-700',
  High: 'bg-red-100 text-red-800',
  Critical: 'bg-red-200 text-red-900',
  Medium: 'bg-amber-100 text-amber-800',
  Low: 'bg-slate-100 text-slate-700'
};

export default function StatusBadge({ value, warn = false }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses[value] || 'bg-slate-100 text-slate-700'}`}>
      {warn && <AlertTriangle className="h-3.5 w-3.5" />}
      {String(value || 'Not set').replace(/_/g, ' ')}
    </span>
  );
}

