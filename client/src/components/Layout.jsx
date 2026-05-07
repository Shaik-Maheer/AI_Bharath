import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Briefcase, Building2, ClipboardCheck, FileUp, Gavel, LogOut, Menu, ShieldCheck, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3, roles: ['admin', 'reviewer', 'viewer'] },
  { to: '/cases', label: 'Cases', icon: Briefcase, roles: ['admin', 'reviewer', 'viewer'] },
  { to: '/review-queue', label: 'Review Queue', icon: ClipboardCheck, roles: ['reviewer'] },
  { to: '/cases/upload', label: 'Upload', icon: FileUp, roles: ['admin', 'reviewer'] },
  { to: '/departments', label: 'Departments', icon: Building2, roles: ['admin', 'reviewer', 'viewer'] },
  { to: '/admin/users', label: 'User Admin', icon: Users, roles: ['admin'] }
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
  const visibleNav = navItems.filter((item) => item.roles.includes(user?.role));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-slate-50">
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
          {visibleNav.map((item) => {
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
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-20 flex-col justify-center gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <button
                onClick={() => setMobileNavOpen((current) => !current)}
                className="focus-ring mt-0.5 shrink-0 rounded-md border border-slate-200 p-2 text-slate-600 lg:hidden"
                aria-label="Toggle menu"
              >
                {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gold sm:text-xs">Government of India - Ministry of Law & Justice</p>
                <div className="mt-1 flex min-w-0 items-start gap-2 sm:items-center">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-navy sm:mt-0 sm:h-5 sm:w-5" />
                  <p className="min-w-0 break-words text-sm font-semibold capitalize text-slate-600">{breadcrumb(location.pathname)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <div className="max-w-[10rem] text-right sm:max-w-none">
                <p className="truncate text-sm font-bold text-navy">{user?.name}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{user?.role}</p>
              </div>
              <button onClick={handleLogout} className="focus-ring rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="Logout">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
          {mobileNavOpen && (
            <div className="border-t border-slate-200 px-3 py-3 lg:hidden">
              <nav className="grid gap-1">
                {visibleNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold ${
                          isActive ? 'bg-navy text-white' : 'text-slate-700 hover:bg-slate-100'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          )}
        </header>

        <main className="px-3 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
