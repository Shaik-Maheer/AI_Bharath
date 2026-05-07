export default function KpiCard({ label, value, icon: Icon, tone = 'navy' }) {
  const color = tone === 'red' ? 'text-red-700 bg-red-50' : tone === 'gold' ? 'text-gold bg-amber-50' : 'text-navy bg-slate-50';
  return (
    <div className="rounded-md border border-slate-200 bg-white p-5 shadow-gov">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-extrabold text-navy sm:text-3xl">{value ?? 0}</p>
        </div>
        {Icon && (
          <div className={`grid h-11 w-11 place-items-center rounded-md ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </div>
  );
}
