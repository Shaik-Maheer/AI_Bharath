import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Clock, ClipboardList } from 'lucide-react';
import { api, friendlyError } from '../utils/api';
import { formatDate } from '../utils/date';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../utils/usePageTitle';
import { subscribeDataUpdates } from '../utils/liveUpdates';
import KpiCard from '../components/KpiCard';
import SortableTable from '../components/SortableTable';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';

const departments = ['Revenue', 'Finance', 'Police', 'Legal', 'Health', 'Education', 'Public Works', 'District Administration', 'Other'];

export default function Departments() {
  usePageTitle('Departments');
  const [selected, setSelected] = useState('Revenue');
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { notify } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/dashboard/actions');
      setActions(data.actions || []);
    } catch (error) {
      notify(friendlyError(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    let active = true;
    const loadSafely = () => {
      if (!active) return;
      load();
    };
    const onFocus = () => loadSafely();
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadSafely();
    };
    const unsubscribe = subscribeDataUpdates(() => loadSafely());

    loadSafely();
    const id = setInterval(loadSafely, 20000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      clearInterval(id);
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const filtered = useMemo(() => actions.filter((item) => item.responsibleDepartment === selected), [actions, selected]);
  const stats = {
    total: filtered.length,
    pending: filtered.filter((item) => item.trackingStatus === 'Pending').length,
    completed: filtered.filter((item) => item.trackingStatus === 'Completed').length,
    overdue: filtered.filter((item) => new Date(item.deadline) < new Date() && item.trackingStatus !== 'Completed').length
  };

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-extrabold text-navy">Department View</h1>
        <p className="mt-1 text-sm text-slate-600">Cross-case action register filtered by responsible department.</p>
      </section>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-1">
        {departments.map((department) => (
          <button key={department} onClick={() => setSelected(department)} className={`shrink-0 rounded-md px-4 py-2 text-sm font-bold ${selected === department ? 'bg-navy text-white' : 'bg-white text-slate-600'}`}>
            {department}
          </button>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Department Actions" value={stats.total} icon={Building2} />
        <KpiCard label="Pending" value={stats.pending} icon={Clock} tone="gold" />
        <KpiCard label="Completed" value={stats.completed} icon={CheckCircle2} />
        <KpiCard label="Overdue" value={stats.overdue} icon={ClipboardList} tone="red" />
      </section>

      {loading ? (
        <p className="text-sm text-slate-600">Loading department actions...</p>
      ) : (
        <SortableTable
          rows={filtered}
          empty={<EmptyState title={`No ${selected} actions`} message="No verified actions are currently assigned to this department." />}
          columns={[
            { key: 'caseId', label: 'Case ID', accessor: (row) => row.caseId?.caseId, render: (row) => <span className="font-bold text-navy">{row.caseId?.caseId}</span> },
            { key: 'caseTitle', label: 'Case', accessor: (row) => row.caseId?.caseTitle },
            { key: 'directiveNumber', label: 'Directive' },
            { key: 'actionDescription', label: 'Action' },
            { key: 'deadline', label: 'Deadline', render: (row) => formatDate(row.deadline) },
            { key: 'priorityLevel', label: 'Priority', render: (row) => <StatusBadge value={row.priorityLevel} /> },
            { key: 'riskScore', label: 'Risk Score' },
            { key: 'trackingStatus', label: 'Status', render: (row) => <StatusBadge value={row.trackingStatus} /> }
          ]}
        />
      )}
    </div>
  );
}
