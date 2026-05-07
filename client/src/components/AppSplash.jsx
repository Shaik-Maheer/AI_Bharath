import { Gavel, Loader2 } from 'lucide-react';

export default function AppSplash() {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-navy via-navy to-slate-900 px-4 text-white">
      <div className="w-full max-w-2xl rounded-2xl border border-gold/30 bg-white/5 p-8 text-center shadow-2xl backdrop-blur sm:p-12">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-gold/40 bg-gold/10 sm:h-24 sm:w-24">
          <Gavel className="h-11 w-11 text-gold sm:h-14 sm:w-14" />
        </div>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl">AdhikarLoop</h1>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-gold/90 sm:text-base">Enforcement Assurance Platform</p>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100">
          <Loader2 className="h-4 w-4 animate-spin text-gold" />
          Please wait...
        </div>
      </div>
    </div>
  );
}
