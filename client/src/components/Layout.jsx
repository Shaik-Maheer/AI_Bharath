import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Briefcase, Building2, FileUp, Gavel, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/cases', label: 'Cases', icon: Briefcase },
  { to: '/cases/upload', label: 'Upload', icon: FileUp },
  { to: '/departments', label: 'Departments', icon: Building2 }
];

function breadcrumb(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length) return 'Dashboard';
  return parts.map((part) => part.replace(/-/g, ' ')).join(' / ');
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-navy text-white lg:block">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <div className="grid h-10 w-10 place-items-center rounded-md border border-gold/50 bg-white/10">
            <Gavel className="h-6 w-6 text-gold" />
          </div>
          <div>
            <p className="text-lg font-extrabold">AdhikarLoop</p>
            <p className="text-xs text-slate-300">Enforcement Assurance</p>
          </div>
        </div>
        <nav className="space-y-1 px-3 py-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold transition ${
                    isActive ? 'bg-white text-navy' : 'text-slate-200 hover:bg-white/10'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="flex min-h-20 flex-col justify-center gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gold">Government of India - Ministry of Law & Justice</p>
              <div className="mt-1 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-navy" />
                <p className="text-sm font-semibold capitalize text-slate-600">{breadcrumb(location.pathname)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-navy">{user?.name}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{user?.role}</p>
              </div>
              <button onClick={handleLogout} className="focus-ring rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="Logout">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

