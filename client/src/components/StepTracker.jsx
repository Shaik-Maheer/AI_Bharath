import { CheckCircle2, Loader2 } from 'lucide-react';

export default function StepTracker({ steps, activeIndex }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {steps.map((step, index) => {
        const complete = index < activeIndex;
        const active = index === activeIndex;
        return (
          <div key={step} className={`rounded-md border p-4 ${complete || active ? 'border-gold bg-amber-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center gap-2">
              {complete ? <CheckCircle2 className="h-5 w-5 text-emerald-700" /> : active ? <Loader2 className="h-5 w-5 animate-spin text-gold" /> : <span className="h-5 w-5 rounded-full bg-slate-200" />}
              <p className="text-sm font-bold text-navy">{step}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

