import { FileSearch } from 'lucide-react';

export default function EmptyState({ title = 'No records found', message = 'Adjust filters or upload a judgment to begin.' }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-navy">
        <FileSearch className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-lg font-extrabold text-navy">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{message}</p>
    </div>
  );
}

