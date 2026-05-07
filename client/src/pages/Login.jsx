import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gavel, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { friendlyError } from '../utils/api';
import { usePageTitle } from '../utils/usePageTitle';

const demos = [
  { email: 'admin@adhikar.gov.in', role: 'Admin' },
  { email: 'reviewer@adhikar.gov.in', role: 'Reviewer' },
  { email: 'viewer@adhikar.gov.in', role: 'Viewer' }
];

export default function Login() {
  usePageTitle('Login');
  const [email, setEmail] = useState(demos[0].email);
  const [password, setPassword] = useState('Demo@1234');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      notify(`Signed in as ${user.role}.`);
      navigate('/dashboard');
    } catch (error) {
      notify(friendlyError(error), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-navy px-4 py-4 text-white sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gold sm:text-xs">Government of India - Ministry of Law & Justice</p>
      </header>
      <main className="grid min-h-[calc(100vh-57px)] place-items-center px-4 py-10">
        <div className="w-full max-w-md rounded-md border border-slate-200 bg-white p-5 shadow-gov sm:p-7">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-navy text-gold">
              <Gavel className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-navy">AdhikarLoop</h1>
              <p className="text-sm font-semibold text-slate-500">Court Judgement Enforcement System</p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label className="text-sm font-bold text-navy">Email</label>
              <input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2.5 outline-none focus:border-gold" />
            </div>
            <div>
              <label className="text-sm font-bold text-navy">Password</label>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2.5 outline-none focus:border-gold" />
            </div>
            <button disabled={loading} className="focus-ring flex w-full items-center justify-center gap-2 rounded-md bg-navy px-4 py-3 font-bold text-white disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign In
            </button>
          </form>

          <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-extrabold text-navy">
              <ShieldCheck className="h-4 w-4" />
              Demo credentials
            </div>
            <div className="mt-3 space-y-2">
              {demos.map((demo) => (
                <button key={demo.email} onClick={() => setEmail(demo.email)} className="flex w-full items-center justify-between rounded-md bg-white px-3 py-2 text-left text-sm hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">{demo.email}</span>
                  <span className="text-xs font-bold uppercase text-gold">{demo.role}</span>
                </button>
              ))}
              <p className="text-xs text-slate-600">Password for all accounts: Demo@1234</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
