const colors = ['#0A1931', '#C9A84C', '#2563EB', '#059669', '#DC2626', '#64748B', '#7C3AED', '#0F766E'];

export function DonutChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  let offset = 25;
  return (
    <div className="flex flex-col items-center gap-4 md:flex-row">
      <svg viewBox="0 0 42 42" className="h-44 w-44">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#E5E7EB" strokeWidth="7" />
        {data.map((item, index) => {
          const dash = (item.value / total) * 100;
          const segment = <circle key={item.label} cx="21" cy="21" r="15.915" fill="transparent" stroke={colors[index]} strokeWidth="7" strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={offset} />;
          offset -= dash;
          return segment;
        })}
      </svg>
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-sm" style={{ background: colors[index] }} />
            <span className="font-semibold text-slate-700">{item.label}</span>
            <span className="text-slate-500">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarChart({ data }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-xs font-bold text-slate-600">
            <span>{item.label}</span>
            <span>{item.value}</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100">
            <div className="h-3 rounded-full" style={{ width: `${(item.value / max) * 100}%`, background: colors[index % colors.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

